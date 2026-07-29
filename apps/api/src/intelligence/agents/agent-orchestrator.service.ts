import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { IntakeAgent } from './intake.agent';
import { ExtractionAgent } from './extraction.agent';
import { MatchingAgent } from './matching.agent';
import { VerificationAgent } from './verification.agent';
import { DocumentSaverService } from './document-saver.service';
import { OcrService } from '../ocr/ocr.service';
import { DeliveryNotesService } from '../../domain/delivery-notes/delivery-notes.service';
import { PurchaseOrdersService } from '../../domain/purchase-orders/purchase-orders.service';
import { MatchingService } from '../../domain/matching/matching.service';
import { ProjectsService } from '../../domain/projects/projects.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobsService } from '../../infrastructure/jobs/jobs.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { JobProgressHelper } from './job-progress.helper';
import { MatchingTriggerHelper } from './matching-trigger.helper';
import { MultiSegmentConsolidationHelper } from './multi-segment-consolidation.helper';
import { FileProcessingHelper } from './file-processing.helper';
import { ExtractionEnhancementHelper } from './extraction-enhancement.helper';
import { isPrismaUniqueConstraintError, debugDumpExtraction } from './orchestrator-utils';
import type { AgentContext, AgentPipelineResult, ExtractionResult, IntakeResult, FileProcessingResult } from './agent.types';

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private readonly jobProgress: JobProgressHelper;
  private readonly matchingTrigger: MatchingTriggerHelper;
  private readonly fileProcessing: FileProcessingHelper;
  private readonly enhancement: ExtractionEnhancementHelper;

  constructor(
    private readonly intakeAgent: IntakeAgent,
    private readonly extractionAgent: ExtractionAgent,
    private readonly matchingAgent: MatchingAgent,
    private readonly verificationAgent: VerificationAgent,
    private readonly documentSaver: DocumentSaverService,
    private readonly ocr: OcrService,
    private readonly deliveryNotes: DeliveryNotesService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly matchingService: MatchingService,
    private readonly jobsService: JobsService,
    private readonly jobsGateway: JobsGateway,
    private readonly scanLogger: ScanLogger,
    private readonly projectsService: ProjectsService,
    private readonly prisma: PrismaService,
  ) {
    this.jobProgress = new JobProgressHelper(jobsService, jobsGateway);
    this.matchingTrigger = new MatchingTriggerHelper(matchingService, jobsGateway);
    const consolidation = new MultiSegmentConsolidationHelper(projectsService, prisma);
    this.fileProcessing = new FileProcessingHelper(
      ocr, deliveryNotes, scanLogger, this.matchingTrigger, consolidation,
      (ctx) => this.processDocument(ctx),
    );
    this.enhancement = new ExtractionEnhancementHelper(
      extractionAgent, verificationAgent, purchaseOrders, scanLogger, this.jobProgress,
    );
  }

  /** Exposed for external callers that need to fail a job (e.g. email scanner) */
  async failJob(context: AgentContext, errorMessage: string) {
    return this.jobProgress.failJob(context, errorMessage);
  }

  /**
   * File-level entry point: detects multi-doc PDFs, splits, and processes each segment.
   * Works for both email scan and manual upload.
   */
  async processFile(context: AgentContext): Promise<FileProcessingResult> {
    return this.fileProcessing.processFile(context);
  }

  async processDocument(context: AgentContext): Promise<AgentPipelineResult> {
    const pipelineStart = Date.now();
    const timer = (label: string) => this.logger.log(`⏱️ [TIMING] ${label}: ${Date.now() - pipelineStart}ms`);
    this.logger.log(`Pipeline start: ${context.filePath} (source: ${context.source})`);
    this.scanLogger.log(context.companyId, 'pipeline', 'מתחיל עיבוד מסמך', context.originalFileName || context.filePath);

    // --- Intake phase ---
    const intakeResult = await this.runIntake(context);
    if (!intakeResult.isValid) {
      return this.handleInvalidIntake(context, intakeResult);
    }
    timer('intake done');

    // --- Extraction phase ---
    await this.jobProgress.emitStage(context, 'extraction', 'running');
    this.scanLogger.log(context.companyId, 'extraction', 'מחלץ נתונים מהמסמך');
    let extractionResult = await this.extractionAgent.execute(context, intakeResult);
    timer('extraction done');
    debugDumpExtraction('STEP1_INITIAL_EXTRACTION', extractionResult);

    if (extractionResult.confidence < 0.2 || !extractionResult.supplierName) {
      return this.handleLowConfidenceExtraction(context, extractionResult);
    }

    await this.jobProgress.emitStage(context, 'extraction', 'done');
    this.scanLogger.log(context.companyId, 'extraction', `ספק: ${extractionResult.supplierName}`, `סוג: ${extractionResult.documentType}, confidence=${Math.round(extractionResult.confidence * 100)}%`);
    timer('extraction validated');

    // --- PO context enhancement + verification ---
    extractionResult = await this.enhancement.enhanceWithPOContext(context, extractionResult);
    timer('PO context done');
    debugDumpExtraction('STEP2_AFTER_PO_CONTEXT', extractionResult);

    extractionResult = await this.enhancement.runVerification(context, extractionResult);
    timer('verification done');

    // --- Save + match ---
    return this.saveAndMatch(context, extractionResult);
  }

  private async runIntake(context: AgentContext): Promise<IntakeResult> {
    if (context.detectedType) {
      const result: IntakeResult = {
        documentType: context.detectedType,
        isValid: true,
        confidence: 1,
        reason: 'pre-detected by file scanner',
      };
      await this.jobProgress.emitStage(context, 'intake', 'done');
      this.scanLogger.log(context.companyId, 'intake', `זוהה כ: ${result.documentType}`, 'זוהה בשלב סריקת הקובץ');
      return result;
    }

    await this.jobProgress.emitStage(context, 'intake', 'running');
    this.scanLogger.log(context.companyId, 'intake', 'בודק סוג מסמך', context.originalFileName);
    const result = await this.intakeAgent.execute(context);
    if (result.isValid) {
      await this.jobProgress.emitStage(context, 'intake', 'done');
      this.scanLogger.log(context.companyId, 'intake', `זוהה כ: ${result.documentType}`, `confidence=${Math.round((result.confidence ?? 0) * 100)}%`);
    }
    return result;
  }

  private async handleInvalidIntake(context: AgentContext, intakeResult: IntakeResult): Promise<AgentPipelineResult> {
    this.logger.warn(`Intake Agent rejected document: ${intakeResult.reason}`);
    this.scanLogger.log(context.companyId, 'intake', 'מסמך נדחה', intakeResult.reason);
    await this.jobProgress.emitStage(context, 'intake', 'failed', intakeResult.reason);
    const doc = await this.deliveryNotes.createFromParsed({
      supplierName: 'Unknown - Invalid Document',
      companyId: context.companyId,
      source: context.source,
      originalFileUrl: context.filePath,
      originalFileName: context.originalFileName,
      parsedData: { intakeResult, rejectedByAgent: 'INTAKE' },
      parsingConfidence: 0,
      createdById: context.userId,
      projectId: context.projectId,
    });
    await this.jobProgress.completeJob(context, doc.id, 'delivery_note');
    return {
      success: false,
      status: 'INVALID',
      documentType: intakeResult.documentType,
      documentId: doc.id,
      error: intakeResult.reason,
    };
  }

  private async handleLowConfidenceExtraction(context: AgentContext, extractionResult: ExtractionResult): Promise<AgentPipelineResult> {
    this.logger.warn(`Extraction Agent: low confidence or missing vendor`);
    this.scanLogger.log(context.companyId, 'extraction', 'חילוץ נכשל - ביטחון נמוך או ספק חסר');
    await this.jobProgress.emitStage(context, 'extraction', 'failed', 'low confidence');

    const dupMsg = await this.documentSaver.checkDuplicate(context.companyId, extractionResult);
    if (dupMsg) {
      this.logger.log(`Low-confidence duplicate detected — skipping save: ${dupMsg}`);
      this.scanLogger.log(context.companyId, 'pipeline', 'מסמך כפול לא קריא — דילוג', dupMsg, 'done');
      await this.jobProgress.failJob(context, dupMsg);
      return { success: false, status: 'DUPLICATE', documentType: extractionResult.documentType, error: dupMsg };
    }

    try {
      const doc = await this.documentSaver.saveDocument(context, extractionResult.documentType, extractionResult.parsedData, context.projectId ?? null);
      await this.jobProgress.completeJob(context, doc.id, extractionResult.documentType);
      return {
        success: false,
        status: 'ORPHANED',
        documentType: extractionResult.documentType,
        documentId: doc.id,
        orphanReason: 'Unreadable - low confidence or missing vendor',
      };
    } catch (error) {
      if (error instanceof ConflictException || isPrismaUniqueConstraintError(error)) {
        const msg = error instanceof ConflictException ? error.message : 'מסמך כפול';
        this.scanLogger.log(context.companyId, 'pipeline', 'דילוג על כפילות', msg, 'done');
        await this.jobProgress.failJob(context, msg);
        return { success: false, status: 'DUPLICATE', documentType: extractionResult.documentType, error: msg };
      }
      throw error;
    }
  }

  private async saveAndMatch(context: AgentContext, extractionResult: ExtractionResult): Promise<AgentPipelineResult> {
    // Duplicate check
    if (!context.force) {
      const dupMsg = await this.documentSaver.checkDuplicate(context.companyId, extractionResult);
      if (dupMsg) {
        this.scanLogger.log(context.companyId, 'pipeline', 'מסמך כפול — שמירה כמסמך יתום', dupMsg, 'done');
        try {
          await this.jobProgress.emitStage(context, 'saving', 'running');
          const savedDoc = await this.documentSaver.saveDuplicateAsOrphan(context, extractionResult, dupMsg);
          await this.jobProgress.emitStage(context, 'saving', 'done');
          await this.jobProgress.completeJob(context, savedDoc.id, extractionResult.documentType);
          return { success: true, status: 'ORPHANED', documentType: extractionResult.documentType, documentId: savedDoc.id, orphanReason: 'DUPLICATE' };
        } catch (saveErr) {
          this.logger.warn(`Failed to save duplicate as orphan: ${saveErr}`);
          await this.jobProgress.failJob(context, dupMsg);
          return { success: false, status: 'DUPLICATE', documentType: extractionResult.documentType, error: dupMsg };
        }
      }
    }

    // Matching phase
    let matchingResult: { projectId: string | null; matchMethod?: string | null; orphanReason?: string };
    if (extractionResult.documentType === 'purchase_order' && !context.projectId) {
      await this.jobProgress.emitStage(context, 'matching', 'running');
      this.scanLogger.log(context.companyId, 'matching', 'הזמנת רכש — שמירה כמסמך לא משויך לבדיקת המשתמש');
      matchingResult = { projectId: null, matchMethod: null, orphanReason: 'PO_AWAITING_REVIEW' };
      await this.jobProgress.emitStage(context, 'matching', 'done');
    } else {
      await this.jobProgress.emitStage(context, 'matching', 'running');
      this.scanLogger.log(context.companyId, 'matching', 'מחפש פרויקט מתאים');
      matchingResult = await this.matchingAgent.execute(context, extractionResult);
      await this.jobProgress.emitStage(context, 'matching', 'done');
      this.scanLogger.log(context.companyId, 'matching', matchingResult.projectId ? 'נמצאה התאמה לפרויקט' : 'לא נמצאה התאמה - מסמך יתומ');
    }

    // Saving phase
    await this.jobProgress.emitStage(context, 'saving', 'running');
    try {
      const doc = await this.documentSaver.saveDocument(context, extractionResult.documentType, extractionResult.parsedData, matchingResult.projectId);
      await this.jobProgress.emitStage(context, 'saving', 'done');
      await this.jobProgress.completeJob(context, doc.id, extractionResult.documentType);

      void this.documentSaver.compressAndPreserveOriginal(context.filePath, extractionResult.documentType, doc.id);

      if (!matchingResult.projectId) {
        if (!context.skipAutoMatch) {
          void this.matchingTrigger.triggerOrphanAutoMatch(context.companyId, extractionResult.supplierId);
        }
        return { success: false, status: 'ORPHANED', documentType: extractionResult.documentType, documentId: doc.id, orphanReason: matchingResult.orphanReason };
      }

      if (!context.skipAutoMatch) {
        void this.matchingTrigger.triggerAutoMatch(context.companyId, matchingResult.projectId);
      }

      return { success: true, status: 'COMPLETED', documentType: extractionResult.documentType, documentId: doc.id, projectId: matchingResult.projectId };
    } catch (error) {
      if (error instanceof ConflictException) {
        this.scanLogger.log(context.companyId, 'pipeline', 'דילוג על כפילות', error.message, 'done');
        return { success: false, status: 'DUPLICATE', documentType: extractionResult.documentType, error: error.message };
      }
      if (isPrismaUniqueConstraintError(error)) {
        const dupMsg = 'מסמך עם אותו מספר כבר קיים במערכת (העלאה מקבילית)';
        this.scanLogger.log(context.companyId, 'pipeline', 'דילוג על כפילות', dupMsg, 'done');
        return { success: false, status: 'DUPLICATE', documentType: extractionResult.documentType, error: dupMsg };
      }
      throw error;
    }
  }
}
