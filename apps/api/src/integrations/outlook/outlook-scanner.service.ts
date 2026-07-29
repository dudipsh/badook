import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service';
import { ProjectBackfillService } from '../../domain/projects/project-backfill.service';
import { QUEUE_SERVICE, type QueueServiceInterface, type DocumentProcessingJobData } from '../../infrastructure/queue/queue.types';
import { OutlookService } from './outlook.service';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const LOCK_RENEWAL_INTERVAL_MS = 10 * 60_000;

@Injectable()
export class OutlookScannerService {
  private readonly logger = new Logger(OutlookScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly outlook: OutlookService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
    private readonly scanLog: ScanLogger,
    private readonly projectsService: ProjectBackfillService,
    private readonly encryption: EncryptionService,
  ) {}

  async scanInbox(companyId: string, integrationId: string): Promise<void> {
    const integration = await this.prisma.companyIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration || integration.companyId !== companyId || integration.type !== 'OUTLOOK') {
      this.logger.warn(`Outlook integration ${integrationId} not found for company ${companyId}`);
      return;
    }

    let refreshToken: string | null = null;
    if (integration.credentials && typeof integration.credentials === 'string') {
      try {
        const creds = this.encryption.decrypt(integration.credentials);
        refreshToken = creds?.refreshToken ?? null;
      } catch (error) {
        this.logger.error(`Failed to decrypt Outlook credentials for integration ${integrationId}`, error);
      }
    }

