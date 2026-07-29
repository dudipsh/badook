import { Injectable, Inject, Logger } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service';
import { QUEUE_SERVICE, type QueueServiceInterface, type DocumentProcessingJobData } from '../../infrastructure/queue/queue.types';
import { GmailService } from './gmail.service';
import { EmailProcessorService } from './email-processor.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpeg', '.jpg'];
const LOCK_RENEWAL_INTERVAL_MS = 10 * 60_000;
// A scan still in PROCESSING longer than this is certainly dead (e.g. server redeploy), not in-flight.
const STALE_SCAN_THRESHOLD_MS = 20 * 60_000;

@Injectable()
export class GmailScannerService {
  private readonly logger = new Logger(GmailScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly gmail: GmailService,
    private readonly emailProcessor: EmailProcessorService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
    private readonly scanLog: ScanLogger,
    private readonly encryption: EncryptionService,
  ) {}

  async scanInbox(companyId: string, integrationId: string): Promise<void> {
    const integration = await this.prisma.companyIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration || integration.companyId !== companyId || integration.type !== 'GMAIL') {
      this.logger.warn(`Gmail integration ${integrationId} not found for company ${companyId}`);
      return;
    }

    let refreshToken: string | null = null;
    if (integration.credentials && typeof integration.credentials === 'string') {
      try {
        const creds = this.encryption.decrypt(integration.credentials);
        refreshToken = creds?.refreshToken ?? null;
      } catch (error) {
        this.logger.error(`Failed to decrypt Gmail credentials for integration ${integrationId}`, error);
      }
    }

