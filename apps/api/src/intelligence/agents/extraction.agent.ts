import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import type { AgentContext, IntakeResult, ExtractionResult } from './agent.types';
import type { DocumentType, ParsedDeliveryNote, ParsedInvoice, ParsedPurchaseOrder } from '../ocr/ocr.types';

@Injectable()
export class ExtractionAgent {
  private readonly logger = new Logger(ExtractionAgent.name);

  constructor(
    private readonly ocr: OcrService,
  ) {}

  async execute(context: AgentContext, intakeResult: IntakeResult): Promise<ExtractionResult> {
    this.logger.log(`Extraction Agent processing: ${intakeResult.documentType}`);
    return this.extract(context, intakeResult.documentType);
  }

  /** Re-run extraction with correction instructions from the verification agent. */
  async executeWithCorrections(
    context: AgentContext,
    documentType: DocumentType,
    correctionInstructions: string,
  ): Promise<ExtractionResult> {
    this.logger.log(`Re-extracting with corrections: ${correctionInstructions.slice(0, 100)}`);
    const suffix = `CORRECTION INSTRUCTIONS (fix these issues from previous attempt):\n${correctionInstructions}`;
    return this.extract(context, documentType, suffix);
  }

  /** Re-run extraction with PO line items as context to improve accuracy. */
  async executeWithPOContext(
    context: AgentContext,
    documentType: DocumentType,
    poLineItems: Array<{
      description: string;
      catalogNumber?: string | null;
      quantity: number;
      unit?: string | null;
      unitPrice?: number | null;
      totalPrice?: number | null;
    }>,
    poNumber: string,
  ): Promise<ExtractionResult> {
    const lineItemsText = poLineItems
      .map((item, i) => {
        const parts = [`${i + 1}. "${item.description}"`];
        if (item.catalogNumber) parts.push(`מק"ט: ${item.catalogNumber}`);
        if (item.unit) parts.push(`יחידה: ${item.unit}`);
        if (item.totalPrice != null) parts.push(`סה"כ שורה: ${item.totalPrice}`);
        return parts.join(', ');
      })
      .join('\n');

    const suffix =
      `REFERENCE PURCHASE ORDER (PO ${poNumber}):\n` +
      `The following items were ordered. Use ONLY for product identification (matching descriptions and catalog numbers). ` +
      `Do NOT use PO values to determine quantities or prices — read those from the ACTUAL document columns.\n\n` +
      lineItemsText + '\n\n' +
      `Extract what you SEE in the document. Read quantities and prices from the document's own table columns, NOT from this PO reference.`;

    this.logger.log(`Re-extracting with PO context: ${poNumber} (${poLineItems.length} items)`);
    return this.extract(context, documentType, suffix);
  }

  private async extract(
    context: AgentContext,
    docType: DocumentType,
    promptSuffix?: string,
  ): Promise<ExtractionResult> {
    // Combine splitContext (from multi-doc detection) with any explicit suffix
    const splitHint = context.splitContext
      ? `\nCONTEXT: This is a construction/procurement document extracted from a multi-document PDF. Document context: ${context.splitContext}. Apply Israeli construction industry knowledge when interpreting product names, units, and suppliers.`
      : '';
    const combinedSuffix = splitHint + (promptSuffix ? `\n${promptSuffix}` : '') || undefined;

    let parsedData: ParsedDeliveryNote | ParsedInvoice | ParsedPurchaseOrder;
    let supplierName: string;
    let totalAmount: number | null;
    let poReference: string | null;
    let confidence: number;

    switch (docType) {
      case 'invoice': {
        const parsed = await this.ocr.parseInvoice(context.filePath, context.companyId, combinedSuffix);
        parsedData = parsed;
        supplierName = parsed.supplierName || '';
        totalAmount = parsed.totalAmount;
        poReference = parsed.poReference;
        confidence = parsed.confidence;
        break;
      }
      case 'purchase_order': {
        const parsed = await this.ocr.parsePurchaseOrder(context.filePath, context.companyId, combinedSuffix);
        parsedData = parsed;
        supplierName = parsed.supplierName || '';
        totalAmount = parsed.totalAmount;
        poReference = null;
        confidence = parsed.confidence;
        break;
      }
      case 'delivery_note':
      default: {
        const parsed = await this.ocr.parseDeliveryNote(context.filePath, context.companyId, combinedSuffix);
        parsedData = parsed;
        supplierName = parsed.supplierName || '';
        totalAmount = parsed.totalAmount;
        poReference = parsed.poReference;
        confidence = parsed.confidence;
        break;
      }
    }

    if (!supplierName || supplierName === 'Unknown') {
      this.logger.warn(`Extraction Agent: Could not identify vendor for ${context.filePath}`);
    }

    const result: ExtractionResult = {
      documentType: docType as DocumentType,
      supplierName,
      totalAmount,
      poReference,
      confidence,
      parsedData,
    };

    this.logger.log(
      `Extraction Agent result: vendor="${supplierName}", amount=${totalAmount}, poRef=${poReference}, confidence=${(confidence * 100).toFixed(0)}%`,
    );

    return result;
  }
}
