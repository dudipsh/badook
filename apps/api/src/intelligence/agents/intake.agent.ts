import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import type { DocumentType } from '../ocr/ocr.types';
import type { AgentContext, IntakeResult } from './agent.types';

/** Map subtypes to their processing type */
const TYPE_MAP: Partial<Record<DocumentType, DocumentType>> = {
  order_confirmation: 'purchase_order',
  credit_note: 'delivery_note',
};

@Injectable()
export class IntakeAgent {
  private readonly logger = new Logger(IntakeAgent.name);

  constructor(
    private readonly ocr: OcrService,
  ) {}

  async execute(context: AgentContext): Promise<IntakeResult> {
    this.logger.log(`Intake Agent processing: ${context.filePath}`);

    const detected = await this.ocr.detectDocumentType(
      context.filePath,
      context.companyId,
      context.originalFileName,
    );

    const isValid = detected.documentType !== 'unknown';
    const mappedType = TYPE_MAP[detected.documentType] || detected.documentType;

    const result: IntakeResult = {
      documentType: mappedType,
      isValid,
      confidence: detected.confidence,
      reason: detected.reason,
    };

    this.logger.log(
      `Intake Agent result: type=${result.documentType}, valid=${result.isValid}, confidence=${(result.confidence * 100).toFixed(0)}%`,
    );

    return result;
  }
}
