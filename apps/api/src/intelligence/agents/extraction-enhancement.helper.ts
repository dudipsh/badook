import { Logger } from '@nestjs/common';
import { ExtractionAgent } from './extraction.agent';
import { VerificationAgent } from './verification.agent';
import { PurchaseOrdersService } from '../../domain/purchase-orders/purchase-orders.service';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { JobProgressHelper } from './job-progress.helper';
import { debugDumpExtraction } from './orchestrator-utils';
import type { AgentContext, ExtractionResult } from './agent.types';
import * as fs from 'fs';

/**
 * Handles post-extraction enhancement phases: PO context re-extraction and verification.
 * Extracted from AgentOrchestratorService to reduce its size.
 */
export class ExtractionEnhancementHelper {
  private readonly logger = new Logger(ExtractionEnhancementHelper.name);

  constructor(
    private readonly extractionAgent: ExtractionAgent,
    private readonly verificationAgent: VerificationAgent,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly scanLogger: ScanLogger,
    private readonly jobProgress: JobProgressHelper,
  ) {}

  /** PO Context Enhancement: re-extract with PO line items as reference for better accuracy */
  async enhanceWithPOContext(context: AgentContext, extractionResult: ExtractionResult): Promise<ExtractionResult> {
    if (
      !extractionResult.poReference ||
      (extractionResult.documentType !== 'delivery_note' && extractionResult.documentType !== 'invoice')
    ) {
      return extractionResult;
    }

    try {
      const poRef = extractionResult.poReference.replace(/\D/g, '');
      if (poRef.length < 3) return extractionResult;

      const matchedPO = await this.purchaseOrders.findByReference(poRef, context.companyId);
      if (!matchedPO || matchedPO.lineItems.length === 0) return extractionResult;

      this.scanLogger.log(context.companyId, 'extraction', `נמצאה הזמנת רכש ${matchedPO.poNumber}, מחלץ מחדש עם הקשר`);
      const enhanced = await this.extractionAgent.executeWithPOContext(
        context,
        extractionResult.documentType,
        matchedPO.lineItems.map((li: any) => ({
          description: li.description,
          catalogNumber: li.catalogNumber,
          quantity: Number(li.quantity),
          unit: li.unit,
          unitPrice: li.unitPrice ? Number(li.unitPrice) : null,
          totalPrice: li.totalPrice ? Number(li.totalPrice) : null,
        })),
        matchedPO.poNumber,
      );
      const origItems = extractionResult.parsedData?.lineItems?.length ?? 0;
      const enhancedItems = enhanced.parsedData?.lineItems?.length ?? 0;
      // Only use re-extraction if it found strictly MORE items.
      // PO context can bias column reading (anchoring effect), so prefer the
      // original extraction when item count is equal or lower.
      if (enhancedItems > origItems) {
        this.logger.log(`PO context extraction found more items: ${origItems}→${enhancedItems} — using enhanced`);
        return enhanced;
      } else {
        this.logger.log(`PO context extraction: items ${origItems}→${enhancedItems} — keeping original (no improvement)`);
        return extractionResult;
      }
    } catch (err) {
      this.logger.warn(`PO context lookup failed, continuing with original: ${err}`);
      return extractionResult;
    }
  }

  /** Verify extraction quality and optionally re-extract with corrections */
  async runVerification(context: AgentContext, extractionResult: ExtractionResult): Promise<ExtractionResult> {
    // Skip verification for high-confidence extractions to save ~7s of Gemini API call
    const hadPoContext = extractionResult.poReference &&
      (extractionResult.documentType === 'delivery_note' || extractionResult.documentType === 'invoice');
    const skipVerification = extractionResult.confidence >= 0.95 && !hadPoContext;
    if (skipVerification) {
      this.logger.log(`Skipping verification: confidence=${extractionResult.confidence} (≥0.95)`);
      await this.jobProgress.emitStage(context, 'verification', 'done');
      return extractionResult;
    }

    await this.jobProgress.emitStage(context, 'verification', 'running');
    this.scanLogger.log(context.companyId, 'verification', 'מאמת חילוץ נתונים');
    try {
      const verification = await this.verificationAgent.execute(context, extractionResult);
      try {
        fs.appendFileSync('/tmp/pipeline-debug.log', `\n=== VERIFICATION_DECISION ===\nshouldReExtract=${verification.shouldReExtract}\ncorrectionInstructions=${verification.correctionInstructions || 'none'}\nissues=${JSON.stringify(verification.issues || [])}\n`);
      } catch { /* ignore */ }
      if (verification.shouldReExtract && verification.correctionInstructions) {
        // Check if re-extraction is worth the risk: each additional extraction
        // has a chance of introducing column swaps (qty/price).
        // Only re-extract for truly structural issues (missing items, supplier swap).
        const structuralIssues = new Set(['missing_items', 'supplier_customer_swap']);
        const hasMissingItems = (verification.issues || []).some(
          (i) => structuralIssues.has(i.issue),
        );

        if (!hasMissingItems) {
          this.logger.log('Verification found only minor issues — skipping re-extraction to avoid column swap risk');
          this.scanLogger.log(context.companyId, 'verification', 'בעיות קלות בלבד — ממשיך ללא חילוץ מחדש');
        } else {
          const issueDetails = (verification.issues || [])
            .map((i) => `${i.severity === 'error' ? '❌' : '⚠️'} ${i.field}: ${i.description}`)
            .join(' | ');
          this.scanLogger.log(context.companyId, 'verification', `נמצאו בעיות: ${issueDetails || verification.correctionInstructions}`);
          const corrected = await this.extractionAgent.executeWithCorrections(
            context,
            extractionResult.documentType,
            verification.correctionInstructions,
          );
          debugDumpExtraction('STEP3a_VERIFICATION_CORRECTED', corrected);
          const origItems = extractionResult.parsedData?.lineItems?.length ?? 0;
          const correctedItems = corrected.parsedData?.lineItems?.length ?? 0;
          // Accept correction only if it doesn't lose items and has reasonable confidence
          if (corrected.confidence >= 0.5 && correctedItems >= origItems) {
            this.logger.log(`Verification correction applied: confidence ${extractionResult.confidence} → ${corrected.confidence}`);
            extractionResult = corrected;
          } else {
            this.logger.log(`Verification correction rejected: items ${origItems}→${correctedItems}, confidence ${corrected.confidence}`);
          }
        }
      }
      debugDumpExtraction('STEP3_AFTER_VERIFICATION', extractionResult);
      await this.jobProgress.emitStage(context, 'verification', 'done');
    } catch (err) {
      this.logger.warn(`Verification failed, continuing with original extraction: ${err}`);
      await this.jobProgress.emitStage(context, 'verification', 'failed', 'verification error');
    }

    return extractionResult;
  }
}
