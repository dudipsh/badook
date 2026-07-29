import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { PromptsService } from '../prompts/prompts.service';
import { VisionApiService } from './vision-api.service';
import type {
  DocumentType,
  DetectedDocument,
  DocumentSegment,
} from './ocr.types';

@Injectable()
export class DocumentDetectorService {
  private readonly logger = new Logger(DocumentDetectorService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prompts: PromptsService,
    private readonly visionApi: VisionApiService,
  ) {}

  async detectDocumentType(filePath: string, companyId: string, originalFileName?: string): Promise<DetectedDocument> {
    const provider = await this.visionApi.getProvider(companyId);
    const { images } = await this.visionApi.readFile(filePath, 'normal', provider);
    let prompt = this.prompts.getPrompt('INTAKE', 'type-detection');
    const nameHint = originalFileName || path.basename(filePath);
    if (nameHint) {
      const filenameTypeHint = this.inferTypeFromFilename(nameHint);
      if (filenameTypeHint) {
        prompt += `\n\nThe original filename is: "${nameHint}". The filename STRONGLY suggests this is a ${filenameTypeHint}. Unless the document content clearly contradicts this (e.g., shows a completely different document type header), classify as ${filenameTypeHint}. This is especially important for continuation pages that may lack headers.`;
      } else {
        prompt += `\n\nThe original filename is: "${nameHint}". Use the filename as an additional classification hint, but always verify against the document content.`;
      }
    }
    const content = await this.visionApi.callVisionApi(images, prompt, provider, companyId, 'OCR_DETECT_TYPE');
    try {
      return JSON.parse(content) as DetectedDocument;
    } catch {
      this.logger.error('Failed to parse document type response', content);
      return { documentType: 'unknown', documentSubtype: null, confidence: 0, reason: 'Parse error' };
    }
  }

  /** Infer document type from filename patterns. Returns null if ambiguous. */
  private inferTypeFromFilename(filename: string): DocumentType | null {
    const lower = filename.toLowerCase();
    // PO patterns: "PO24001915", "PO_123", "הזמנת רכש", "הזמנה"
    if (/\bpo\d{3,}/i.test(lower) || /\bpo[-_]\d/i.test(lower)) return 'purchase_order';
    if (filename.includes('הזמנת רכש') || filename.includes('הזמנה')) return 'purchase_order';
    // Invoice patterns: "INV", "חשבונית"
    if (/\binv\d{3,}/i.test(lower) || /\binvoice/i.test(lower)) return 'invoice';
    if (filename.includes('חשבונית')) return 'invoice';
    // DN patterns: "DN", "תעודת משלוח"
    if (/\bdn\d{3,}/i.test(lower)) return 'delivery_note';
    if (filename.includes('תעודת משלוח')) return 'delivery_note';
    return null;
  }

