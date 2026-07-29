import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PromptsService } from '../prompts/prompts.service';
import { VisionApiService } from './vision-api.service';
import { DocumentDetectorService } from './document-detector.service';
import { preprocessImage } from '@budapest/ai-core';
import { extractPdfTextLayer, buildTextLayerHint, extractProjectNameFromTextLayer, extractDeliveryAddressFromTextLayer } from './pdf-text-extractor';
import { separateRemarksFromDescriptions } from './remarks-separator';
import { isSameSupplier } from '../../domain/matching/supplier-matcher';
import type {
  DocumentType,
  DetectedDocument,
  DocumentSegment,
  ParsedDeliveryNote,
  ParsedInvoice,
  ParsedPurchaseOrder,
} from './ocr.types';
import {
  validateMathematics,
  validateDiscounts,
  validateNoRounding,
  type ValidationResult,
} from './ocr-validators';
import {
  validateDeliveryNoteHeuristics,
  validateInvoiceHeuristics,
  validatePurchaseOrderHeuristics,
  validateDiscountQuantityConfusion,
  validateRowSplits,
  validateUnitPresence,
} from './ocr-heuristic-validators';
import {
  validateAndFixQuantityBreakdown,
  validateAndFixMissingQuantity,
  validateAndFixCartonQuantity,
  validateAndFixDecimalQuantity,
  validateLineItemMathConsistency,
} from './ocr-auto-fixes';

