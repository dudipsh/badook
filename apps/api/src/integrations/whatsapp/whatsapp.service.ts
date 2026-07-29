import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private twilioClient: Twilio | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const sid = this.config.get<string>('twilio.accountSid');
    const token = this.config.get<string>('twilio.authToken');
    if (sid && token) {
      this.twilioClient = new Twilio(sid, token);
      this.logger.log('Twilio client initialized');
    }
  }

  // -- Global Config --

  getSettings() {
    const sid = this.config.get<string>('twilio.accountSid');
    const token = this.config.get<string>('twilio.authToken');
    const number = this.config.get<string>('twilio.whatsappNumber');
    return {
      connected: !!sid && !!token && !!number,
      whatsappNumber: number || null,
      hasCredentials: !!sid && !!token,
    };
  }

  // -- Outbound Messaging --

  async sendReply(recipientPhone: string, text: string) {
    if (!this.twilioClient) return;
    const from = this.config.get<string>('twilio.whatsappNumber');
    if (!from) return;

    try {
      await this.twilioClient.messages.create({
        body: text,
        from: `whatsapp:${from}`,
        to: `whatsapp:${recipientPhone}`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send WhatsApp reply: ${(err as Error).message}`);
    }
  }

  // -- Scan Logs --

  async getLogs(companyId: string, limit = 50) {
    return this.prisma.whatsAppMessageLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        deliveryNotes: {
          select: { id: true, supplierName: true, status: true, originalFileUrl: true, originalFileName: true },
        },
      },
    });
  }

  // -- Company Lookup --

  async findCompanyBySenderPhone(senderPhone: string): Promise<{ id: string } | null> {
    // Normalize: try with +, without +, and with leading 0
    const digits = senderPhone.replace(/\D/g, '');
    const variants = [
      senderPhone,
      `+${digits}`,
      digits,
      digits.replace(/^972/, '9720'), // Israeli format with 0
    ];

    const allowed = await this.prisma.whatsAppAllowedPhone.findFirst({
      where: { phoneNumber: { in: variants }, isActive: true },
      select: { companyId: true },
    });
    return allowed ? { id: allowed.companyId } : null;
  }

  // -- Allowlist Management --

  async getAllowedPhones(companyId: string) {
    return this.prisma.whatsAppAllowedPhone.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAllowedPhone(companyId: string, dto: { phoneNumber: string; contactName?: string }) {
    return this.prisma.whatsAppAllowedPhone.create({
      data: {
        companyId,
        phoneNumber: dto.phoneNumber,
        contactName: dto.contactName ?? null,
      },
    });
  }

  async updateAllowedPhone(companyId: string, id: string, dto: { contactName?: string; isActive?: boolean }) {
    return this.prisma.whatsAppAllowedPhone.update({
      where: { id, companyId },
      data: {
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeAllowedPhone(companyId: string, id: string) {
    return this.prisma.whatsAppAllowedPhone.delete({
      where: { id, companyId },
    });
  }

  // -- Media Download (Twilio provides direct URLs with basic auth) --

  private static readonly TWILIO_MEDIA_HOSTS = [
    'api.twilio.com',
    'media.twilio.com',
  ];

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const parsed = new URL(mediaUrl);
    if (!WhatsAppService.TWILIO_MEDIA_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
      throw new Error(`Blocked media download: untrusted host ${parsed.hostname}`);
    }

    const sid = this.config.get<string>('twilio.accountSid') || '';
    const token = this.config.get<string>('twilio.authToken') || '';
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to download media: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
