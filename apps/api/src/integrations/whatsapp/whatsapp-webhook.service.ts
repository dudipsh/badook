import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUE_SERVICE, type QueueServiceInterface, type DocumentProcessingJobData } from '../../infrastructure/queue/queue.types';
import type { FileProcessingResult } from '../../intelligence/agents/agent.types';
import { WhatsAppService } from './whatsapp.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { ProjectBackfillService } from '../../domain/projects/project-backfill.service';

const SESSION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

const AUDIO_MIMES = [
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/amr',
];

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
};

export interface TwilioWebhookBody {
  MessageSid: string;
  From: string;        // "whatsapp:+972501234567"
  To: string;          // "whatsapp:+14155238886"
  Body?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  MediaUrl1?: string;
  MediaContentType1?: string;
  ProfileName?: string;
}

@Injectable()
export class WhatsAppWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  private sessionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly whatsapp: WhatsAppService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
    private readonly scanLog: ScanLogger,
    private readonly config: ConfigService,
    private readonly projectsService: ProjectBackfillService,
  ) {}

  async onModuleInit() {
    await this.finalizeExpiredSessions();
  }

  onModuleDestroy() {
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }
    this.sessionTimers.clear();
  }

  private async finalizeExpiredSessions() {
    const staleSessions = await this.prisma.whatsAppDeliverySession.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      select: { id: true, companyId: true },
    });
    if (staleSessions.length > 0) {
      this.logger.log(`Found ${staleSessions.length} expired sessions — finalizing`);
      for (const s of staleSessions) {
        await this.finalizeSession(s.id, s.companyId).catch((e) =>
          this.logger.warn(`Stale session finalization failed for ${s.id}: ${e.message}`),
        );
      }
    }
  }

  // -- Twilio Signature Verification --

  verifySignature(url: string, params: Record<string, string>, signature: string): boolean {
    const authToken = this.config.get<string>('twilio.authToken');
    if (!authToken) return true; // Skip in dev if no token
    return validateRequest(authToken, signature, url, params);
  }

  // -- Webhook Payload Processing --

  async processWebhookPayload(body: TwilioWebhookBody) {
    const messageSid = body.MessageSid;
    const rawFrom = body.From || '';
    const senderPhone = rawFrom.replace('whatsapp:', '');
    const senderName = body.ProfileName || null;
    const numMedia = parseInt(body.NumMedia || '0', 10);
    const textBody = body.Body || '';

    this.logger.log(
      `Twilio webhook: messageSid=${messageSid}, from=${senderPhone}, numMedia=${numMedia}, body="${textBody?.slice(0, 50)}"`,
    );

    // Look up company by sender phone
    const company = await this.whatsapp.findCompanyBySenderPhone(senderPhone);
    if (!company) {
      this.logger.warn(`No company found for sender phone: ${senderPhone} — ignoring message`);
      return;
    }
    this.logger.log(`Matched company ${company.id} for sender phone ${senderPhone}`);

    // Get or create delivery session
    const session = await this.getOrCreateSession(company.id, senderPhone, senderName);

    try {
      // Process media attachments
      if (numMedia > 0) {
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = (body as any)[`MediaUrl${i}`] as string | undefined;
          const mediaType = (body as any)[`MediaContentType${i}`] as string | undefined;

          if (!mediaUrl || !mediaType) continue;

          const mediaSid = numMedia > 1 ? `${messageSid}:${i}` : messageSid;

          if (AUDIO_MIMES.includes(mediaType)) {
            await this.processAudioMedia(company, session, mediaSid, senderPhone, senderName, mediaUrl, mediaType);
          } else if (ALLOWED_MIMES.includes(mediaType)) {
            await this.processDocumentMedia(company, session, mediaSid, senderPhone, senderName, mediaUrl, mediaType, textBody);
          } else {
            this.logger.warn(`Unsupported media type: ${mediaType}`);
            await this.whatsapp.sendReply(senderPhone, 'סוג הקובץ לא נתמך. שלח תמונה (JPG/PNG) או PDF.');
          }
        }
      } else if (textBody) {
        // Text-only message
        const existing = session.textNotes || '';
        const updated = existing ? `${existing}\n${textBody}` : textBody;
        await this.prisma.whatsAppDeliverySession.update({
          where: { id: session.id },
          data: { textNotes: updated },
        });

        await this.prisma.whatsAppMessageLog.create({
          data: {
            whatsappMessageId: messageSid,
            companyId: company.id,
            sessionId: session.id,
            senderPhone,
            senderName,
            messageType: 'text',
            caption: textBody,
            status: 'SUCCESS',
            mediaCount: 0,
          },
        });

        this.logger.log(`Text note added to session ${session.id}: "${textBody.slice(0, 100)}"`);
        this.gateway.emitDataChanged(company.id, 'whatsappMessageLog');
      }
    } catch (err) {
      this.logger.error(`Failed to process message ${messageSid}: ${(err as Error).message}`, (err as Error).stack);
    }

    // Schedule session finalization
    this.scheduleSessionFinalization(session.id, company.id);
  }

  // -- Session Management --

  private async getOrCreateSession(companyId: string, senderPhone: string, senderName: string | null) {
    const existing = await this.prisma.whatsAppDeliverySession.findFirst({
      where: {
        companyId,
        senderPhone,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const newExpiry = new Date(Date.now() + SESSION_WINDOW_MS);
      await this.prisma.whatsAppDeliverySession.update({
        where: { id: existing.id },
        data: { expiresAt: newExpiry },
      });
      this.logger.log(`Extended session ${existing.id} for ${senderPhone}`);
      return existing;
    }

    const session = await this.prisma.whatsAppDeliverySession.create({
      data: {
        companyId,
        senderPhone,
        senderName,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + SESSION_WINDOW_MS),
      },
    });
    this.logger.log(`Created new session ${session.id} for ${senderPhone}`);
    return session;
  }

  private scheduleSessionFinalization(sessionId: string, companyId: string) {
    const existing = this.sessionTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.sessionTimers.delete(sessionId);
      try {
        await this.finalizeSession(sessionId, companyId);
      } catch (err) {
        this.logger.error(`Session finalization failed for ${sessionId}: ${(err as Error).message}`, (err as Error).stack);
      }
    }, SESSION_WINDOW_MS);

    this.sessionTimers.set(sessionId, timer);
  }

  private async finalizeSession(sessionId: string, companyId: string) {
    const session = await this.prisma.whatsAppDeliverySession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session || session.status !== 'ACTIVE') return;

    this.logger.log(`Finalizing session ${sessionId}: ${session.messages.length} messages`);

    await this.prisma.whatsAppDeliverySession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });

    await this.projectsService
      .backfillProjects(companyId)
      .catch((e) => this.logger.warn(`Post-session backfill failed: ${e.message}`));

    this.gateway.emitDataChanged(companyId, 'whatsappMessageLog');
  }

  // -- Document Media Processing --

  private async processDocumentMedia(
    company: { id: string },
    session: { id: string },
    messageSid: string,
    senderPhone: string,
    senderName: string | null,
    mediaUrl: string,
    mimeType: string,
    caption: string,
  ) {
    const ext = MIME_TO_EXT[mimeType] || 'bin';
    const fileName = `whatsapp-${Date.now()}.${ext}`;

    // Deduplicate
    const dup = await this.prisma.whatsAppMessageLog.findUnique({
      where: { whatsappMessageId: messageSid },
    });
    if (dup) {
      this.logger.debug(`Duplicate message ${messageSid}, skipping`);
      return;
    }

    const log = await this.prisma.whatsAppMessageLog.create({
      data: {
        whatsappMessageId: messageSid,
        companyId: company.id,
        sessionId: session.id,
        senderPhone,
        senderName,
        messageType: mimeType.startsWith('image/') ? 'image' : 'document',
        caption: caption || null,
        status: 'PROCESSING',
        mediaCount: 1,
      },
    });
    this.gateway.emitDataChanged(company.id, 'whatsappMessageLog');

    try {
      this.scanLog.log(company.id, 'scanner', `הורדת קובץ מ-WhatsApp: ${fileName}`);

      const buffer = await this.whatsapp.downloadMedia(mediaUrl);
      const filePath = await this.storage.upload(buffer, fileName, company.id);

      const attachment = await this.prisma.whatsAppAttachment.create({
        data: {
          whatsappMessageLogId: log.id,
          fileName,
          filePath,
          mediaId: messageSid,
          mimeType,
          status: 'PROCESSING',
        },
      });

      const job: DocumentProcessingJobData = {
        context: {
          companyId: company.id,
          filePath,
          source: 'MOBILE',
          originalFileName: fileName,
          sourceMetadata: { senderPhone },
          force: false,
        },
        attachmentRecordId: attachment.id,
      };

      this.scanLog.transition(company.id, 'scanner', 'ocr', fileName);
      const results = await this.queueService.addDocumentJobsAndWait([job]);
      const result = results[0];
      const hasFailures = result && result.failed > 0;
      const status = hasFailures ? 'FAILED' : 'SUCCESS';

      await this.prisma.whatsAppMessageLog.update({
        where: { id: log.id },
        data: { status: status as any, processedCount: result?.processed ?? 0 },
      });

      await this.prisma.whatsAppAttachment.update({
        where: { id: attachment.id },
        data: {
          status,
          documentType: result?.documents?.[0]?.documentType ?? null,
          documentId: result?.documents?.[0]?.documentId ?? null,
        },
      });

      const replyText = hasFailures
        ? `שגיאה בעיבוד הקובץ ${fileName}. נסה שוב.`
        : await this.buildSuccessReply(fileName, result);
      await this.whatsapp.sendReply(senderPhone, replyText);
      await this.prisma.whatsAppMessageLog.update({
        where: { id: log.id },
        data: { replySent: true },
      });

      this.gateway.emitDataChanged(company.id, 'whatsappMessageLog');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`WhatsApp message processing failed: ${errMsg}`);

      await this.prisma.whatsAppMessageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: errMsg.slice(0, 500) },
      });

      await this.whatsapp
        .sendReply(senderPhone, 'שגיאה בעיבוד הקובץ. נסה שוב מאוחר יותר.')
        .catch(() => {});

      this.gateway.emitDataChanged(company.id, 'whatsappMessageLog');
    }
  }

  private async buildSuccessReply(
    fileName: string,
    result: FileProcessingResult | undefined,
  ): Promise<string> {
    const doc = result?.documents?.[0];
    if (!doc) return `הקובץ ${fileName} התקבל ועובד בהצלחה.`;

    if (doc.status === 'ORPHANED') {
      return `הקובץ ${fileName} התקבל אך לא שויך לפרויקט. הוא נמצא במסמכים הלא משויכים.`;
    }

    if (doc.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: doc.projectId },
        select: { name: true },
      });

      const docLabel = doc.documentType === 'delivery_note' ? 'תעודת משלוח'
        : doc.documentType === 'invoice' ? 'חשבונית'
        : 'מסמך';

      if (project) {
        return `${docLabel} התקבל/ה ונקלט/ה לפרויקט "${project.name}".`;
      }
    }

    return `הקובץ ${fileName} התקבל ועובד בהצלחה.`;
  }

  // -- Audio Processing --

  private async processAudioMedia(
    company: { id: string },
    session: { id: string; transcription: string | null },
    messageSid: string,
    senderPhone: string,
    senderName: string | null,
    mediaUrl: string,
    mimeType: string,
  ) {
    const ext = MIME_TO_EXT[mimeType] || 'ogg';
    const fileName = `voice-${Date.now()}.${ext}`;

    try {
      const buffer = await this.whatsapp.downloadMedia(mediaUrl);
      const filePath = await this.storage.upload(buffer, fileName, company.id);

      const transcription = await this.transcribeAudio(buffer, fileName);

      const existing = session.transcription || '';
      const updated = existing ? `${existing}\n${transcription}` : transcription;
      await this.prisma.whatsAppDeliverySession.update({
        where: { id: session.id },
        data: { transcription: updated },
      });

      await this.prisma.whatsAppMessageLog.create({
        data: {
          whatsappMessageId: messageSid,
          companyId: company.id,
          sessionId: session.id,
          senderPhone,
          senderName,
          messageType: 'audio',
          caption: transcription,
          status: 'SUCCESS',
          mediaCount: 0,
        },
      });

      this.logger.log(`Audio transcribed for session ${session.id}: "${transcription.slice(0, 100)}"`);
      this.gateway.emitDataChanged(company.id, 'whatsappMessageLog');
    } catch (err) {
      this.logger.error(`Audio processing failed: ${(err as Error).message}`);

      await this.prisma.whatsAppMessageLog.create({
        data: {
          whatsappMessageId: messageSid,
          companyId: company.id,
          sessionId: session.id,
          senderPhone,
          senderName,
          messageType: 'audio',
          caption: null,
          status: 'FAILED',
          mediaCount: 0,
          errorMessage: (err as Error).message?.slice(0, 500),
        },
      });
    }
  }

  private async transcribeAudio(buffer: Buffer, fileName: string): Promise<string> {
    const openaiKey = this.config.get<string>('openai.apiKey');
    if (!openaiKey) throw new Error('OpenAI API key not configured for STT');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/ogg' });
    formData.append('file', blob, fileName);
    formData.append('model', 'whisper-1');
    formData.append('language', 'he');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Whisper STT failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { text: string };
    return data.text;
  }
}