    if (!(await this.queueService.tryAcquireScanLock(companyId))) {
      this.scanLog.log(companyId, 'scanner', 'סריקה כבר פעילה', 'נסה שוב מאוחר יותר', 'error');
      this.gateway.emitScanComplete(companyId, 'gmail');
      return;
    }
    const lockInterval = this.startLockRenewal(companyId);
    try {
      await this.cleanStaleRecords();
      await this.emailProcessor.retryFailedAttachments(companyId);
      const client = this.gmail.createGmailClient(refreshToken);
      if (!client) {
        this.scanLog.log(companyId, 'scanner', 'Gmail לא מוגדר', 'חבר חשבון Gmail בהגדרות', 'error');
        return;
      }
      this.gateway.emitScanStarted(companyId, 'gmail');
      const afterDate = this.calcAfterDate(integration.scanDaysBack);
      const { ids, inboxCount, sentCount } = await this.listMessages(client, afterDate, integration.scanSent, companyId);
      this.scanLog.log(companyId, 'scanner', `סה"כ ${ids.length} מיילים (${inboxCount} נכנסים, ${sentCount} יוצאים)`);
      await this.processEmailBatch(client, ids, companyId);
      await this.emailProcessor.runPostScanPipeline(companyId);

      await this.prisma.companyIntegration.update({
        where: { id: integrationId },
        data: { lastScannedAt: new Date() },
      });
    } catch (error) {
      const msg = (error as Error)?.message || String(error);
      this.logger.error(`Scan failed for ${companyId}: ${msg}`);
      const userMsg = msg.includes('invalid_grant')
        ? 'טוקן Gmail פג תוקף — יש לחבר מחדש את החשבון בהגדרות'
        : `שגיאה בסריקה: ${msg.slice(0, 120)}`;
      this.scanLog.log(companyId, 'scanner', userMsg, '', 'error');
      throw error;
    } finally {
      clearInterval(lockInterval);
      this.gateway.emitScanComplete(companyId, 'gmail');
      await this.queueService.setScanRunning(companyId, false);
    }
  }

  async scanLocalFolders(folderNames: string[], companyId?: string): Promise<void> {
    const company = companyId
      ? await this.prisma.company.findUnique({ where: { id: companyId } })
      : await this.prisma.company.findFirst();
    if (!company) { this.logger.warn('No company found'); return; }

    if (!(await this.queueService.tryAcquireScanLock(company.id))) {
      this.scanLog.log(company.id, 'scanner', 'סריקה כבר פעילה', '', 'error');
      this.gateway.emitScanComplete(company.id, 'local');
      return;
    }
    const lockInterval = this.startLockRenewal(company.id);
    try {
      this.gateway.emitScanStarted(company.id, 'local');
      this.scanLog.log(company.id, 'scanner', `מתחיל סריקת ${folderNames.length} תיקיות`);
      const testDataDir = path.resolve(__dirname, '../../..', 'test-data');

      for (const folder of folderNames) {
        await this.processLocalFolder(folder, testDataDir, company.id);
      }
      await this.emailProcessor.runPostScanPipeline(company.id);
    } finally {
      clearInterval(lockInterval);
      this.gateway.emitScanComplete(company.id, 'local');
      await this.queueService.setScanRunning(company.id, false);
    }
  }

  async retryScanLog(companyId: string, scanLogId: string) {
    const log = await this.prisma.emailScanLog.findFirst({ where: { id: scanLogId, companyId } });
    if (!log) throw new Error('Scan log not found');
    if (log.status !== 'FAILED' && log.status !== 'PARTIAL') throw new Error('Only failed/partial scans can be retried');

    const gmailIntegration = await this.prisma.companyIntegration.findFirst({
      where: { companyId, type: 'GMAIL', status: 'CONNECTED' },
    });
    let refreshToken: string | null = null;
    if (gmailIntegration?.credentials && typeof gmailIntegration.credentials === 'string') {
      try {
        const creds = this.encryption.decrypt(gmailIntegration.credentials);
        refreshToken = creds?.refreshToken ?? null;
      } catch (error) {
        this.logger.error(`Failed to decrypt Gmail credentials for company ${companyId}`, error);
      }
    }
    const client = this.gmail.createGmailClient(refreshToken);
    if (!client) throw new Error('Gmail not configured');

    await this.prisma.emailScanLog.update({ where: { id: scanLogId }, data: { status: 'PROCESSING', errorMessage: null, processedCount: 0 } });
    this.emailProcessor.reprocessMessage(client, log.gmailMessageId, companyId, scanLogId).catch(
      (err) => this.logger.error(`Retry failed for ${scanLogId}`, err),
    );
    return { message: 'Retry started' };
  }

  async retryAttachment(companyId: string, attachmentId: string) {
    const att = await this.prisma.emailScanAttachment.findUnique({
      where: { id: attachmentId },
      include: { emailScanLog: { select: { companyId: true, id: true } } },
    });
    if (!att || att.emailScanLog.companyId !== companyId) throw new Error('Attachment not found');
    if (att.status !== 'FAILED') throw new Error('Only failed attachments can be retried');
    if (!att.filePath) throw new Error('No file path available');

    await this.prisma.emailScanAttachment.update({
      where: { id: attachmentId },
      data: { status: 'PROCESSING', errorMessage: null, documentType: null, documentId: null, retryCount: { increment: 1 } },
    });
    const job: DocumentProcessingJobData = {
      context: { companyId, filePath: att.filePath, source: 'EMAIL', originalFileName: att.fileName, emailScanLogId: att.emailScanLog.id, force: true },
      attachmentRecordId: att.id,
    };
    this.queueService.addDocumentJobsAndWait([job]).then(async (results) => {
      if (results[0] && (results[0].processed > 0 || results[0].skipped > 0)) {
        await this.emailProcessor.recalcScanLogStatus(att.emailScanLog.id, companyId);
      }
    }).catch((err) => this.logger.error(`Retry attachment ${attachmentId} failed`, err));

    return { message: 'Retry started' };
  }

  private async listMessages(
    client: gmail_v1.Gmail, afterDate: string, scanSent: boolean, companyId: string,
  ): Promise<{ ids: string[]; inboxCount: number; sentCount: number }> {
    const idSet = new Set<string>();

    // Search received mail by query rather than by the INBOX label, so attachment messages that were
    // archived (lost the INBOX label) or live in a partially-archived thread are still found.
    // Exclude sent/drafts/spam/trash/chats — sent is scanned separately below when enabled.
    this.scanLog.log(companyId, 'scanner', 'סורק דואר נכנס (כולל מאורכב)...');
    const inboxCount = await this.fetchQuery(
      client, `has:attachment after:${afterDate} -in:sent -in:draft -in:spam -in:trash -in:chats`, idSet,
    );
    this.scanLog.log(companyId, 'scanner', `נמצאו ${inboxCount} מיילים`);

    let sentCount = 0;
    if (scanSent) {
      this.scanLog.log(companyId, 'scanner', 'סורק דואר יוצא (הזמנות)...');
      sentCount = await this.fetchQuery(client, `has:attachment after:${afterDate} in:sent`, idSet);
      this.scanLog.log(companyId, 'scanner', `נמצאו ${sentCount} מיילים בדואר יוצא`);
    }

    return { ids: Array.from(idSet), inboxCount, sentCount };
  }

  private async fetchQuery(
    client: gmail_v1.Gmail, q: string, idSet: Set<string>,
  ): Promise<number> {
    let count = 0;
    let pageToken: string | undefined;
    do {
      const res = await client.users.messages.list({ userId: 'me', q, pageToken, maxResults: 100 });
      for (const msg of res.data.messages || []) {
        if (msg.id && !idSet.has(msg.id)) { idSet.add(msg.id); count++; }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return count;
  }

  private async processEmailBatch(client: gmail_v1.Gmail, messageIds: string[], companyId: string) {
    let processed = 0;
    for (const messageId of messageIds) {
      if (await this.prisma.emailScanLog.findUnique({ where: { gmailMessageId: messageId } })) { processed++; continue; }
      this.scanLog.log(companyId, 'scanner', `מעבד מייל ${processed + 1} מתוך ${messageIds.length}`);
      try {
        await this.emailProcessor.processMessage(client, messageId, companyId);
      } catch (error) {
        this.logger.error(`Failed to process message ${messageId}: ${(error as Error)?.message}`);
        this.scanLog.log(companyId, 'scanner', 'שגיאה בעיבוד מייל', (error as Error)?.message ?? '', 'error');
      }
      processed++;
      this.gateway.emitScanProgress(companyId, { processed, total: messageIds.length });
      this.scanLog.transition(companyId, 'ocr', 'matching');
      await this.emailProcessor.runIncrementalMatch(companyId);
    }
  }

  private async processLocalFolder(folderName: string, baseDir: string, companyId: string) {
    const folderPath = path.join(baseDir, folderName);
    const gmailMessageId = `local:${folderName}`;

    if (await this.prisma.emailScanLog.findUnique({ where: { gmailMessageId } })) {
      this.logger.log(`Skipping already-processed folder: ${folderName}`);
      return;
    }

    let files: string[];
    try {
      files = (await fs.readdir(folderPath)).filter((f) => ALLOWED_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)));
    } catch { this.logger.error(`Cannot read folder: ${folderPath}`); return; }

    this.scanLog.log(companyId, 'scanner', `סורק תיקייה: ${folderName}`, `${files.length} קבצים`);
    const log = await this.prisma.emailScanLog.create({
      data: { gmailMessageId, companyId, subject: `תיקייה מקומית: ${folderName}`, senderEmail: 'local', senderName: folderName, receivedAt: new Date(), status: files.length === 0 ? 'NO_ATTACHMENTS' : 'PROCESSING', attachmentCount: files.length },
    });
    this.gateway.emitDataChanged(companyId, 'emailScanLog');
    if (files.length === 0) return;
    this.scanLog.transition(companyId, 'scanner', 'ocr', `${files.length} קבצים`);
    const jobs: DocumentProcessingJobData[] = files.map((filename) => ({
      context: { companyId, filePath: path.join(folderPath, filename), source: 'EMAIL' as const, originalFileName: filename, emailScanLogId: log.id, force: false },
    }));
    const results = await this.queueService.addDocumentJobsAndWait(jobs);
    const totals = { processed: 0, skipped: 0, failed: 0, errors: [] as string[] };
    for (const r of results) { totals.processed += r.processed; totals.skipped += r.skipped; totals.failed += r.failed; totals.errors.push(...r.errors); }
    await this.emailProcessor.updateScanLogStatus(log.id, companyId, totals);
    this.scanLog.transition(companyId, 'ocr', 'matching');
    await this.emailProcessor.runIncrementalMatch(companyId);
  }

  private startLockRenewal(companyId: string): ReturnType<typeof setInterval> {
    return setInterval(async () => {
      try { await this.queueService.renewScanLock(companyId); }
      catch (err) { this.logger.warn(`Failed to renew lock: ${(err as Error).message}`); }
    }, LOCK_RENEWAL_INTERVAL_MS);
  }

  private async cleanStaleRecords() {
    // A scan can be interrupted (e.g. server redeploy) after its attachments already finished in the
    // BullMQ worker but before the orchestrating request finalizes the scan-log status. Don't blindly
    // mark such logs FAILED — re-derive each log's status from its attachments, so a fully-processed
    // scan reads SUCCESS. Only touch logs old enough that any owning scan is certainly dead.
    const staleBefore = new Date(Date.now() - STALE_SCAN_THRESHOLD_MS);
    const staleLogs = await this.prisma.emailScanLog.findMany({
      where: { status: 'PROCESSING', createdAt: { lt: staleBefore } },
      select: { id: true, companyId: true, _count: { select: { attachments: true } } },
    });
    if (staleLogs.length === 0) return;

    for (const log of staleLogs) {
      // Attachments still PROCESSING past the staleness window belong to the dead scan — fail them.
      await this.prisma.emailScanAttachment.updateMany({
        where: { emailScanLogId: log.id, status: 'PROCESSING' },
        data: { status: 'FAILED', errorMessage: 'עיבוד נקטע - סריקה קודמת נכשלה' },
      });
      if (log._count.attachments === 0) {
        // Scan died before any attachment was recorded — nothing succeeded.
        await this.prisma.emailScanLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', errorMessage: 'סריקה נקטעה - נסה שנית' },
        });
      } else {
        await this.emailProcessor.recalcScanLogStatus(log.id, log.companyId);
      }
    }
    this.logger.log(`Reconciled ${staleLogs.length} stale scan log(s) from attachment statuses`);
  }

  private calcAfterDate(daysBack: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
}