  async detectDocumentsInFile(filePath: string, companyId: string, originalFileName?: string): Promise<DocumentSegment[]> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== '.pdf') {
      const detected = await this.detectDocumentType(filePath, companyId, originalFileName);
      return [{ startPage: 1, endPage: 1, documentType: detected.documentType, documentNumber: null, filePath }];
    }

    const buffer = await this.storage.getBuffer(filePath);
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    this.logger.log(`PDF has ${pageCount} pages: ${path.basename(filePath)}`);

    if (pageCount === 1) {
      const detected = await this.detectDocumentType(filePath, companyId, originalFileName);
      return [{ startPage: 1, endPage: 1, documentType: detected.documentType, documentNumber: null, filePath }];
    }

    // Large PDFs (> 8 pages): sending all pages to Gemini at once times out.
    // Instead, detect type from the first page and assume each page is a separate document.
    // This handles batches of scanned delivery notes / invoices efficiently.
    const LARGE_PDF_PAGE_LIMIT = 8;
    if (pageCount > LARGE_PDF_PAGE_LIMIT) {
      this.logger.log(`Large PDF (${pageCount} pages): sampling first page for type detection`);
      const firstPagePath = await this.extractPdfPages(buffer, 1, 1, filePath);
      const firstDetected = await this.detectDocumentType(firstPagePath, companyId, originalFileName);
      this.logger.log(`Large PDF: first page type = ${firstDetected.documentType}, applying to all ${pageCount} pages`);
      const segments: DocumentSegment[] = [{ startPage: 1, endPage: 1, documentType: firstDetected.documentType, documentNumber: null, filePath: firstPagePath }];
      for (let i = 2; i <= pageCount; i++) {
        const segPath = await this.extractPdfPages(buffer, i, i, filePath);
        segments.push({ startPage: i, endPage: i, documentType: firstDetected.documentType, documentNumber: null, filePath: segPath });
      }
      return segments;
    }

    const nameHint = originalFileName || path.basename(filePath);
    const filenameType = this.inferTypeFromFilename(nameHint);

    const provider = await this.visionApi.getProvider(companyId);
    const { images } = await this.visionApi.readFile(filePath, 'normal', provider);
    let multiPrompt = this.prompts.getPrompt('INTAKE', 'multi-doc-detection');
    if (nameHint) {
      if (filenameType) {
        multiPrompt += `\n\nThe original filename is: "${nameHint}". The filename contains "${filenameType}" patterns. Note: filenames may be named after a REFERENCED document (e.g., a file named "PO12345" might contain invoices/delivery notes that reference PO #12345). Always classify based on the actual document content.`;
      } else {
        multiPrompt += `\n\nThe original filename is: "${nameHint}". Use the filename as an additional classification hint.`;
      }
    }
    const content = await this.visionApi.callVisionApi(images, multiPrompt, provider, companyId, 'OCR_MULTI_DOC_DETECT');

    let detected: { documents: Array<{ startPage: number; endPage: number; documentType: DocumentType; documentNumber: string | null; description?: string }> };
    try {
      detected = this.visionApi.safeParseJson(content, filePath);
    } catch {
      this.logger.warn(`Multi-doc detection failed, falling back to per-page detection for ${path.basename(filePath)}`);
      return this.detectPerPage(buffer, pageCount, filePath, companyId);
    }

    if (!detected.documents || detected.documents.length === 0) {
      this.logger.warn(`No documents detected in multi-page PDF, falling back to per-page detection`);
      return this.detectPerPage(buffer, pageCount, filePath, companyId);
    }

    this.logger.log(`Detected ${detected.documents.length} documents: ${detected.documents.map(d => `${d.documentType}(${d.documentNumber || '?'}) p${d.startPage}-${d.endPage}`).join(', ')}`);

    // Safety net: if AI returned a single document spanning all pages of a multi-page PDF,
    // verify by checking each page individually. If pages have different types, split them.
    if (detected.documents.length === 1 && pageCount >= 2 && detected.documents[0].startPage <= 1 && detected.documents[0].endPage >= pageCount) {
      this.logger.log(`Single doc detected for ${pageCount}-page PDF — verifying each page individually`);
      const pageTypes: Array<{ page: number; type: DocumentType; number: string | null }> = [];
      for (let p = 1; p <= pageCount; p++) {
        const pagePath = await this.extractPdfPages(buffer, p, p, filePath);
        const det = await this.detectDocumentType(pagePath, companyId);
        pageTypes.push({ page: p, type: det.documentType, number: null });
      }
      const uniqueTypes = new Set(pageTypes.map(pt => pt.type));
      if (uniqueTypes.size > 1) {
        this.logger.warn(`Page-level verification found ${uniqueTypes.size} different types: ${pageTypes.map(pt => `p${pt.page}=${pt.type}`).join(', ')} — splitting`);
        const verifiedSegments: DocumentSegment[] = [];
        let i = 0;
        while (i < pageTypes.length) {
          const currentType = pageTypes[i].type;
          const start = pageTypes[i].page;
          let end = start;
          while (i + 1 < pageTypes.length && pageTypes[i + 1].type === currentType) {
            i++;
            end = pageTypes[i].page;
          }
          const segPath = await this.extractPdfPages(buffer, start, end, filePath);
          verifiedSegments.push({ startPage: start, endPage: end, documentType: currentType, documentNumber: null, filePath: segPath });
          i++;
        }
        return verifiedSegments;
      }
      this.logger.log(`Page-level verification confirmed: all pages are ${pageTypes[0].type}`);
    }

    // Fix overlapping page ranges (AI sometimes returns overlapping pages)
    detected.documents.sort((a: any, b: any) => a.startPage - b.startPage);
    for (let i = 1; i < detected.documents.length; i++) {
      if (detected.documents[i].startPage <= detected.documents[i - 1].endPage) {
        this.logger.warn(`Fixing page overlap: doc[${i - 1}] ends at ${detected.documents[i - 1].endPage}, doc[${i}] starts at ${detected.documents[i].startPage}`);
        detected.documents[i - 1].endPage = detected.documents[i].startPage - 1;
      }
    }

    const segments: DocumentSegment[] = [];
    for (const doc of detected.documents) {
      const start = Math.max(1, doc.startPage);
      const end = Math.min(pageCount, doc.endPage);
      const segmentPath = await this.extractPdfPages(buffer, start, end, filePath);
      segments.push({ startPage: start, endPage: end, documentType: doc.documentType as DocumentType, documentNumber: doc.documentNumber || null, filePath: segmentPath, description: doc.description });
    }

    // Gap detection: find pages not covered by any segment and detect them individually
    const gapPages = this.findPageGaps(segments, pageCount);
    if (gapPages.length > 0) {
      this.logger.warn(`Found ${gapPages.length} uncovered pages: [${gapPages.join(', ')}]. Detecting individually.`);
      for (const range of this.groupConsecutivePages(gapPages)) {
        const segPath = await this.extractPdfPages(buffer, range.start, range.end, filePath);
        const det = await this.detectDocumentType(segPath, companyId);
        segments.push({ startPage: range.start, endPage: range.end, documentType: det.documentType, documentNumber: null, filePath: segPath });
      }
      segments.sort((a, b) => a.startPage - b.startPage);
    }

    return segments;
  }

  /**
   * Fallback: detect each page individually and group consecutive same-type pages.
   * Used when multi-doc AI detection fails (parse error or empty result).
   */
  private async detectPerPage(buffer: Buffer, pageCount: number, filePath: string, companyId: string): Promise<DocumentSegment[]> {
    const pageTypes: Array<{ page: number; type: DocumentType }> = [];
    for (let p = 1; p <= pageCount; p++) {
      const pagePath = await this.extractPdfPages(buffer, p, p, filePath);
      const det = await this.detectDocumentType(pagePath, companyId);
      pageTypes.push({ page: p, type: det.documentType });
    }
    this.logger.log(`Per-page detection: ${pageTypes.map(pt => `p${pt.page}=${pt.type}`).join(', ')}`);

    // Group consecutive same-type pages into segments
    const segments: DocumentSegment[] = [];
    let i = 0;
    while (i < pageTypes.length) {
      const currentType = pageTypes[i].type;
      const start = pageTypes[i].page;
      let end = start;
      while (i + 1 < pageTypes.length && pageTypes[i + 1].type === currentType) {
        i++;
        end = pageTypes[i].page;
      }
      const segPath = await this.extractPdfPages(buffer, start, end, filePath);
      segments.push({ startPage: start, endPage: end, documentType: currentType, documentNumber: null, filePath: segPath });
      i++;
    }
    return segments;
  }

  findPageGaps(segments: DocumentSegment[], totalPages: number): number[] {
    const covered = new Set<number>();
    for (const seg of segments) {
      for (let p = seg.startPage; p <= seg.endPage; p++) covered.add(p);
    }
    const gaps: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!covered.has(p)) gaps.push(p);
    }
    return gaps;
  }

  groupConsecutivePages(pages: number[]): Array<{ start: number; end: number }> {
    if (pages.length === 0) return [];
    const ranges: Array<{ start: number; end: number }> = [];
    let start = pages[0], end = pages[0];
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === end + 1) { end = pages[i]; }
      else { ranges.push({ start, end }); start = pages[i]; end = pages[i]; }
    }
    ranges.push({ start, end });
    return ranges;
  }

  async extractPdfPages(sourceBuffer: Buffer, startPage: number, endPage: number, originalPath: string): Promise<string> {
    const sourcePdf = await PDFDocument.load(sourceBuffer);
    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let i = startPage - 1; i < endPage && i < sourcePdf.getPageCount(); i++) pageIndices.push(i);
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    for (const page of copiedPages) newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    const basename = path.basename(originalPath, '.pdf');

    if (this.storage.isS3Key(originalPath)) {
      const dir = path.dirname(originalPath);
      const segmentKey = `${dir}/${basename}_p${startPage}-${endPage}.pdf`;
      const segBuf = Buffer.from(pdfBytes);
      await this.storage.uploadWithKey(segBuf, segmentKey);
      // Verify: re-upload once if the object isn't readable (guards against silent failures
      // we've observed in production — segment extraction succeeded in-process but the file
      // disappeared from S3, leaving documents with a URL that 404s in the UI).
      if (!(await this.storage.exists(segmentKey))) {
        this.logger.warn(`Segment upload verification failed, retrying once: ${segmentKey}`);
        await this.storage.uploadWithKey(segBuf, segmentKey);
        if (!(await this.storage.exists(segmentKey))) {
          throw new Error(`Segment upload could not be verified: ${segmentKey}`);
        }
      }
      return segmentKey;
    }

    // Local dev: write to disk
    const dir = path.dirname(originalPath);
    await fs.mkdir(dir, { recursive: true });
    const segmentPath = path.join(dir, `${basename}_p${startPage}-${endPage}.pdf`);
    await fs.writeFile(segmentPath, pdfBytes);
    return segmentPath;
  }
}
