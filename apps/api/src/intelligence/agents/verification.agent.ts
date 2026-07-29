import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import type { AgentContext, ExtractionResult, VerificationResult } from './agent.types';

@Injectable()
export class VerificationAgent {
  private readonly logger = new Logger(VerificationAgent.name);

  constructor(private readonly ocr: OcrService) {}

  async execute(context: AgentContext, extraction: ExtractionResult): Promise<VerificationResult> {
    this.logger.log(`Verifying extraction for ${context.filePath} (confidence: ${extraction.confidence})`);

    const extractedJson = JSON.stringify(extraction.parsedData, null, 2);
    const rawResponse = await this.ocr.verifyExtraction(context.filePath, context.companyId, extractedJson);

    try {
      const result = JSON.parse(rawResponse) as VerificationResult;
      const errorCount = result.issues?.filter((i) => i.severity === 'error').length ?? 0;
      const warnCount = result.issues?.filter((i) => i.severity === 'warning').length ?? 0;

      this.logger.log(
        `Verification result: valid=${result.isValid}, errors=${errorCount}, warnings=${warnCount}, shouldReExtract=${result.shouldReExtract}`,
      );

      return result;
    } catch {
      this.logger.warn('Failed to parse verification response, assuming valid');
      return { isValid: true, issues: [], confidence: extraction.confidence, shouldReExtract: false };
    }
  }
}
