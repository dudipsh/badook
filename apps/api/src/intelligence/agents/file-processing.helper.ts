import { Logger } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import { DeliveryNotesService } from '../../domain/delivery-notes/delivery-notes.service';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { TYPE_MAP } from './orchestrator-utils';
import { MatchingTriggerHelper } from './matching-trigger.helper';
import { MultiSegmentConsolidationHelper } from './multi-segment-consolidation.helper';
import type { AgentContext, AgentPipelineResult, FileProcessingResult } from './agent.types';
import type { DocumentType } from '../ocr/ocr.types';

/**
 * Handles file-level processing: multi-doc PDF detection, splitting, and per-segment dispatch.
 * Extracted from AgentOrchestratorService to reduce its size.
 */
export class FileProcessingHelper {
  private readonly logger = new Logger(FileProcessingHelper.name);

  constructor(
    private readonly ocr: OcrService,
    private readonly deliveryNotes: DeliveryNotesService,
    private readonly scanLogger: ScanLogger,
    private readonly matchingTrigger: MatchingTriggerHelper,
    private readonly consolidation: MultiSegmentConsolidationHelper,
    private readonly processDocumentFn: (context: AgentContext) => Promise<AgentPipelineResult>,
  ) {}

  /**
   * File-level entry point: detects multi-doc PDFs, splits, and processes each segment.
   * Works for both email scan and manual upload.
   */
  async processFile(context: AgentContext): Promise<FileProcessingResult> {
    const filename = context.originalFileName || context.filePath;
    const fileStart = Date.now();
    this.logger.log(`File pipeline start: ${filename}`);
    this.scanLogger.log(context.companyId, 'ocr', `מזהה מסמכים בקובץ: ${filename}`);

    const segments = await this.ocr.detectDocumentsInFile(context.filePath, context.companyId, context.originalFileName);
    this.logger.log(`⏱️ [TIMING] detectDocumentsInFile: ${Date.now() - fileStart}ms (${segments.length} segments)`);
    this.scanLogger.log(context.companyId, 'ocr', `זוהו ${segments.length} מסמכים בקובץ ${filename}`);

    // Process each segment, passing the pre-detected type to skip redundant IntakeAgent OCR call
    const results: FileProcessingResult = { processed: 0, skipped: 0, failed: 0, errors: [], documents: [] };

    // For multi-segment files (e.g. 19 delivery notes in one PDF), once a project is found
    // for the first segment, propagate it to all subsequent segments. This prevents OCR
    // misreads of handwritten addresses from creating multiple bogus projects.
    let sharedProjectId: string | null = context.projectId || null;

    for (const segment of segments) {
      if (segment.documentType === 'unknown') {
        this.scanLogger.log(context.companyId, 'ocr', `סוג לא מזוהה מתוך ${filename} — שומר כמסמך לא מקושר`, `עמודים ${segment.startPage}-${segment.endPage}`);
        try {
          const doc = await this.deliveryNotes.createFromParsed({
            supplierName: 'Unknown',
            companyId: context.companyId,
            source: context.source,
            originalFileUrl: segment.filePath,
            originalFileName: context.originalFileName,
            parsedData: { _unknownSegment: true, startPage: segment.startPage, endPage: segment.endPage },
            parsingConfidence: 0,
            createdById: context.userId,
            projectId: context.projectId,
          });
          results.documents.push({
            success: false,
            status: 'ORPHANED',
            documentType: 'unknown' as DocumentType,
            documentId: doc.id,
            orphanReason: 'Unidentified document type',
          });
          results.processed++;
        } catch (saveErr) {
          this.logger.warn(`Failed to save unknown segment: ${saveErr}`);
          results.skipped++;
        }
        continue;
      }

      // Map subtypes (order_confirmation → purchase_order, credit_note → delivery_note)
      const mappedType = (TYPE_MAP[segment.documentType] || segment.documentType) as DocumentType;

      const segCtx: AgentContext = {
        ...context,
        filePath: segment.filePath,
        detectedType: mappedType,
        splitContext: segment.description,
        // Defer auto-match to after all segments are processed (avoid N redundant runs)
        skipAutoMatch: segments.length > 1,
        // Share project across segments from the same file
        projectId: sharedProjectId || context.projectId,
      };

      try {
        this.scanLogger.log(context.companyId, 'ocr', `מעבד מסמך ${mappedType} (עמ' ${segment.startPage}-${segment.endPage}) מתוך ${filename}`);
        const docResult = await this.processDocumentFn(segCtx);
        results.documents.push(docResult);

        // Capture the first valid projectId for subsequent segments
        if (docResult.projectId && !sharedProjectId && segments.length > 1) {
          sharedProjectId = docResult.projectId;
          this.logger.log(`Multi-segment: using project ${sharedProjectId} for remaining segments of ${filename}`);
        }
        if (docResult.status === 'COMPLETED' || docResult.status === 'ORPHANED') {
          results.processed++;
          this.scanLogger.log(context.companyId, 'ocr', `מסמך ${mappedType} (עמ' ${segment.startPage}-${segment.endPage}): ${docResult.status}`, docResult.documentId || '');
        } else if (docResult.status === 'DUPLICATE' || docResult.status === 'SKIPPED_PO') {
          results.skipped++;
          this.scanLogger.log(context.companyId, 'ocr', `מסמך ${mappedType} (עמ' ${segment.startPage}-${segment.endPage}): ${docResult.status === 'SKIPPED_PO' ? 'הזמנה/הצעה — דילוג' : 'כפילות — דילוג'}`);
        } else {
          results.failed++;
          if (docResult.error) results.errors.push(docResult.error);
          this.scanLogger.log(context.companyId, 'ocr', `מסמך ${mappedType} (עמ' ${segment.startPage}-${segment.endPage}): נכשל`, docResult.error || '', 'error');
        }
      } catch (error) {
        results.failed++;
        const errMsg = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
        this.scanLogger.log(context.companyId, 'ocr', `שגיאה בעיבוד מסמך ${mappedType} (עמ' ${segment.startPage}-${segment.endPage}) מתוך ${filename}`, errMsg, 'error');
        results.errors.push(`${filename}:p${segment.startPage}-${segment.endPage}: ${errMsg}`);

        // Best-effort save to prevent data loss
        try {
          const doc = await this.deliveryNotes.createFromParsed({
            supplierName: 'Unknown',
            companyId: context.companyId,
            source: context.source,
            originalFileUrl: segment.filePath,
            originalFileName: context.originalFileName,
            parsedData: { _processingError: true, error: errMsg, startPage: segment.startPage, endPage: segment.endPage },
            parsingConfidence: 0,
            createdById: context.userId,
            projectId: context.projectId,
          });
          results.documents.push({
            success: false,
            status: 'ORPHANED',
            documentType: mappedType,
            documentId: doc.id,
            orphanReason: `Processing error: ${errMsg}`,
          });
        } catch (saveErr) {
          this.logger.error(`CRITICAL: Failed to save failed segment — document lost: ${saveErr}`);
        }
      }
    }

    // Multi-segment consolidation: unify orphaned segments into a single project
    if (segments.length > 1 && results.processed > 0) {
      await this.consolidation.consolidateOrphans(context, results);

      const completedDocs = results.documents.filter((d) => d.status === 'COMPLETED');
      const orphanedDocs = results.documents.filter((d) => d.status === 'ORPHANED');

      const projectIds = [...new Set(completedDocs.map((d) => d.projectId).filter(Boolean))];
      for (const pid of projectIds) {
        void this.matchingTrigger.triggerAutoMatch(context.companyId, pid!);
      }
      if (orphanedDocs.length > 0) {
        void this.matchingTrigger.triggerOrphanAutoMatch(context.companyId);
      }
    }

    return results;
  }
}
