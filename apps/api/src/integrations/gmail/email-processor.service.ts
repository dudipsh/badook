import { Injectable, Inject, Logger } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProjectBackfillService } from '../../domain/projects/project-backfill.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { QUEUE_SERVICE, type QueueServiceInterface, type DocumentProcessingJobData } from '../../infrastructure/queue/queue.types';

const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_ATTACHMENT_RETRIES = 3;
const MAX_AUTO_RETRY_BATCH = 10;

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly projectsService: ProjectBackfillService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
    private readonly scanLog: ScanLogger,
  ) {}

  async processMessage(client: gmail_v1.Gmail, messageId: string, companyId: string) {
    const msg = await client.users.messages.get({ userId: 'me', id: messageId });
    const headers = msg.data.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value ?? null;
    const from = headers.find((h) => h.name === 'From')?.value ?? '';
    const dateHeader = headers.find((h) => h.name === 'Date')?.value;
    const { senderName, senderEmail } = this.parseFrom(from);

    // Check if email is blocked by company rules
    if (await this.isEmailBlocked(companyId, subject, senderEmail, senderName)) {
      this.scanLog.log(companyId, 'scanner', `מייל חסום מ-${senderName || senderEmail || 'unknown'}`, subject ?? '');
      await this.prisma.emailScanLog.create({
        data: { gmailMessageId: messageId, companyId, subject, senderEmail, senderName, receivedAt: dateHeader ? new Date(dateHeader) : null, status: 'BLOCKED', attachmentCount: 0 },
      });
      this.gateway.emitDataChanged(companyId, 'emailScanLog');
      return;
    }

    const attachments = this.findAttachments(msg.data.payload);

    this.scanLog.log(companyId, 'scanner', `מייל מ-${senderName || senderEmail || 'unknown'}: ${attachments.length} קבצים`, subject ?? '');

    const log = await this.prisma.emailScanLog.create({
      data: { gmailMessageId: messageId, companyId, subject, senderEmail, senderName, receivedAt: dateHeader ? new Date(dateHeader) : null, status: attachments.length === 0 ? 'NO_ATTACHMENTS' : 'PROCESSING', attachmentCount: attachments.length },
    });
    this.gateway.emitDataChanged(companyId, 'emailScanLog');
    if (attachments.length === 0) return;

    await this.processAttachments(client, messageId, attachments, companyId, log.id);
  }

  async reprocessMessage(client: gmail_v1.Gmail, gmailMessageId: string, companyId: string, scanLogId: string) {
    try {
      const msg = await client.users.messages.get({ userId: 'me', id: gmailMessageId });
      const attachments = this.findAttachments(msg.data.payload);
      await this.processAttachments(client, gmailMessageId, attachments, companyId, scanLogId);
    } catch (error) {
      this.logger.error(`reprocessMessage failed for ${scanLogId}`, error);
      await this.prisma.emailScanLog.update({
        where: { id: scanLogId },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  async processAttachments(
    client: gmail_v1.Gmail, messageId: string,
    attachments: Array<{ filename: string; attachmentId: string }>,
    companyId: string, scanLogId: string,
  ) {
    const totals = { processed: 0, skipped: 0, failed: 0, errors: [] as string[] };
    const downloaded: Array<{ filePath: string; filename: string; attachmentRecordId: string }> = [];

    for (const att of attachments) {
      try {
        this.scanLog.log(companyId, 'scanner', `הורדת קובץ: ${att.filename}`);
        const filePath = await this.downloadAttachment(client, messageId, att.attachmentId, att.filename, companyId);
        const record = await this.prisma.emailScanAttachment.create({
          data: { emailScanLogId: scanLogId, fileName: att.filename, filePath, status: 'PROCESSING' },
        });
        downloaded.push({ filePath, filename: att.filename, attachmentRecordId: record.id });
      } catch (error) {
        const errMsg = (error instanceof Error ? error.message : String(error)).slice(0, 200);
        this.scanLog.log(companyId, 'scanner', `שגיאה בהורדת ${att.filename}`, errMsg, 'error');
        await this.prisma.emailScanAttachment.create({
          data: { emailScanLogId: scanLogId, fileName: att.filename, status: 'FAILED', errorMessage: errMsg },
        });
        totals.errors.push(`${att.filename}: ${errMsg}`);
        totals.failed++;
      }
    }

    if (downloaded.length > 0) this.scanLog.transition(companyId, 'scanner', 'ocr', `${downloaded.length} קבצים`);

    const jobs: DocumentProcessingJobData[] = downloaded.map(({ filePath, filename, attachmentRecordId }) => ({
      context: { companyId, filePath, source: 'EMAIL' as const, originalFileName: filename, emailScanLogId: scanLogId, force: false },
      attachmentRecordId,
    }));

    const results = await this.queueService.addDocumentJobsAndWait(jobs);
    for (const r of results) { totals.processed += r.processed; totals.skipped += r.skipped; totals.failed += r.failed; totals.errors.push(...r.errors); }
    await this.updateScanLogStatus(scanLogId, companyId, totals);
  }

  async retryFailedAttachments(companyId: string) {
    const where = { emailScanLog: { companyId }, status: 'FAILED' as const, retryCount: { lt: MAX_ATTACHMENT_RETRIES }, filePath: { not: null } };
    const failed = await this.prisma.emailScanAttachment.findMany({ where, include: { emailScanLog: { select: { id: true } } }, take: MAX_AUTO_RETRY_BATCH, orderBy: { createdAt: 'desc' } });
    if (failed.length === 0) return;

    const total = await this.prisma.emailScanAttachment.count({ where });
    this.scanLog.log(companyId, 'scanner', `מנסה שוב ${failed.length} מתוך ${total} קבצים שנכשלו`);
    const ids = failed.map((a) => a.id);
    await this.prisma.emailScanAttachment.updateMany({ where: { id: { in: ids } }, data: { status: 'PROCESSING', errorMessage: null, documentType: null, documentId: null } });
    await this.prisma.$executeRaw`UPDATE email_scan_attachments SET retry_count = retry_count + 1 WHERE id = ANY(${ids})`;
    const jobs: DocumentProcessingJobData[] = failed.map((att) => ({
      context: { companyId, filePath: att.filePath!, source: 'EMAIL' as const, originalFileName: att.fileName, emailScanLogId: att.emailScanLog.id, force: true },
      attachmentRecordId: att.id,
    }));

    try { await this.queueService.addDocumentJobsAndWait(jobs); }
    catch (err) { this.logger.error(`Auto-retry batch failed: ${(err as Error).message}`); }

    for (const logId of [...new Set(failed.map((a) => a.emailScanLog.id))]) {
      await this.recalcScanLogStatus(logId, companyId);
    }
  }

  async runIncrementalMatch(_companyId: string) {
    // Auto-match is deferred — runs lazily when user opens the project dashboard.
  }

  async runPostScanPipeline(companyId: string) {
    // Auto-match is deferred — runs lazily when user opens the project dashboard.
    this.scanLog.log(companyId, 'postScan', 'משייך מסמכים לפרויקטים');
    await this.projectsService.backfillProjects(companyId).catch((e) => this.logger.error(`Backfill failed: ${e.message}`));
    await this.projectsService.backfillProjects(companyId).catch((e) => this.logger.error(`Post-backfill failed: ${e.message}`));
    this.scanLog.log(companyId, 'postScan', 'סריקה הסתיימה בהצלחה', undefined, 'done');
  }

  async recalcScanLogStatus(scanLogId: string, companyId?: string) {
    const atts = await this.prisma.emailScanAttachment.findMany({ where: { emailScanLogId: scanLogId }, select: { status: true } });
    const counts = { failed: 0, success: 0, skipped: 0, processing: 0 };
    for (const a of atts) { counts[a.status === 'FAILED' ? 'failed' : a.status === 'SUCCESS' ? 'success' : a.status === 'SKIPPED' ? 'skipped' : 'processing']++; }

    const status = counts.processing > 0 ? 'PROCESSING'
      : counts.failed === 0 ? 'SUCCESS'
      : (counts.success > 0 || counts.skipped > 0) ? 'PARTIAL'
      : 'FAILED' as const;

    await this.prisma.emailScanLog.update({ where: { id: scanLogId }, data: { status, processedCount: counts.success + counts.skipped } });
    if (companyId) this.gateway.emitDataChanged(companyId, 'emailScanLog');
  }

  async updateScanLogStatus(scanLogId: string, companyId: string, result: { processed: number; skipped: number; failed: number; errors: string[] }) {
    const { processed, skipped, failed, errors } = result;
    const allSkipped = skipped > 0 && processed === 0 && failed === 0;
    const infoParts: string[] = [];
    if (skipped > 0) infoParts.push(`${skipped} קבצים דולגו`);
    if (errors.length > 0) infoParts.push(errors.join(' | '));
    await this.prisma.emailScanLog.update({
      where: { id: scanLogId },
      data: { processedCount: processed, status: allSkipped ? 'SUCCESS' : failed === 0 ? 'SUCCESS' : processed > 0 ? 'PARTIAL' : 'FAILED', errorMessage: infoParts.length > 0 ? infoParts.join(' ; ') : null },
    });
    this.gateway.emitDataChanged(companyId, 'emailScanLog');
  }

  findAttachments(payload: gmail_v1.Schema$MessagePart | undefined): Array<{ filename: string; attachmentId: string }> {
    const results: Array<{ filename: string; attachmentId: string }> = [];
    if (!payload) return results;
    const traverse = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.body?.attachmentId && ALLOWED_MIMES.includes(part.mimeType || '')) {
        results.push({ filename: part.filename, attachmentId: part.body.attachmentId });
      }
      for (const child of part.parts || []) traverse(child);
    };
    traverse(payload);
    return results;
  }

  async downloadAttachment(client: gmail_v1.Gmail, messageId: string, attachmentId: string, filename: string, companyId: string): Promise<string> {
    const res = await client.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId });
    return this.storage.upload(Buffer.from(res.data.data!, 'base64url'), filename, companyId);
  }

  parseFrom(from: string): { senderName: string | null; senderEmail: string | null } {
    const match = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
    return match ? { senderName: match[1], senderEmail: match[2] } : { senderName: null, senderEmail: from || null };
  }

  /** Check if an email should be blocked based on company rules. */
  async isEmailBlocked(
    companyId: string,
    subject: string | null,
    senderEmail: string | null,
    senderName: string | null,
  ): Promise<boolean> {
    const scanSettings = await this.prisma.companyScanSettings.findUnique({
      where: { companyId },
    });
    const rules = (scanSettings?.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
    if (rules.length === 0) return false;

    for (const rule of rules) {
      const pattern = rule.pattern.toLowerCase();
      if (rule.type === 'sender') {
        if (senderEmail?.toLowerCase().includes(pattern)) return true;
        if (senderName?.toLowerCase().includes(pattern)) return true;
      } else if (rule.type === 'subject') {
        if (subject?.toLowerCase().includes(pattern)) return true;
      }
    }
    return false;
  }
}