// Re-export types for backward compatibility
export type { DocumentType, DetectedDocument, DocumentSegment, ParsedDeliveryNote, ParsedInvoice, ParsedPurchaseOrder };

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    private readonly prompts: PromptsService,
    private readonly visionApi: VisionApiService,
    private readonly documentDetector: DocumentDetectorService,
    private readonly config: ConfigService,
  ) {}

  private async isAutoFixesEnabled(companyId: string): Promise<boolean> {
    const s = await this.prisma.companyScanSettings.findUnique({
      where: { companyId },
      select: { ocrAutoFixesEnabled: true },
    });
    return s?.ocrAutoFixesEnabled ?? true;
  }

  private get verbose(): boolean {
    return this.config.get<boolean>('scanLog.verbose') ?? true;
  }

  private logLineItems(stage: string, fname: string, items: any[]): void {
    if (!this.verbose || !Array.isArray(items)) return;
    this.logger.log(`[OCR-DEBUG] [${stage}] ${fname} — ${items.length} line items:`);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      this.logger.log(
        `[OCR-DEBUG] [${stage}] ${fname} | Line ${i + 1}: desc="${(it.description || '').slice(0, 50)}" qty=${it.quantity} unitPrice=${it.unitPrice} totalPrice=${it.totalPrice}`,
      );
    }
  }

  // --- Delegated to DocumentDetectorService ---

  async detectDocumentType(filePath: string, companyId: string, originalFileName?: string): Promise<DetectedDocument> {
    return this.documentDetector.detectDocumentType(filePath, companyId, originalFileName);
  }

  async detectDocumentsInFile(filePath: string, companyId: string, originalFileName?: string): Promise<DocumentSegment[]> {
    return this.documentDetector.detectDocumentsInFile(filePath, companyId, originalFileName);
  }

  // --- Parsing methods (kept in OcrService) ---

  async parseDeliveryNote(filePath: string, companyId: string, promptSuffix?: string): Promise<ParsedDeliveryNote> {
    const companyName = await this.getCompanyName(companyId);
    let prompt = this.prompts.getPrompt('EXTRACTION', 'delivery-note');
    if (companyName) prompt = this.appendCompanyContext(prompt, companyName);
    // Add text-layer hint for PDFs to reduce RTL/column confusion
    prompt = await this.appendTextLayerHint(prompt, filePath);
    if (promptSuffix) prompt += `\n\n${promptSuffix}`;
    let parsed = await this.visionApi.parseWithRetry<ParsedDeliveryNote>(filePath, companyId, prompt, 'OCR_PARSE_DN');
    parsed = await this.visionApi.attemptMathCorrection(parsed, filePath, companyId, prompt, 'OCR_PARSE_DN');
    parsed = this.fixSupplierCustomerSwap(parsed, companyName, filePath);

    // Detect warehouse column confusion: all items have the same small quantity
    if (parsed.lineItems?.length >= 2) {
      const qtys = parsed.lineItems.map((i) => i.quantity).filter((q) => q != null && q > 0);
      const allSame = qtys.length >= 2 && qtys.every((q) => q === qtys[0]);
      if (allSame && qtys[0] < 200) {
        this.logger.warn(
          `[warehouse-reextract] All ${qtys.length} items have qty=${qtys[0]} — re-extracting with warehouse correction`,
        );
        const correction =
          `\n\nCRITICAL CORRECTION: Your previous extraction read the "מחסן" (warehouse) column as quantity. ` +
          `All items had quantity=${qtys[0]}, which is the warehouse/branch number, NOT the delivered quantity. ` +
          `The REAL quantities are in the "כמות" column. Please re-read the TABLE HEADERS carefully: ` +
          `find the column labeled "כמות" (quantity) and extract the CORRECT values from that column. ` +
          `The "מחסן" column with value ${qtys[0]} is the warehouse ID — IGNORE it completely.`;
        let reparsed = await this.visionApi.parseWithRetry<ParsedDeliveryNote>(
          filePath, companyId, prompt + correction, 'OCR_PARSE_DN',
        );
        reparsed = await this.visionApi.attemptMathCorrection(reparsed, filePath, companyId, prompt + correction, 'OCR_PARSE_DN');
        reparsed = this.fixSupplierCustomerSwap(reparsed, companyName, filePath);
        // Verify re-extraction fixed the issue
        const newQtys = reparsed.lineItems?.map((i) => i.quantity).filter((q) => q != null && q > 0) || [];
        const stillSame = newQtys.length >= 2 && newQtys.every((q) => q === newQtys[0]) && newQtys[0] < 200;
        if (!stillSame) {
          this.logger.log(`[warehouse-reextract] Re-extraction fixed quantities: ${newQtys.join(', ')}`);
          parsed = reparsed;
        }
      }
    }

    // Subtotal-mismatch retry
    parsed = await this.retryOnSubtotalMismatch(parsed, filePath, companyId, prompt, 'OCR_PARSE_DN');

    const autoFixesEnabled = await this.isAutoFixesEnabled(companyId);
    return this.validateDocument(parsed, filePath, 'delivery_note', autoFixesEnabled);
  }

  async parseInvoice(filePath: string, companyId: string, promptSuffix?: string): Promise<ParsedInvoice> {
    const companyName = await this.getCompanyName(companyId);
    let prompt = this.prompts.getPrompt('EXTRACTION', 'invoice');
    if (companyName) prompt = this.appendCompanyContext(prompt, companyName);
    // Add text-layer hint for PDFs to reduce RTL/column confusion
    prompt = await this.appendTextLayerHint(prompt, filePath);
    if (promptSuffix) prompt += `\n\n${promptSuffix}`;
    let parsed = await this.visionApi.parseWithRetry<ParsedInvoice>(filePath, companyId, prompt, 'OCR_PARSE_INV');
    parsed = await this.visionApi.attemptMathCorrection(parsed, filePath, companyId, prompt, 'OCR_PARSE_INV');
    parsed = this.fixSupplierCustomerSwap(parsed, companyName, filePath);
    // Subtotal-mismatch retry
    parsed = await this.retryOnSubtotalMismatch(parsed, filePath, companyId, prompt, 'OCR_PARSE_INV');
    const autoFixesEnabled = await this.isAutoFixesEnabled(companyId);
    return this.validateDocument(parsed, filePath, 'invoice', autoFixesEnabled);
  }

  async parsePurchaseOrder(filePath: string, companyId: string, promptSuffix?: string): Promise<ParsedPurchaseOrder> {
    // Single-agent approach: one comprehensive prompt for the full PO
    let prompt = this.prompts.getPrompt('EXTRACTION', 'purchase-order');
    // Add text-layer hint for PDFs to reduce RTL/column confusion
    prompt = await this.appendTextLayerHint(prompt, filePath);
    if (promptSuffix) prompt += `\n\n${promptSuffix}`;
    let parsed = await this.visionApi.parseWithRetry<ParsedPurchaseOrder>(filePath, companyId, prompt, 'OCR_PARSE_PO');
    parsed = await this.visionApi.attemptMathCorrection(parsed, filePath, companyId, prompt, 'OCR_PARSE_PO');

    // Math consistency retry: if qty×unitPrice≠totalPrice for many items, the model
    // misread the table columns. Retry with explicit instruction.
    // Skipped when auto-fixes are disabled (user wants raw OCR results).
    const autoFixesEnabled = await this.isAutoFixesEnabled(companyId);
    if (autoFixesEnabled) {
      const mathCheck = validateLineItemMathConsistency(parsed as any);
      if (mathCheck.confidencePenalty > 0 && parsed.lineItems?.length) {
        this.logger.warn(`[PO math-retry] ${mathCheck.warnings.join('; ')} — retrying with explicit column instruction`);
        const retryPrompt = prompt +
          '\n\nCRITICAL: In the previous extraction, quantity × unitPrice did NOT equal totalPrice for many rows. ' +
          'Please re-read the table VERY carefully. For each row: find the "כמות" (quantity) column — it often has DECIMAL values like 60.48 or 110.88. ' +
          'The "מחיר יחידה" (unit price) column has the price per unit. The "סה"כ" (total) column = quantity × unit price. ' +
          'Make sure these three values are mathematically consistent for every row.';
        try {
          let reparsed = await this.visionApi.parseWithRetry<ParsedPurchaseOrder>(filePath, companyId, retryPrompt, 'OCR_PARSE_PO_MATH_RETRY');
          reparsed = await this.visionApi.attemptMathCorrection(reparsed, filePath, companyId, retryPrompt, 'OCR_PARSE_PO_MATH_RETRY');
          const retryCheck = validateLineItemMathConsistency(reparsed as any);
          if (retryCheck.confidencePenalty < mathCheck.confidencePenalty) {
            this.logger.log(`[PO math-retry] Retry improved math consistency — using retried result`);
            parsed = reparsed;
          }
        } catch (err) {
          this.logger.warn(`[PO math-retry] Retry failed: ${err}`);
        }
      }
    }

    // Subtotal-mismatch retry: when per-line math is consistent but sum ≠ subtotal
    parsed = await this.retryOnSubtotalMismatch(parsed, filePath, companyId, prompt, 'OCR_PARSE_PO');

    // Post-processing: deterministic project name / delivery address from text layer.
    // This catches cases where Gemini misses "פרויקט:" in the footer.
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      try {
        const buffer = await this.storage.getBuffer(filePath);
        const textLayer = await extractPdfTextLayer(buffer);
        if (textLayer) {
          if (!parsed.projectName) {
            const textLayerProject = extractProjectNameFromTextLayer(textLayer);
            if (textLayerProject) {
              this.logger.log(`[PO post-process] projectName recovered from text layer: "${textLayerProject}"`);
              parsed.projectName = textLayerProject;
            }
          }
          if (!parsed.deliveryAddress) {
            const textLayerAddress = extractDeliveryAddressFromTextLayer(textLayer);
            if (textLayerAddress) {
              this.logger.log(`[PO post-process] deliveryAddress recovered from text layer: "${textLayerAddress}"`);
              parsed.deliveryAddress = textLayerAddress;
            }
          }
        }
      } catch (err) {
        this.logger.debug(`[PO post-process] Text layer extraction failed: ${err}`);
      }
    }

    // Targeted header-field recovery for multi-page POs: if deliveryAddress or projectName
    // is still missing, extract from the last page alone where footer info is more visible.
    if ((!parsed.deliveryAddress || !parsed.projectName) && path.extname(filePath).toLowerCase() === '.pdf') {
      const headerFields = await this.extractPOHeaderFields(filePath, companyId);
      if (!parsed.deliveryAddress && headerFields.deliveryAddress) {
        this.logger.log(`[PO header-recovery] deliveryAddress recovered from last page: ${headerFields.deliveryAddress}`);
        parsed.deliveryAddress = headerFields.deliveryAddress;
      }
      if (!parsed.projectName && headerFields.projectName) {
        this.logger.log(`[PO header-recovery] projectName recovered from last page: "${headerFields.projectName}"`);
        parsed.projectName = headerFields.projectName;
      }
    }

    const validated = this.validateDocument(parsed, filePath, 'purchase_order', autoFixesEnabled);
    this.logLineItems('FINAL', path.basename(filePath), validated.lineItems || []);
    return validated;
  }


  /** Targeted extraction of header fields (supplier, delivery address, project) from the last PDF page.
   *  Renders the last page directly with mupdf — works for both local and S3 files, no temp files. */
  private async extractPOHeaderFields(filePath: string, companyId: string): Promise<Partial<ParsedPurchaseOrder>> {
    try {
      const buffer = await this.storage.getBuffer(filePath);
      const pdfDoc = await PDFDocument.load(buffer);
      const pageCount = pdfDoc.getPageCount();
      if (pageCount <= 1) return {};

      // Render last page directly with mupdf (no temp file needed, works for S3)
      const mupdf: any = await (Function('return import("mupdf")')());
      const m = mupdf.default || mupdf;
      const doc = m.Document.openDocument(buffer, 'application/pdf');
      const page = doc.loadPage(pageCount - 1);
      const matrix = m.Matrix.scale(3, 3);
      const pixmap = page.toPixmap(matrix, m.ColorSpace.DeviceRGB);
      const processed = await preprocessImage(Buffer.from(pixmap.asPNG()), 'pdf-scanned');
      const images = [{ base64: processed.toString('base64'), mimeType: 'image/png' as const }];

      const headerPrompt = `Extract ONLY the following header fields from this purchase order header page. Do NOT extract line items.
Look carefully in:
  - Top-right area for "לכבוד:" section → supplierName, supplierAddress
  - Center header area for "כתובת למשלוח" / "כתובת למשלות" / "כתובת למשלנח" → deliveryAddress
  - Footer area for "פרויקט:" or "אתר:" → projectName

Return JSON: {"supplierName": "string or null", "supplierAddress": "string or null", "deliveryAddress": "string or null", "projectName": "string or null"}`;

      const provider = await this.visionApi.getProvider(companyId);
      const content = await this.visionApi.callVisionApi(images, headerPrompt, provider, companyId, 'OCR_PO_HEADER');
      return this.visionApi.safeParseJson<Partial<ParsedPurchaseOrder>>(content, `${filePath}:last-page`);
    } catch (err) {
      this.logger.debug(`[PO header-recovery] Failed: ${err}`);
      return {};
    }
  }

  /** Verify extraction output against original image. Used by VerificationAgent. */
  async verifyExtraction(filePath: string, companyId: string, extractedJson: string): Promise<string> {
    const provider = await this.visionApi.getProvider(companyId);
    const { images } = await this.visionApi.readFile(filePath, 'normal', provider);
    const basePrompt = this.prompts.getPrompt('EXTRACTION', 'verification');
    const prompt = basePrompt.replace('{{EXTRACTED_JSON}}', extractedJson);
    return this.visionApi.callVisionApi(images, prompt, provider, companyId, 'OCR_VERIFY');
  }

  /**
   * For PDF files, extract the text layer and append it as a hint to the prompt.
   * This dramatically improves extraction accuracy by giving the AI a "cheat sheet"
   * that shows the correct text content (especially for Hebrew RTL documents).
   */
  private async appendTextLayerHint(prompt: string, filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') return prompt;

    try {
      const buffer = await this.storage.getBuffer(filePath);
      const textLayer = await extractPdfTextLayer(buffer);
      if (textLayer) {
        this.logger.log(`[text-layer] Appending ${textLayer.length} chars of text layer to prompt`);
        return prompt + buildTextLayerHint(textLayer);
      }
    } catch (err) {
      this.logger.debug(`[text-layer] Failed to extract text layer: ${err}`);
    }
    return prompt;
  }

  private async getCompanyName(companyId: string): Promise<string | null> {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      return company?.name || null;
    } catch {
      return null;
    }
  }

  /** Append the company's own name to the prompt so the LLM knows which entity is "us" (the customer). */
  private appendCompanyContext(prompt: string, companyName: string): string {
    return prompt +
      `\n\nIMPORTANT CONTEXT: The document recipient (customer) company is "${companyName}". ` +
      `If you see this name (or a similar variation) in the "לכבוד" section, it is the CUSTOMER — do NOT extract it as supplierName. ` +
      `The supplier is the company in the document header/logo area.`;
  }

  /**
   * Post-processing guard: if the OCR model extracted the company's OWN name as the supplier
   * (confusing the "לכבוד" customer section with the header), swap supplier ↔ customer.
   */
  private fixSupplierCustomerSwap<T extends { supplierName: string; customerName: string | null }>(
    parsed: T, companyName: string | null, filePath: string,
  ): T {
    if (!companyName || !parsed.supplierName || !parsed.customerName) return parsed;

    if (isSameSupplier(parsed.supplierName, companyName)) {
      this.logger.warn(
        `[supplier-swap] "${parsed.supplierName}" matches company name "${companyName}" — ` +
        `swapping with customerName "${parsed.customerName}" (${path.basename(filePath)})`,
      );
      return { ...parsed, supplierName: parsed.customerName, customerName: parsed.supplierName };
    }
    return parsed;
  }

  /**
   * Detects when per-line math is consistent but sum of lines ≠ subtotal,
   * meaning the model fabricated consistent values. Retries with READ instruction.
   */
  private async retryOnSubtotalMismatch<T extends { subtotal?: number | null; lineItems?: any[]; confidence: number; notes?: string | null }>(
    parsed: T, filePath: string, companyId: string, prompt: string, operation: string,
  ): Promise<T> {
    if (!parsed.subtotal || !parsed.lineItems || parsed.lineItems.length < 2) return parsed;

    const lineTotals = parsed.lineItems
      .map((i: any) => Number(i.totalPrice) || 0)
      .filter((t: number) => t > 0);
    if (lineTotals.length === 0) return parsed;

    const computedSubtotal = lineTotals.reduce((a: number, b: number) => a + b, 0);
    const subtotalError = Math.abs(computedSubtotal - parsed.subtotal) / parsed.subtotal;

    // Check if per-line math is consistent (fabricated values pattern)
    const perLineMathOk = parsed.lineItems.every((i: any) => {
      const q = Number(i.quantity) || 0, u = Number(i.unitPrice) || 0, t = Number(i.totalPrice) || 0;
      if (q <= 0 || u <= 0 || t <= 0) return true;
      return Math.abs(q * u - t) / t <= 0.02;
    });

    if (subtotalError <= 0.05 || !perLineMathOk) return parsed;

    this.logger.warn(
      `[subtotal-retry] ${path.basename(filePath)}: Sum of lines=${computedSubtotal.toFixed(2)} vs subtotal=${parsed.subtotal} ` +
      `(${(subtotalError * 100).toFixed(1)}% error) — per-line math consistent, retrying with READ instruction`,
    );

    const retryPrompt = prompt +
      '\n\nCRITICAL CORRECTION: Your previous extraction produced line totals that sum to ' + computedSubtotal.toFixed(2) +
      ' but the document subtotal is ' + parsed.subtotal + '. This means you CALCULATED values instead of READING them. ' +
      'DO NOT calculate totalPrice from quantity × unitPrice. DO NOT calculate quantity from totalPrice ÷ unitPrice. ' +
      'READ each value INDEPENDENTLY from its own cell in the table. ' +
      'Quantities in construction documents are often DECIMAL (e.g., 60.62 מ"ר, 110.88 מ"א). ' +
      'Read the exact number including all decimal places. Do NOT round 60.62 to 60.';

    try {
      let reparsed = await this.visionApi.parseWithRetry<T>(filePath, companyId, retryPrompt, `${operation}_SUBTOTAL_RETRY`);
      reparsed = await this.visionApi.attemptMathCorrection(reparsed, filePath, companyId, retryPrompt, `${operation}_SUBTOTAL_RETRY`);

      const newLineTotals = (reparsed.lineItems || [])
        .map((i: any) => Number(i.totalPrice) || 0)
        .filter((t: number) => t > 0);
      const newComputedSubtotal = newLineTotals.reduce((a: number, b: number) => a + b, 0);
      const newSubtotalError = (reparsed as any).subtotal
        ? Math.abs(newComputedSubtotal - (reparsed as any).subtotal) / (reparsed as any).subtotal
        : subtotalError;

      if (newSubtotalError < subtotalError) {
        this.logger.log(
          `[subtotal-retry] ${path.basename(filePath)}: Improved — error ${(subtotalError * 100).toFixed(1)}% → ${(newSubtotalError * 100).toFixed(1)}%`,
        );
        return reparsed;
      }
      this.logger.log(`[subtotal-retry] ${path.basename(filePath)}: Retry did not improve — keeping original`);
    } catch (err) {
      this.logger.warn(`[subtotal-retry] ${path.basename(filePath)}: Retry failed: ${err}`);
    }
    return parsed;
  }

  private validateDocument<T extends { confidence: number; notes?: string | null; lineItems?: any[] }>(
    parsed: T, filePath: string, docType: DocumentType, autoFixesEnabled = true,
  ): T {
    // 0. Post-process: separate remarks that leaked into descriptions
    if (parsed.lineItems?.length) {
      parsed = { ...parsed, lineItems: separateRemarksFromDescriptions(parsed.lineItems) };
    }

    // 1. Mathematical validation (all document types)
    const mathResult = validateMathematics(parsed);

    // 2. Type-specific heuristics
    let heuristicResult: ValidationResult = { warnings: [], confidencePenalty: 0 };
    switch (docType) {
      case 'delivery_note':
        heuristicResult = validateDeliveryNoteHeuristics(parsed as any);
        break;
      case 'invoice':
        heuristicResult = validateInvoiceHeuristics(parsed as any);
        break;
      case 'purchase_order':
        heuristicResult = validatePurchaseOrderHeuristics(parsed as any);
        break;
    }

    // 3-4. Auto-fixes (conditionally applied based on company setting)
    const noopResult: ValidationResult = { warnings: [], confidencePenalty: 0 };
    const breakdownResult = autoFixesEnabled ? validateAndFixQuantityBreakdown(parsed as any) : noopResult;
    const cartonResult = autoFixesEnabled ? validateAndFixCartonQuantity(parsed as any) : noopResult;
    const missingQtyResult = autoFixesEnabled ? validateAndFixMissingQuantity(parsed as any) : noopResult;
    const decimalQtyResult = autoFixesEnabled ? validateAndFixDecimalQuantity(parsed as any) : noopResult;
    const mathConsistencyResult = autoFixesEnabled ? validateLineItemMathConsistency(parsed as any) : noopResult;
    // 5. Cross-cutting validators
    const discountResult = validateDiscounts(parsed as any);
    const discountQtyResult = validateDiscountQuantityConfusion(parsed as any);
    const rowSplitResult = validateRowSplits(parsed as any);
    const unitResult = validateUnitPresence(parsed as any);
    const roundingResult = validateNoRounding(parsed as any);

    // Log individual auto-fix actions for debugging
    const fname = path.basename(filePath);
    const autoFixWarnings = [
      ...breakdownResult.warnings, ...cartonResult.warnings,
      ...missingQtyResult.warnings, ...decimalQtyResult.warnings,
    ];
    if (this.verbose && autoFixWarnings.length > 0) {
      this.logger.log(`[OCR-DEBUG] [AUTO-FIX] ${fname} — ${autoFixWarnings.length} fixes applied:`);
      for (const w of autoFixWarnings) {
        this.logger.log(`[OCR-DEBUG] [AUTO-FIX] ${fname} | ${w}`);
      }
    }

    // 6. Combine results
    const allWarnings = [
      ...mathResult.warnings, ...heuristicResult.warnings,
      ...breakdownResult.warnings, ...cartonResult.warnings,
      ...missingQtyResult.warnings, ...decimalQtyResult.warnings,
      ...mathConsistencyResult.warnings,
      ...discountResult.warnings, ...discountQtyResult.warnings,
      ...rowSplitResult.warnings, ...unitResult.warnings,
      ...roundingResult.warnings,
    ];
    const totalPenalty = mathResult.confidencePenalty + heuristicResult.confidencePenalty
      + breakdownResult.confidencePenalty + cartonResult.confidencePenalty
      + missingQtyResult.confidencePenalty + mathConsistencyResult.confidencePenalty
      + discountResult.confidencePenalty + discountQtyResult.confidencePenalty
      + rowSplitResult.confidencePenalty + unitResult.confidencePenalty
      + roundingResult.confidencePenalty;

    if (allWarnings.length === 0) return parsed;

    const adjustedConfidence = Math.max(0, (parsed.confidence || 0.8) - totalPenalty);
    this.logger.warn(
      `[${docType} Validation] ${path.basename(filePath)}: ${allWarnings.join('; ')} → confidence ${parsed.confidence} → ${adjustedConfidence}`,
    );

    return {
      ...parsed,
      confidence: adjustedConfidence,
      notes: [parsed.notes, `[OCR Warnings: ${allWarnings.join('; ')}]`].filter(Boolean).join(' '),
    };
  }
}
