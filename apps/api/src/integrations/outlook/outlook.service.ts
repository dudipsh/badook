import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service';
import { QUEUE_SERVICE, type QueueServiceInterface } from '../../infrastructure/queue/queue.types';

const OUTLOOK_SCOPES = 'Mail.Read User.Read offline_access';
const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';

@Injectable()
export class OutlookService {
  private readonly logger = new Logger(OutlookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
    private readonly encryption: EncryptionService,
  ) {}

  // ── OAuth Flow ──────────────────────────────────────────

  getAuthorizationUrl(companyId: string, slot: number = 1): { url: string } {
    const state = `${companyId}:${slot}`;
    const params = new URLSearchParams({
      client_id: this.config.get('outlook.clientId')!,
      response_type: 'code',
      redirect_uri: this.config.get('outlook.redirectUri')!,
      scope: OUTLOOK_SCOPES,
      state,
      prompt: 'consent',
      response_mode: 'query',
    });
    return { url: `${AUTH_BASE}/authorize?${params}` };
  }

  async handleOAuthCallback(code: string, state: string) {
    const [companyId, slotStr] = state.split(':');
    const slot = parseInt(slotStr || '1', 10);

    const tokens = await this.exchangeCodeForTokens(code);
    const email = await this.getUserEmail(tokens.access_token);

    const encryptedCredentials = this.encryption.encrypt({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
    });

    const existing = await this.prisma.companyIntegration.findUnique({
      where: { companyId_slot: { companyId, slot } },
    });

    if (existing) {
      await this.prisma.companyIntegration.update({
        where: { id: existing.id },
        data: {
          type: 'OUTLOOK',
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
          type: 'OUTLOOK',
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

  // ── Token Management ────────────────────────────────────

  async getAccessToken(refreshToken: string): Promise<string> {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('outlook.clientId')!,
        client_secret: this.config.get('outlook.clientSecret')!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: OUTLOOK_SCOPES,
      }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (data.error) {
      this.logger.error(`Token refresh failed: ${data.error_description || data.error}`);
      throw new Error(data.error_description || data.error);
    }
    return data.access_token as string;
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

  // ── Private Helpers ─────────────────────────────────────

  private async exchangeCodeForTokens(code: string) {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('outlook.clientId')!,
        client_secret: this.config.get('outlook.clientSecret')!,
        code,
        redirect_uri: this.config.get('outlook.redirectUri')!,
        grant_type: 'authorization_code',
      }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (data.error) {
      this.logger.error(`Token exchange failed: ${data.error_description || data.error}`);
      throw new Error(data.error_description || data.error);
    }
    return data as { access_token: string; refresh_token: string };
  }

  private async getUserEmail(accessToken: string): Promise<string> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as Record<string, any>;
    return (data.mail || data.userPrincipalName || '') as string;
  }
}
