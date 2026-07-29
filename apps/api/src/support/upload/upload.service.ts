import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DeliveryNotesService } from '../../domain/delivery-notes/delivery-notes.service';
import { AgentOrchestratorService } from '../../intelligence/agents/agent-orchestrator.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { ProjectBackfillService } from '../../domain/projects/project-backfill.service';
import { MatchingService } from '../../domain/matching/matching.service';
import { QUEUE_SERVICE, type QueueServiceInterface, type DocumentProcessingJobData } from '../../infrastructure/queue/queue.types';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import type { AgentContext } from '../../intelligence/agents/agent.types';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryNotes: DeliveryNotesService,
    private readonly agentOrchestrator: AgentOrchestratorService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly storage: StorageService,
    private readonly jobsGateway: JobsGateway,
    private readonly scanLogger: ScanLogger,
    private readonly backfillService: ProjectBackfillService,
    private readonly matchingService: MatchingService,
  ) {}

  private static readonly DOC_TYPE_MAP: Record<string, 'delivery_note' | 'invoice' | 'purchase_order'> = {
    DC: 'delivery_note',
    INVOICE: 'invoice',
    PO: 'purchase_order',
  };

  async processUpload(
    file: Express.Multer.File,
    companyId: string,
    source: 'EMAIL' | 'MOBILE' | 'MANUAL',
    userId?: string,
    projectId?: string,
    force = false,
    jobId?: string,
    docType?: string,
  ) {
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
    const maxUploadSizeMb = settings?.maxUploadSizeMb ?? 20;
    const maxBytes = maxUploadSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`הקובץ גדול מדי. הגודל המרבי המותר הוא ${maxUploadSizeMb}MB`);
    }

    // Multer/busboy decodes filenames as Latin-1; re-decode as UTF-8 for Hebrew support
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const savedPath = await this.saveFile(file, originalName, companyId);

    const context: AgentContext = {
      companyId,
      filePath: savedPath,
      source,
      originalFileName: originalName,
      userId,
      projectId,
      force,
      jobId,
      detectedType: docType ? UploadService.DOC_TYPE_MAP[docType] : undefined,
    };

    // Fire-and-forget: enqueue for background processing via BullMQ (or direct fallback)
    this.queueService.addDocumentJob({ context }).catch(async (error) => {
      this.logger.error('Failed to enqueue document job', error);
      await this.agentOrchestrator.failJob(context, error instanceof Error ? error.message : String(error));
      // Fallback: save as delivery note with failed parsing
      await this.deliveryNotes.createFromParsed({
        supplierName: 'Unknown - OCR Failed',
        companyId,
        source,
        originalFileUrl: savedPath,
        originalFileName: file.originalname,
        parsedData: null,
        parsingConfidence: 0,
        createdById: userId,
        projectId: projectId ?? undefined,
      });
    });
  }

  async rescan(docType: 'delivery-note' | 'invoice' | 'purchase-order', docId: string, companyId: string) {
    let filePath: string;
    let projectId: string | null = null;

    if (docType === 'delivery-note') {
      const doc = await this.prisma.deliveryNote.findUnique({ where: { id: docId }, select: { originalFileUrl: true, projectId: true, companyId: true } });
      if (!doc || doc.companyId !== companyId) throw new BadRequestException('Document not found');
      filePath = doc.originalFileUrl;
      projectId = doc.projectId;
    } else if (docType === 'invoice') {
      const doc = await this.prisma.invoice.findUnique({ where: { id: docId }, select: { originalFileUrl: true, projectId: true, companyId: true } });
      if (!doc || doc.companyId !== companyId) throw new BadRequestException('Document not found');
      if (!doc.originalFileUrl) throw new BadRequestException('Document has no file to rescan');
      filePath = doc.originalFileUrl;
      projectId = doc.projectId;
    } else {
      const doc = await this.prisma.purchaseOrder.findUnique({ where: { id: docId }, select: { originalFileUrl: true, projectId: true, companyId: true } });
      if (!doc || doc.companyId !== companyId) throw new BadRequestException('Document not found');
      if (!doc.originalFileUrl) throw new BadRequestException('Document has no file to rescan');
      filePath = doc.originalFileUrl;
      projectId = doc.projectId;
    }

    this.logger.log(`Rescan: ${docType} ${docId} from ${filePath}`);

    // Enqueue via queue and wait for result
    const results = await this.queueService.addDocumentJobsAndWait([{
      context: {
        companyId,
        filePath,
        source: 'MANUAL',
        originalFileName: filePath.split('/').pop() || 'rescan.pdf',
        projectId: projectId ?? undefined,
        force: true,
      },
    }]);
    return results[0];
  }

  async rescanAll(companyId: string) {
    const [dns, invs, pos] = await Promise.all([
      this.prisma.deliveryNote.findMany({ where: { companyId }, select: { id: true } }),
      this.prisma.invoice.findMany({ where: { companyId }, select: { id: true } }),
      this.prisma.purchaseOrder.findMany({ where: { companyId }, select: { id: true } }),
    ]);

    const results = { success: 0, failed: 0, total: dns.length + invs.length + pos.length };

    for (const dn of dns) {
      try { await this.rescan('delivery-note', dn.id, companyId); results.success++; } catch (e) { this.logger.warn(`Rescan DN ${dn.id} failed: ${e}`); results.failed++; }
    }
    for (const inv of invs) {
      try { await this.rescan('invoice', inv.id, companyId); results.success++; } catch (e) { this.logger.warn(`Rescan INV ${inv.id} failed: ${e}`); results.failed++; }
    }
    for (const po of pos) {
      try { await this.rescan('purchase-order', po.id, companyId); results.success++; } catch (e) { this.logger.warn(`Rescan PO ${po.id} failed: ${e}`); results.failed++; }
    }

    return results;
  }

  /**
   * Resolves which company a manual upload targets. Regular users always upload
   * to their own company; only super-admins may target a different (existing)
   * company — e.g. ingesting documents on a customer's behalf from the
   * super-admin Operations screen.
   */
  async resolveManualScanCompany(
    targetCompanyId: string | undefined,
    role: string,
    ownCompanyId: string,
  ): Promise<string> {
    if (!targetCompanyId || targetCompanyId === ownCompanyId) return ownCompanyId;
    if (role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admins can upload to another company');
    }
    const company = await this.prisma.company.findFirst({
      where: { id: targetCompanyId, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Target company not found');
    return company.id;
  }

  async processManualScan(
    files: Express.Multer.File[],
    companyId: string,
    userId: string,
    force: boolean,
  ): Promise<void> {
    this.jobsGateway.emitScanStarted(companyId, 'manual');
    this.scanLogger.log(
      companyId,
      'scanner',
      'התחלת העלאה ידנית',
      `${files.length} קבצים`,
      'working',
    );

    try {
      const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
      const maxUploadSizeMb = settings?.maxUploadSizeMb ?? 20;
      const maxBytes = maxUploadSizeMb * 1024 * 1024;

      const jobs: DocumentProcessingJobData[] = [];
      for (const file of files) {
        // Multer/busboy decodes filenames as Latin-1; re-decode as UTF-8 for Hebrew support
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        if (file.size > maxBytes) {
          this.scanLogger.log(
            companyId,
            'scanner',
            `קובץ גדול מדי: ${originalName}`,
            `${(file.size / 1024 / 1024).toFixed(1)}MB > ${maxUploadSizeMb}MB`,
            'error',
          );
          continue;
        }

        this.scanLogger.log(
          companyId,
          'scanner',
          `מעלה קובץ: ${originalName}`,
          `${(file.size / 1024).toFixed(0)} KB`,
          'working',
        );
        const savedPath = await this.storage.upload(file.buffer, originalName, companyId);

        jobs.push({
          context: {
            companyId,
            filePath: savedPath,
            source: 'MANUAL',
            originalFileName: originalName,
            userId,
            force,
          },
        });
      }

      if (jobs.length === 0) {
        this.scanLogger.log(companyId, 'postScan', 'אין קבצים תקינים לעיבוד', undefined, 'error');
        return;
      }

      this.scanLogger.transition(companyId, 'scanner', 'ocr', `${jobs.length} קבצים`);

      const results = await this.queueService.addDocumentJobsAndWait(jobs);

      const totals = { processed: 0, skipped: 0, failed: 0 };
      for (const result of results) {
        totals.processed += result.processed;
        totals.skipped += result.skipped;
        totals.failed += result.failed;
      }

      // Post-scan: backfill projects then run auto-match to create/update three-way matches
      this.scanLogger.log(companyId, 'postScan', 'משייך מסמכים לפרויקטים...');
      await this.backfillService.backfillProjects(companyId).catch((e) =>
        this.logger.warn(`Post-scan backfill failed: ${e}`),
      );

      this.scanLogger.log(companyId, 'postScan', 'מריץ התאמות אוטומטיות...');
      await this.matchingService.autoMatch(companyId).catch((e) =>
        this.logger.warn(`Post-scan auto-match failed: ${e}`),
      );

      const summary = `עובדו: ${totals.processed}, דולגו: ${totals.skipped}, נכשלו: ${totals.failed}`;
      this.scanLogger.log(companyId, 'postScan', 'העלאה ידנית הושלמה', summary, 'done');
    } catch (error) {
      this.logger.error('Manual scan failed', error);
      this.scanLogger.log(
        companyId,
        'postScan',
        'שגיאה בהעלאה ידנית',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      this.jobsGateway.emitScanComplete(companyId, 'manual');
    }
  }

  private async saveFile(file: Express.Multer.File, originalName: string, companyId: string): Promise<string> {
    return this.storage.upload(file.buffer, originalName, companyId);
  }
}
