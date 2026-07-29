import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUE_SERVICE, type QueueServiceInterface } from '../../infrastructure/queue/queue.types';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service';
import type { OcrProviderType } from '../../common/ai-models';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpeg', '.jpg'];
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly encryption: EncryptionService,
  ) {}

  // ── OAuth Flow ──────────────────────────────────────────

  getAuthorizationUrl(companyId: string, slot: number = 1): { url: string } {
    const oauth2 = this.createOAuth2Client();
    const state = `${companyId}:${slot}`;
    const url = oauth2.generateAuthUrl({
      access_type: 'offline', prompt: 'consent', scope: GMAIL_SCOPES, state,
    });
    return { url };
  }

  async handleOAuthCallback(code: string, state: string) {
    const [companyId, slotStr] = state.split(':');
    const slot = parseInt(slotStr || '1', 10);

    const oauth2 = this.createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress || null;

    const encryptedCredentials = this.encryption.encrypt({ refreshToken: tokens.refresh_token! });

    const existing = await this.prisma.companyIntegration.findUnique({
      where: { companyId_slot: { companyId, slot } },
    });

    if (existing) {
      await this.prisma.companyIntegration.update({
        where: { id: existing.id },
        data: {
          type: 'GMAIL',
          status: 'CONNECTED',
          externalId: email,
          credentials: encryptedCredentials,
          config: { email },
          connectedAt: new Date(),
          errorMessage: null,
        },
      });
    } else {
      await this.prisma.companyIntegration.create({
        data: {
          companyId,
          slot,
          type: 'GMAIL',
          status: 'CONNECTED',
          externalId: email,
          credentials: encryptedCredentials,
          config: { email },
          connectedAt: new Date(),
        },
      });
    }
    return { email, companyId, slot };
  }

  // ── OCR Provider Settings ───────────────────────────────

  async getOcrProvider(companyId: string) {
    const s = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
    return { ocrProvider: s?.ocrProvider ?? 'GEMINI' };
  }

  async updateOcrProvider(companyId: string, provider: OcrProviderType) {
    const s = await this.prisma.companyScanSettings.upsert({
      where: { companyId },
      create: { companyId, ocrProvider: provider },
      update: { ocrProvider: provider },
    });
    return { ocrProvider: s.ocrProvider };
  }

  async getOcrAutoFixesEnabled(companyId: string) {
    const s = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
    return { ocrAutoFixesEnabled: s?.ocrAutoFixesEnabled ?? true };
  }

  async updateOcrAutoFixes(companyId: string, enabled: boolean) {
    const s = await this.prisma.companyScanSettings.upsert({
      where: { companyId },
      create: { companyId, ocrAutoFixesEnabled: enabled },
      update: { ocrAutoFixesEnabled: enabled },
    });
    return { ocrAutoFixesEnabled: s.ocrAutoFixesEnabled };
  }

  // ── Scan Logs ───────────────────────────────────────────

  async getScanLogs(companyId: string, limit = 50) {
    return this.prisma.emailScanLog.findMany({
      where: { companyId, status: { not: 'NO_ATTACHMENTS' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        deliveryNotes: { select: { id: true, supplierName: true, status: true, originalFileUrl: true, originalFileName: true } },
        attachments: { select: { id: true, fileName: true, filePath: true, status: true, documentType: true, documentId: true, errorMessage: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async dismissScanLog(companyId: string, scanLogId: string) {
    const log = await this.prisma.emailScanLog.findFirst({ where: { id: scanLogId, companyId } });
    if (!log) throw new Error('Scan log not found');
    await this.prisma.emailScanLog.update({
      where: { id: scanLogId },
      data: { status: 'FAILED', errorMessage: log.errorMessage ? `${log.errorMessage} (בוטל ידנית)` : 'בוטל ידנית' },
    });
    return { message: 'Scan log dismissed' };
  }

  async isScanning(companyId?: string): Promise<boolean> {
    if (!companyId) {
      const company = await this.prisma.company.findFirst();
      if (!company) return false;
      companyId = company.id;
    }
    return this.queueService.isScanRunning(companyId);
  }

  // ── Blocked Email Rules ────────────────────────────────

  async getBlockedRules(companyId: string) {
    const s = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
    return { rules: ((s?.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>) };
  }

  async addBlockedRule(companyId: string, type: 'sender' | 'subject', pattern: string) {
    const s = await this.prisma.companyScanSettings.findUniqueOrThrow({ where: { companyId } });
    const rules = (s.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
    rules.push({ type, pattern });
    await this.prisma.companyScanSettings.update({ where: { companyId }, data: { blockedEmailRules: rules } });
    return { rules };
  }

  async removeBlockedRule(companyId: string, index: number) {
    const s = await this.prisma.companyScanSettings.findUniqueOrThrow({ where: { companyId } });
    const rules = (s.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
    if (index < 0 || index >= rules.length) throw new Error('Invalid rule index');
    rules.splice(index, 1);
    await this.prisma.companyScanSettings.update({ where: { companyId }, data: { blockedEmailRules: rules } });
    return { rules };
  }

  // ── Local Folders ───────────────────────────────────────

  async listLocalFolders(): Promise<Array<{ name: string; fileCount: number }>> {
    const dir = path.resolve(__dirname, '../../..', 'test-data');
    try { await fs.access(dir); } catch { return []; }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const folders: Array<{ name: string; fileCount: number }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const files = await fs.readdir(path.join(dir, entry.name));
      folders.push({ name: entry.name, fileCount: files.filter((f) => ALLOWED_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))).length });
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Public Helpers (used by GmailScannerService) ────────

  createGmailClient(refreshToken: string | null): gmail_v1.Gmail | null {
    const token = refreshToken || this.config.get('gmail.refreshToken');
    if (!token) return null;
    const oauth2 = this.createOAuth2Client();
    oauth2.setCredentials({ refresh_token: token });
    return google.gmail({ version: 'v1', auth: oauth2 });
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(this.config.get('gmail.clientId'), this.config.get('gmail.clientSecret'), this.config.get('gmail.redirectUri'));
  }
}
