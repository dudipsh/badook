import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { PrismaService } from '../common/prisma.service';
import { loadPrompt } from '../ocr/prompt-loader';

/** Fields to strip from ground truth — meta, not training targets */
const META_FIELDS = ['confidence', 'fieldConfidence'];

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly uploadDir: string;
  private gcs: Storage | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = this.config.get('UPLOAD_DIR') || './uploads';
    if (this.config.get('GCS_BUCKET')) {
      this.gcs = new Storage();
    }
  }

  async exportTrainingData(params: {
    documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';
    format?: string;
    minStatus?: 'LABELED' | 'VERIFIED';
  }) {
    const { documentType, format = 'vertex-ai', minStatus = 'LABELED' } = params;

    const statusFilter =
      minStatus === 'VERIFIED'
        ? ['VERIFIED']
        : ['LABELED', 'VERIFIED'];

    const where: any = { status: { in: statusFilter } };
    if (documentType) where.documentType = documentType;

    const samples = await this.prisma.sample.findMany({ where });

    if (samples.length === 0) {
      throw new NotFoundException('No labeled samples found for export');
    }

    // Create export directory
    const now = new Date();
    const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
    const exportId = `export-${ts}`;
    const exportDir = path.join(this.uploadDir, 'exports', exportId);
    const imagesDir = path.join(exportDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    // Build JSONL and copy files
    const jsonlLines: string[] = [];

    for (const sample of samples) {
      const groundTruth = sample.groundTruth as any;
      if (!groundTruth) continue;

      // Copy original file to images dir
      const originalPath = sample.filePath;
      const ext = path.extname(originalPath);
      const imageFilename = `${sample.id}${ext}`;
      const destPath = path.join(imagesDir, imageFilename);

      if (fs.existsSync(originalPath)) {
        fs.copyFileSync(originalPath, destPath);
      }

      // Build training example
      const docTypeMap: Record<string, string> = {
        DELIVERY_NOTE: 'delivery-note',
        INVOICE: 'invoice',
        PURCHASE_ORDER: 'purchase-order',
      };

      const promptFile = `${docTypeMap[sample.documentType]}.md`;
      let prompt: string;
      try {
        prompt = loadPrompt(promptFile);
      } catch {
        prompt = `Extract all fields from this ${sample.documentType.toLowerCase().replace('_', ' ')} document. Return JSON.`;
      }

      const example = {
        id: sample.id,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: `images/${imageFilename}` },
              { type: 'text', text: prompt },
            ],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: JSON.stringify(groundTruth) },
            ],
          },
        ],
      };

      jsonlLines.push(JSON.stringify(example));
    }

    // Write JSONL
    const jsonlPath = path.join(exportDir, 'train.jsonl');
    fs.writeFileSync(jsonlPath, jsonlLines.join('\n'));

    // Write metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      format,
      totalSamples: jsonlLines.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const sample of samples) {
      metadata.byType[sample.documentType] =
        (metadata.byType[sample.documentType] || 0) + 1;
      metadata.byStatus[sample.status] =
        (metadata.byStatus[sample.status] || 0) + 1;
    }

    fs.writeFileSync(
      path.join(exportDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
    );

    // Create ZIP
    const zipPath = path.join(this.uploadDir, 'exports', `${exportId}.zip`);
    await this.createZip(exportDir, zipPath);

    // Save export record
    const exportRecord = await this.prisma.export.create({
      data: {
        name: exportId,
        format,
        documentType: documentType ?? null,
        sampleCount: jsonlLines.length,
        filePath: zipPath,
      },
    });

    // Clean up unzipped dir
    fs.rmSync(exportDir, { recursive: true, force: true });

    return exportRecord;
  }

  async exportForVertexAI(params: {
    documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';
    minStatus?: 'LABELED' | 'VERIFIED';
  }) {
    const bucketName = this.config.get('GCS_BUCKET');
    if (!this.gcs || !bucketName) {
      throw new Error('GCS not configured. Set GCS_BUCKET in .env.');
    }

    const { documentType, minStatus = 'LABELED' } = params;
    const statusFilter = minStatus === 'VERIFIED' ? ['VERIFIED'] : ['LABELED', 'VERIFIED'];
    const where: any = { status: { in: statusFilter } };
    if (documentType) where.documentType = documentType;

    const samples = await this.prisma.sample.findMany({ where });
    if (samples.length === 0) throw new NotFoundException('No labeled samples found');

    const bucket = this.gcs.bucket(bucketName);
    const ts = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
    const exportId = `vertex-${ts}`;
    const gcsPrefix = `training/${exportId}`;

    // Load shared system instruction
    let systemPrompt: string;
    try { systemPrompt = loadPrompt('shared-rules.md').trim(); } catch { systemPrompt = ''; }

    const jsonlLines: string[] = [];

    for (const sample of samples) {
      const groundTruth = sample.groundTruth as Record<string, any>;
      if (!groundTruth) continue;

      const ext = path.extname(sample.filePath).toLowerCase();
      const originalPath = sample.filePath;
      if (!fs.existsSync(originalPath)) {
        this.logger.warn(`File not found: ${originalPath}, skipping`);
        continue;
      }

      // Upload image(s) to GCS
      const gcsUris: Array<{ uri: string; mimeType: string }> = [];

      if (ext === '.pdf') {
        // Convert PDF pages to PNG and upload each
        try {
          const { fromBuffer } = await import('pdf2pic');
          const buffer = fs.readFileSync(originalPath);
          const converter = fromBuffer(buffer, {
            density: 200, format: 'png', width: 2048, height: 2867,
          });
          const pages = await converter.bulk(-1, { responseType: 'buffer' });
          for (let i = 0; i < pages.length; i++) {
            if (pages[i].buffer) {
              const gcsPath = `${gcsPrefix}/images/${sample.id}_page${i + 1}.png`;
              await bucket.file(gcsPath).save(pages[i].buffer!, { contentType: 'image/png' });
              gcsUris.push({ uri: `gs://${bucketName}/${gcsPath}`, mimeType: 'image/png' });
            }
          }
        } catch (err) {
          this.logger.warn(`PDF conversion failed for ${sample.id}: ${err}`);
          // Fallback: upload PDF directly (Gemini supports native PDF)
          const gcsPath = `${gcsPrefix}/images/${sample.id}.pdf`;
          await bucket.file(gcsPath).save(fs.readFileSync(originalPath), { contentType: 'application/pdf' });
          gcsUris.push({ uri: `gs://${bucketName}/${gcsPath}`, mimeType: 'application/pdf' });
        }
      } else {
        // Image file — upload directly
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        const gcsPath = `${gcsPrefix}/images/${sample.id}${ext}`;
        await bucket.file(gcsPath).save(fs.readFileSync(originalPath), { contentType: mimeType });
        gcsUris.push({ uri: `gs://${bucketName}/${gcsPath}`, mimeType });
      }

      // Load doc-type-specific prompt
      const docTypeMap: Record<string, string> = {
        DELIVERY_NOTE: 'delivery-note.md', INVOICE: 'invoice.md', PURCHASE_ORDER: 'purchase-order.md',
      };
      let docPrompt: string;
      try { docPrompt = loadPrompt(docTypeMap[sample.documentType]); } catch {
        docPrompt = `Extract all fields from this ${sample.documentType} document. Return JSON.`;
      }

      // Clean ground truth — strip meta fields and nulls
      const cleanedGt = this.stripMetaAndNulls(groundTruth);

      // Build Vertex AI training example
      const example: any = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: docPrompt },
              ...gcsUris.map(({ uri, mimeType }) => ({
                fileData: { mimeType, fileUri: uri },
              })),
            ],
          },
          {
            role: 'model',
            parts: [{ text: JSON.stringify(cleanedGt) }],
          },
        ],
      };

      if (systemPrompt) {
        example.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      jsonlLines.push(JSON.stringify(example));
    }

    // Upload train.jsonl to GCS
    const jsonlContent = jsonlLines.join('\n');
    const jsonlGcsPath = `${gcsPrefix}/train.jsonl`;
    await bucket.file(jsonlGcsPath).save(jsonlContent, { contentType: 'application/jsonl' });

    const gcsUri = `gs://${bucketName}/${jsonlGcsPath}`;
    this.logger.log(`Exported ${jsonlLines.length} samples to ${gcsUri}`);

    // Save export record
    const exportRecord = await this.prisma.export.create({
      data: {
        name: exportId,
        format: 'vertex-ai',
        documentType: documentType ?? null,
        sampleCount: jsonlLines.length,
        filePath: gcsUri,
      },
    });

    return { ...exportRecord, gcsUri, sampleCount: jsonlLines.length };
  }

  private stripMetaAndNulls(obj: any): any {
    if (Array.isArray(obj)) return obj.map((item) => this.stripMetaAndNulls(item));
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, val] of Object.entries(obj)) {
        if (META_FIELDS.includes(key)) continue;
        if (val === null || val === undefined) continue;
        result[key] = this.stripMetaAndNulls(val);
      }
      return result;
    }
    return obj;
  }

  async listExports() {
    return this.prisma.export.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExportPath(exportId: string): Promise<string> {
    return this.prisma.export
      .findUnique({ where: { id: exportId } })
      .then((exp) => {
        if (!exp || !exp.filePath) throw new NotFoundException('Export not found');
        if (!fs.existsSync(exp.filePath)) throw new NotFoundException('Export file not found');
        return exp.filePath;
      });
  }

  private createZip(sourceDir: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outPath);
      const archive = archiver.default('zip', { zlib: { level: 6 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}
