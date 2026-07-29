import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Sample } from '../generated/prisma-client';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../common/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { QuerySamplesDto } from './dto/query-samples.dto';
import { UpdateGroundTruthDto } from './dto/update-ground-truth.dto';
import { MODEL_REGISTRY, type AiModelInfo, type ModelConfig } from '../common/ai-models';
import { RefDataService } from '../ref-data/ref-data.service';

const DOC_TYPE_MAP: Record<string, 'delivery_note' | 'invoice' | 'purchase_order'> = {
  DELIVERY_NOTE: 'delivery_note',
  INVOICE: 'invoice',
  PURCHASE_ORDER: 'purchase_order',
};

@Injectable()
export class LabelingService {
  private readonly logger = new Logger(LabelingService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
    private readonly config: ConfigService,
    private readonly refDataService: RefDataService,
  ) {
    this.uploadDir = this.config.get('UPLOAD_DIR') || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private decodeFileName(rawName: string): string {
    try {
      return Buffer.from(rawName, 'latin1').toString('utf8');
    } catch {
      return rawName;
    }
  }

  async uploadAndExtract(
    file: Express.Multer.File,
    documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER',
  ): Promise<Sample[]> {
    const originalFileName = this.decodeFileName(file.originalname);
    const ext = path.extname(originalFileName) || '.pdf';

    const sample = await this._createAndExtractSingle(
      file.buffer,
      originalFileName,
      ext,
      documentType,
    );
    return [sample];
  }

  /**
   * Import a sample with pre-existing ground truth — skips Gemini extraction.
   * Used for bulk historical imports where ground truth is already known.
   */
  async importWithGroundTruth(
    file: Express.Multer.File,
    documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER',
    groundTruth: Record<string, unknown>,
    overrideFileName?: string,
  ): Promise<Sample> {
    const originalFileName = overrideFileName
      ? overrideFileName
      : this.decodeFileName(file.originalname);
    const ext = path.extname(originalFileName) || '.png';

    const sample = await this.prisma.sample.create({
      data: {
        documentType,
        originalFileName,
        filePath: '',
        status: 'LABELED',
        groundTruth: groundTruth as Prisma.InputJsonValue,
        labeledAt: new Date(),
        tags: ['imported'],
      },
    });

    const sampleDir = path.join(this.uploadDir, sample.id);
    fs.mkdirSync(sampleDir, { recursive: true });
    const filePath = path.join(sampleDir, `original${ext}`);
    fs.writeFileSync(filePath, file.buffer);

    let pageCount = 1;
    if (ext.toLowerCase() === '.pdf') {
      try {
        const pdfDoc = await PDFDocument.load(file.buffer);
        pageCount = pdfDoc.getPageCount();
      } catch {
        /* default 1 */
      }
    }

    return this.prisma.sample.update({
      where: { id: sample.id },
      data: { filePath, pageCount },
    });
  }

  private async _createAndExtractSingle(
    buffer: Buffer,
    fileName: string,
    ext: string,
    documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER',
  ): Promise<Sample> {
    const sample = await this.prisma.sample.create({
      data: {
        documentType,
        originalFileName: fileName,
        filePath: '',
        status: 'PENDING',
      },
    });

    const sampleDir = path.join(this.uploadDir, sample.id);
    fs.mkdirSync(sampleDir, { recursive: true });
    const filePath = path.join(sampleDir, `original${ext}`);
    fs.writeFileSync(filePath, buffer);

    let pageCount = 1;
    if (ext.toLowerCase() === '.pdf') {
      try {
        const pdfDoc = await PDFDocument.load(buffer);
        pageCount = pdfDoc.getPageCount();
      } catch {
        /* default 1 */
      }
    }

    await this.prisma.sample.update({
      where: { id: sample.id },
      data: { filePath, pageCount },
    });

    try {
      const result = await this.ocrService.extract(
        filePath,
        DOC_TYPE_MAP[documentType],
        fileName,
      );

      const extractedData = result.data as unknown as Record<string, unknown>;

      // Check for content-based duplicates (same document number)
      const docNumber = this.extractDocumentNumber(extractedData);
      if (docNumber) {
        const duplicate = await this.findDuplicateByContent(sample.id, docNumber);
        if (duplicate) {
          fs.rmSync(sampleDir, { recursive: true, force: true });
          await this.prisma.sample.delete({ where: { id: sample.id } });
          throw new HttpException({
            statusCode: 409,
            existingId: duplicate.id,
            existingFileName: duplicate.originalFileName,
            documentNumber: docNumber.value,
          }, HttpStatus.CONFLICT);
        }
      }

      const detectedType = this.detectDocTypeFromExtraction(result.data);
      const finalDocType =
        detectedType && detectedType !== documentType ? detectedType : documentType;

      const updated = await this.prisma.sample.update({
        where: { id: sample.id },
        data: {
          status: 'AUTO_EXTRACTED',
          geminiExtraction: result.data as unknown as Prisma.InputJsonValue,
          geminiConfidence: result.confidence,
          geminiTokens: result.promptTokens + result.completionTokens,
          geminiCostUsd: result.costUsd,
          ...(finalDocType !== documentType && { documentType: finalDocType }),
        },
      });

      // Auto-ingest supplier + products into reference data
      this.refDataService.ingestFromExtraction(
        result.data as Record<string, any>,
        finalDocType,
      );

      return updated;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Extraction failed for ${sample.id}: ${err}`);
      return this.prisma.sample.update({
        where: { id: sample.id },
        data: { status: 'PENDING' },
      });
    }
  }

  private detectDocTypeFromExtraction(
    data: unknown,
  ): 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER' | null {
    const d = data as Record<string, unknown> | null | undefined;
    if (!d) return null;
    if (d.noteNumber != null && d.deliveryDate != null) return 'DELIVERY_NOTE';
    if (d.invoiceNumber != null && d.invoiceDate != null) return 'INVOICE';
    if (d.poNumber != null && d.orderDate != null) return 'PURCHASE_ORDER';
    return null;
  }

  private extractDocumentNumber(data: Record<string, unknown>): { field: string; value: string } | null {
    for (const field of ['noteNumber', 'invoiceNumber', 'poNumber']) {
      const val = data[field];
      if (typeof val === 'string' && val.trim()) {
        return { field, value: val.trim() };
      }
    }
    return null;
  }

  private async findDuplicateByContent(
    excludeId: string,
    docNumber: { field: string; value: string },
  ): Promise<Sample | null> {
    return this.prisma.sample.findFirst({
      where: {
        id: { not: excludeId },
        geminiExtraction: { path: [docNumber.field], equals: docNumber.value },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkDuplicate(
    fileName: string,
  ): Promise<{ isDuplicate: boolean; existingId: string | null; existingFileName: string | null }> {
    // Strip page suffix and extension: "doc (עמוד 1/3).pdf" → "doc"
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    const baseName = nameWithoutExt.replace(/\s*\(עמוד \d+\/\d+\)$/, '');
    const existing = await this.prisma.sample.findFirst({
      where: {
        originalFileName: { startsWith: baseName, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { isDuplicate: !!existing, existingId: existing?.id ?? null, existingFileName: existing?.originalFileName ?? null };
  }

  async findAll(
    query: QuerySamplesDto,
  ): Promise<{ samples: Sample[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, status, documentType, search } = query;
    const where: Prisma.SampleWhereInput = {};
    if (status) where.status = status as Prisma.EnumSampleStatusFilter;
    if (documentType) where.documentType = documentType as Prisma.EnumDocumentTypeFilter;
    if (search) {
      where.originalFileName = { contains: search, mode: 'insensitive' };
    }

    const [samples, total] = await Promise.all([
      this.prisma.sample.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sample.count({ where }),
    ]);

    return { samples, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Sample> {
    const sample = await this.prisma.sample.findUnique({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');
    return sample;
  }

  async updateGroundTruth(id: string, dto: UpdateGroundTruthDto): Promise<Sample> {
    const sample = await this.findOne(id);
    const updated = await this.prisma.sample.update({
      where: { id },
      data: {
        groundTruth: dto.groundTruth as Prisma.InputJsonValue,
        status: 'LABELED',
        labeledAt: new Date(),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    // Auto-ingest supplier + products into reference data
    const gt = dto.groundTruth as Record<string, any>;
    if (gt) {
      this.refDataService.ingestFromExtraction(gt, sample.documentType);
    }

    return updated;
  }

  async updateDocumentType(
    id: string,
    documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER',
  ): Promise<Sample> {
    await this.findOne(id); // verify exists
    return this.prisma.sample.update({
      where: { id },
      data: { documentType },
    });
  }

  async verify(id: string): Promise<Sample> {
    const sample = await this.findOne(id);
    if (sample.status !== 'LABELED') {
      throw new Error('Sample must be LABELED before verification');
    }
    return this.prisma.sample.update({
      where: { id },
      data: { status: 'VERIFIED' },
    });
  }

  async reExtract(id: string): Promise<Sample> {
    const sample = await this.findOne(id);
    const result = await this.ocrService.extract(
      sample.filePath,
      DOC_TYPE_MAP[sample.documentType],
      sample.originalFileName,
    );
    return this.prisma.sample.update({
      where: { id },
      data: {
        geminiExtraction: result.data as unknown as Prisma.InputJsonValue,
        geminiConfidence: result.confidence,
        geminiTokens: result.promptTokens + result.completionTokens,
        geminiCostUsd: result.costUsd,
        status: 'AUTO_EXTRACTED',
      },
    });
  }

  async reExtractFinetuned(id: string): Promise<Sample> {
    const sample = await this.findOne(id);

    this.logger.log(`Extracting sample ${id} with fine-tuned Gemini`);

    const result = await this.ocrService.extractWithFinetuned(
      sample.filePath,
      DOC_TYPE_MAP[sample.documentType],
      sample.originalFileName,
    );
    const confidence = typeof result.confidence === 'number' && !isNaN(result.confidence)
      ? result.confidence
      : null;

    return this.prisma.sample.update({
      where: { id },
      data: {
        finetunedExtraction: result.data as unknown as Prisma.InputJsonValue,
        finetunedConfidence: confidence,
      },
    });
  }

  getAvailableModels(): AiModelInfo[] {
    return MODEL_REGISTRY.map((model) => {
      let available: boolean;
      if (model.provider === 'google') {
        available = !!this.config.get(model.apiKeyEnv || 'GEMINI_API_KEY');
      } else if (model.provider === 'vertex-ai') {
        available = !!this.config.get('GCP_PROJECT_ID') && !!this.config.get('VERTEX_TUNED_MODEL');
      } else {
        available = false;
      }

      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        available,
        description: model.description,
      };
    });
  }

  async remove(id: string): Promise<Sample> {
    const sample = await this.findOne(id);
    // Delete files
    const sampleDir = path.dirname(sample.filePath);
    if (fs.existsSync(sampleDir)) {
      fs.rmSync(sampleDir, { recursive: true, force: true });
    }
    return this.prisma.sample.delete({ where: { id } });
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const [total, byStatus, byType] = await Promise.all([
      this.prisma.sample.count(),
      this.prisma.sample.groupBy({ by: ['status'], _count: true }),
      this.prisma.sample.groupBy({ by: ['documentType'], _count: true }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count]),
      ),
      byType: Object.fromEntries(
        byType.map((t) => [t.documentType, t._count]),
      ),
    };
  }

  getFilePath(sampleId: string): string {
    const dir = path.join(this.uploadDir, sampleId);
    if (!fs.existsSync(dir)) throw new NotFoundException('File not found');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('original'));
    if (files.length === 0) throw new NotFoundException('File not found');
    return path.join(dir, files[0]);
  }
}
