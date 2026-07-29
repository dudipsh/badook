import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

// Mirrors the Prisma schema defaults. Used as a fallback when the
// ai_company_settings table hasn't been migrated yet (so chat never breaks).
export const AI_SETTINGS_DEFAULTS = {
  enabled: true,
  defaultModel: 'gemini-2.5-flash',
  fileModel: null as string | null,
  maxContextTokens: 100000,
  thinkingBudget: 24576,
  // Conservative default ≈ the previous global ChatAgent budget so enabling
  // per-company settings doesn't silently multiply existing companies' output.
  maxOutputTokens: 2048,
  monthlyQueryQuota: 1000,
  maxAttachmentsPerMessage: 5,
  maxAttachmentSizeMb: 12,
  autoFilterLargeFiles: true,
};

export type AiSettings = typeof AI_SETTINGS_DEFAULTS & { id: string; companyId: string };

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Returns the company's settings, creating defaults on first touch. Degrades
  // to in-memory defaults if the table doesn't exist yet (pre-migration prod).
  async getOrCreate(companyId: string): Promise<AiSettings> {
    try {
      const existing = await this.prisma.aICompanySettings.findUnique({ where: { companyId } });
      if (existing) return existing as unknown as AiSettings;
      return (await this.prisma.aICompanySettings.create({ data: { companyId } })) as unknown as AiSettings;
    } catch (e: any) {
      if (this.isMissingTable(e)) {
        this.logger.warn('ai_company_settings table missing — falling back to defaults');
        return { id: 'default', companyId, ...AI_SETTINGS_DEFAULTS };
      }
      throw e;
    }
  }

  async update(companyId: string, dto: UpdateAiSettingsDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('חברה לא נמצאה');

    const data: Record<string, unknown> = { ...dto };
    // Empty string from the picker means "no dedicated file model → use default".
    if (data.fileModel === '') data.fileModel = null;

    try {
      return await this.prisma.aICompanySettings.upsert({
        where: { companyId },
        create: { companyId, ...data },
        update: { ...data },
      });
    } catch (e: any) {
      if (this.isMissingTable(e)) {
        throw new ServiceUnavailableException(
          'הגדרות ה-AI אינן זמינות עדיין — נדרשת מיגרציה של מסד הנתונים',
        );
      }
      throw e;
    }
  }

  private isMissingTable(e: any): boolean {
    return e?.code === 'P2021' || /does not exist|relation .* does not exist/i.test(e?.message || '');
  }
}
