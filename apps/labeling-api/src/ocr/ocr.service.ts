import { Injectable, Logger } from '@nestjs/common';
import { VisionApiService } from './vision-api.service';
import { loadPrompt } from './prompt-loader';
import type {
  DocumentType,
  ParsedDeliveryNote,
  ParsedInvoice,
  ParsedPurchaseOrder,
} from './ocr.types';

export interface ExtractionResult {
  data: ParsedDeliveryNote | ParsedInvoice | ParsedPurchaseOrder;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly visionApi: VisionApiService,
  ) {}

  async extract(
    filePath: string,
    documentType: DocumentType,
    originalFileName?: string,
  ): Promise<ExtractionResult> {
    const promptFile = this.getPromptFile(documentType);
    let prompt = loadPrompt(promptFile);

    if (originalFileName) {
      prompt += `\n\nFILENAME HINT: The original filename is "${originalFileName}". It may contain the correct document number. If the number you read from the document image differs from a number in the filename, double-check — the filename is often more reliable for the document number.`;
    }

    this.logger.log(`Extracting ${documentType} from ${filePath}`);

    // Attempt 1: native PDF / normal preprocessing
    const images = await this.visionApi.readFile(filePath, 'normal');
    const { content, promptTokens, completionTokens } =
      await this.visionApi.callGemini(images, prompt);
    const data = this.visionApi.safeParseJson<any>(content, filePath);
    let totalPromptTokens = promptTokens;
    let totalCompletionTokens = completionTokens;

    // Check if key fields are missing — might be a scanned/handwritten doc
    const needsRetry = this.hasMissingKeyFields(data, documentType);

    if (needsRetry && filePath.toLowerCase().endsWith('.pdf')) {
      this.logger.log(`Missing key fields, retrying with binarized PNG for ${filePath}`);
      try {
        const binarizedImages = await this.visionApi.readFileAsImage(filePath, 'pdf-scanned');
        const retry = await this.visionApi.callGemini(binarizedImages, prompt);
        const retryData = this.visionApi.safeParseJson<any>(retry.content, filePath);
        totalPromptTokens += retry.promptTokens;
        totalCompletionTokens += retry.completionTokens;

        // Merge: fill in missing fields from retry
        this.mergeResults(data, retryData);
        this.logger.log(`Retry filled missing fields, merged confidence=${data.confidence}`);
      } catch (err) {
        this.logger.warn(`Retry with binarization failed: ${err}`);
      }
    }

    const costUsd = this.visionApi.estimateCost(totalPromptTokens, totalCompletionTokens);

    this.logger.log(
      `Extracted ${documentType}: confidence=${data.confidence}, lineItems=${data.lineItems?.length ?? 0}, cost=$${costUsd.toFixed(4)}`,
    );

    return {
      data,
      confidence: data.confidence ?? 0,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      costUsd,
    };
  }

  private hasMissingKeyFields(data: any, documentType: DocumentType): boolean {
    if (!data) return true;
    const missingCustomer = !data.customerName;
    const missingAddress = documentType === 'delivery_note' && !data.deliveryAddress;
    const missingProject = documentType === 'delivery_note' && !data.projectName;
    const noLineItems = !data.lineItems || data.lineItems.length === 0;
    const lowConfidence = (data.confidence ?? 0) < 0.6;
    return lowConfidence || noLineItems || (missingCustomer && (missingAddress || missingProject));
  }

  private mergeResults(target: any, source: any): void {
    const fieldsToFill = [
      'customerName', 'deliveryAddress', 'projectName', 'supplierName',
      'supplierAddress', 'supplierPhone', 'supplierBusinessId', 'notes',
    ];
    for (const field of fieldsToFill) {
      if (!target[field] && source[field]) {
        target[field] = source[field];
      }
    }
    // If target has no line items but source does, take source's
    if ((!target.lineItems || target.lineItems.length === 0) && source.lineItems?.length > 0) {
      target.lineItems = source.lineItems;
    }
    // Use higher confidence
    if ((source.confidence ?? 0) > (target.confidence ?? 0)) {
      target.confidence = source.confidence;
    }
  }

  async extractWithFinetuned(
    filePath: string,
    documentType: DocumentType,
    originalFileName?: string,
  ): Promise<ExtractionResult> {
    const promptFile = this.getPromptFile(documentType);
    let prompt = loadPrompt(promptFile);

    if (originalFileName) {
      prompt += `\n\nFILENAME HINT: The original filename is "${originalFileName}". It may contain the correct document number. If the number you read from the document image differs from a number in the filename, double-check — the filename is often more reliable for the document number.`;
    }

    this.logger.log(`Extracting ${documentType} with fine-tuned Gemini from ${filePath}`);

    const images = await this.visionApi.readFile(filePath, 'normal');
    const { content, promptTokens, completionTokens } =
      await this.visionApi.callGeminiFinetuned(images, prompt);
    const data = this.visionApi.safeParseJson<any>(content, filePath);

    const costUsd = this.visionApi.estimateCost(promptTokens, completionTokens);

    this.logger.log(
      `Fine-tuned Gemini extracted ${documentType}: confidence=${data.confidence}, lineItems=${data.lineItems?.length ?? 0}, cost=$${costUsd.toFixed(4)}`,
    );

    return {
      data,
      confidence: data.confidence ?? 0,
      promptTokens,
      completionTokens,
      costUsd,
    };
  }

  private getPromptFile(documentType: DocumentType): string {
    switch (documentType) {
      case 'delivery_note':
        return 'delivery-note.md';
      case 'invoice':
        return 'invoice.md';
      case 'purchase_order':
        return 'purchase-order.md';
      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }
  }
}