    if (!(await this.queueService.tryAcquireScanLock(companyId))) {
      this.scanLog.log(companyId, 'scanner', 'סריקה כבר פעילה', 'נסה שוב מאוחר יותר', 'error');
      this.gateway.emitScanComplete(companyId, 'outlook');
      return;
    }
    const lockInterval = this.startLockRenewal(companyId);
    try {
      await this.cleanStaleRecords();
      if (!refreshToken) {
        this.scanLog.log(companyId, 'scanner', 'Outlook לא מוגדר', 'חבר חשבון Outlook בהגדרות', 'error');
        return;
      }

      let accessToken: string;
      try {
        accessToken = await this.outlook.getAccessToken(refreshToken);
      } catch (error) {
        const msg = (error as Error)?.message || '';
        const userMsg = msg.includes('invalid_grant') || msg.includes('AADSTS')
          ? 'טוקן Outlook פג תוקף — יש לחבר מחדש את החשבון בהגדרות'
          : `שגיאה באימות Outlook: ${msg.slice(0, 120)}`;
        this.scanLog.log(companyId, 'scanner', userMsg, '', 'error');
        return;
      }

      this.gateway.emitScanStarted(companyId, 'outlook');
      const afterDate = this.calcAfterDate(integration.scanDaysBack);

      const messages = await this.listMessages(accessToken, afterDate, integration.scanSent, companyId);
      this.scanLog.log(companyId, 'scanner', `סה"כ ${messages.length} מיילים נמצאו`);
      await this.processEmailBatch(accessToken, messages, companyId);

      this.scanLog.log(companyId, 'postScan', 'משייך מסמכים לפרויקטים');
      await this.projectsService.backfillProjects(companyId).catch((e) => this.logger.error(`Backfill failed: ${e.message}`));
      this.scanLog.log(companyId, 'postScan', 'סריקה הסתיימה בהצלחה', undefined, 'done');

      await this.prisma.companyIntegration.update({
        where: { id: integrationId },
        data: { lastScannedAt: new Date() },
      });
    } catch (error) {
      const msg = (error as Error)?.message || String(error);
      this.logger.error(`Outlook scan failed for ${companyId}: ${msg}`);
      this.scanLog.log(companyId, 'scanner', `שגיאה בסריקה: ${msg.slice(0, 120)}`, '', 'error');
      throw error;
    } finally {
      clearInterval(lockInterval);
      this.gateway.emitScanComplete(companyId, 'outlook');
      await this.queueService.setScanRunning(companyId, false);
    }
  }

  async retryScanLog(companyId: string, scanLogId: string) {
    const log = await this.prisma.emailScanLog.findFirst({ where: { id: scanLogId, companyId } });
    if (!log) throw new Error('Scan log not found');
    if (log.status !== 'FAILED' && log.status !== 'PARTIAL') throw new Error('Only failed/partial scans can be retried');

    const outlookIntegration = await this.prisma.companyIntegration.findFirst({
      where: { companyId, type: 'OUTLOOK', status: 'CONNECTED' },
    });
    let refreshToken: string | null = null;
    if (outlookIntegration?.credentials && typeof outlookIntegration.credentials === 'string') {
      try {
        const creds = this.encryption.decrypt(outlookIntegration.credentials);
        refreshToken = creds?.refreshToken ?? null;
      } catch (error) {
        this.logger.error(`Failed to decrypt Outlook credentials for company ${companyId}`, error);
      }
    }
    if (!refreshToken) throw new Error('Outlook not configured');

    const accessToken = await this.outlook.getAccessToken(refreshToken);
    const outlookMessageId = log.gmailMessageId.replace('outlook:', '');

    await this.prisma.emailScanLog.update({ where: { id: scanLogId }, data: { status: 'PROCESSING', errorMessage: null, processedCount: 0 } });
    this.reprocessMessage(accessToken, outlookMessageId, companyId, scanLogId).catch(
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
        await this.recalcScanLogStatus(att.emailScanLog.id, companyId);
      }
    }).catch((err) => this.logger.error(`Retry attachment ${attachmentId} failed`, err));

    return { message: 'Retry started' };
  }

  // ── Microsoft Graph API ─────────────────────────────────

  private async listMessages(
    accessToken: string, afterDate: string, scanSent: boolean, companyId: string,
  ): Promise<Array<{ id: string; subject: string; from: string; senderEmail: string; receivedAt: string }>> {
    const messages: Array<{ id: string; subject: string; from: string; senderEmail: string; receivedAt: string }> = [];

    this.scanLog.log(companyId, 'scanner', 'סורק תיבת דואר נכנס...');
    const inboxMsgs = await this.fetchFolderMessages(accessToken, 'inbox', afterDate);
    this.scanLog.log(companyId, 'scanner', `נמצאו ${inboxMsgs.length} מיילים בדואר נכנס`);
    messages.push(...inboxMsgs);

    if (scanSent) {
      this.scanLog.log(companyId, 'scanner', 'סורק דואר יוצא (הזמנות)...');
      const sentMsgs = await this.fetchFolderMessages(accessToken, 'sentitems', afterDate);
      this.scanLog.log(companyId, 'scanner', `נמצאו ${sentMsgs.length} מיילים בדואר יוצא`);
      messages.push(...sentMsgs);
    }

    // Deduplicate by id
    const seen = new Set<string>();
    return messages.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  }

  private async fetchFolderMessages(
    accessToken: string, folder: string, afterDate: string,
  ): Promise<Array<{ id: string; subject: string; from: string; senderEmail: string; receivedAt: string }>> {
    const results: Array<{ id: string; subject: string; from: string; senderEmail: string; receivedAt: string }> = [];
    let url: string | null =
      `${GRAPH_BASE}/me/mailFolders/${folder}/messages?` +
      `$filter=hasAttachments eq true and receivedDateTime ge ${afterDate}` +
      `&$select=id,subject,from,receivedDateTime,hasAttachments` +
      `&$top=100&$orderby=receivedDateTime desc`;

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Graph API error (${res.status}): ${err.slice(0, 200)}`);
      }
      const data = (await res.json()) as Record<string, any>;
      for (const msg of (data.value || []) as any[]) {
        results.push({
          id: msg.id,
          subject: msg.subject || '',
          from: msg.from?.emailAddress?.name || '',
          senderEmail: msg.from?.emailAddress?.address || '',
          receivedAt: msg.receivedDateTime || '',
        });
      }
      url = (data['@odata.nextLink'] as string) || null;
    }
    return results;
  }

  private async processEmailBatch(
    accessToken: string,
    messages: Array<{ id: string; subject: string; from: string; senderEmail: string; receivedAt: string }>,
    companyId: string,
  ) {
    let processed = 0;
    for (const msg of messages) {
      const messageKey = `outlook:${msg.id}`;
      if (await this.prisma.emailScanLog.findUnique({ where: { gmailMessageId: messageKey } })) { processed++; continue; }

      this.scanLog.log(companyId, 'scanner', `מעבד מייל ${processed + 1} מתוך ${messages.length}`);

      if (await this.isEmailBlocked(companyId, msg.subject, msg.senderEmail, msg.from)) {
        this.scanLog.log(companyId, 'scanner', `מייל חסום מ-${msg.from || msg.senderEmail || 'unknown'}`, msg.subject);
        await this.prisma.emailScanLog.create({
          data: { gmailMessageId: messageKey, companyId, subject: msg.subject, senderEmail: msg.senderEmail, senderName: msg.from, receivedAt: msg.receivedAt ? new Date(msg.receivedAt) : null, status: 'BLOCKED', attachmentCount: 0 },
        });
        this.gateway.emitDataChanged(companyId, 'emailScanLog');
        processed++;
        continue;
      }

      try {
        await this.processMessage(accessToken, msg, messageKey, companyId);
      } catch (error) {
        this.logger.error(`Failed to process Outlook message ${msg.id}: ${(error as Error)?.message}`);
        this.scanLog.log(companyId, 'scanner', 'שגיאה בעיבוד מייל', (error as Error)?.message ?? '', 'error');
      }
      processed++;
      this.gateway.emitScanProgress(companyId, { processed, total: messages.length });
    }
  }

  private async processMessage(
    accessToken: string,
    msg: { id: string; subject: string; from: string; senderEmail: string; receivedAt: string },
    messageKey: string,
    companyId: string,
  ) {
    // Fetch message attachments
    const res = await fetch(`${GRAPH_BASE}/me/messages/${msg.id}/attachments?$select=id,name,contentType,size,contentBytes`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch attachments: ${res.status}`);
    const data = (await res.json()) as Record<string, any>;

    const attachments = ((data.value || []) as any[]).filter(
      (att) => att['@odata.type'] === '#microsoft.graph.fileAttachment' && ALLOWED_MIMES.includes(att.contentType?.toLowerCase()),
    );

    this.scanLog.log(companyId, 'scanner', `מייל מ-${msg.from || msg.senderEmail || 'unknown'}: ${attachments.length} קבצים`, msg.subject);

    const log = await this.prisma.emailScanLog.create({
      data: { gmailMessageId: messageKey, companyId, subject: msg.subject, senderEmail: msg.senderEmail, senderName: msg.from, receivedAt: msg.receivedAt ? new Date(msg.receivedAt) : null, status: attachments.length === 0 ? 'NO_ATTACHMENTS' : 'PROCESSING', attachmentCount: attachments.length },
    });
    this.gateway.emitDataChanged(companyId, 'emailScanLog');
    if (attachments.length === 0) return;

    await this.processAttachments(attachments, companyId, log.id);
  }

  private async processAttachments(
    attachments: Array<{ id: string; name: string; contentType: string; contentBytes: string }>,
    companyId: string, scanLogId: string,
  ) {
    const totals = { processed: 0, skipped: 0, failed: 0, errors: [] as string[] };
    const downloaded: Array<{ filePath: string; filename: string; attachmentRecordId: string }> = [];

    for (const att of attachments) {
      try {
        this.scanLog.log(companyId, 'scanner', `הורדת קובץ: ${att.name}`);
        const buffer = Buffer.from(att.contentBytes, 'base64');
        const filePath = await this.storage.upload(buffer, att.name, companyId);
        const record = await this.prisma.emailScanAttachment.create({
          data: { emailScanLogId: scanLogId, fileName: att.name, filePath, status: 'PROCESSING' },
        });
        downloaded.push({ filePath, filename: att.name, attachmentRecordId: record.id });
      } catch (error) {
        const errMsg = (error instanceof Error ? error.message : String(error)).slice(0, 200);
        this.scanLog.log(companyId, 'scanner', `שגיאה בהורדת ${att.name}`, errMsg, 'error');
        await this.prisma.emailScanAttachment.create({
          data: { emailScanLogId: scanLogId, fileName: att.name, status: 'FAILED', errorMessage: errMsg },
        });
        totals.errors.push(`${att.name}: ${errMsg}`);
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

  private async reprocessMessage(accessToken: string, outlookMessageId: string, companyId: string, scanLogId: string) {
    try {
      const res = await fetch(`${GRAPH_BASE}/me/messages/${outlookMessageId}/attachments?$select=id,name,contentType,size,contentBytes`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch attachments: ${res.status}`);
      const data = (await res.json()) as Record<string, any>;
      const attachments = ((data.value || []) as any[]).filter(
        (att) => att['@odata.type'] === '#microsoft.graph.fileAttachment' && ALLOWED_MIMES.includes(att.contentType?.toLowerCase()),
      );
      await this.processAttachments(attachments, companyId, scanLogId);
    } catch (error) {
      this.logger.error(`reprocessMessage failed for ${scanLogId}`, error);
      await this.prisma.emailScanLog.update({
        where: { id: scanLogId },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  // ── Shared Helpers ──────────────────────────────────────

  private async isEmailBlocked(companyId: string, subject: string | null, senderEmail: string | null, senderName: string | null): Promise<boolean> {
    const scanSettings = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
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

  private async updateScanLogStatus(scanLogId: string, companyId: string, result: { processed: number; skipped: number; failed: number; errors: string[] }) {
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

  private async recalcScanLogStatus(scanLogId: string, companyId?: string) {
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

  private startLockRenewal(companyId: string): ReturnType<typeof setInterval> {
    return setInterval(async () => {
      try { await this.queueService.renewScanLock(companyId); }
      catch (err) { this.logger.warn(`Failed to renew lock: ${(err as Error).message}`); }
    }, LOCK_RENEWAL_INTERVAL_MS);
  }

  private async cleanStaleRecords() {
    const staleLogs = await this.prisma.emailScanLog.updateMany({ where: { status: 'PROCESSING' }, data: { status: 'FAILED', errorMessage: 'סריקה נקטעה - נסה שנית' } });
    if (staleLogs.count > 0) this.logger.log(`Marked ${staleLogs.count} stale logs as FAILED`);
  }

  private calcAfterDate(daysBack: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toISOString();
  }
}
