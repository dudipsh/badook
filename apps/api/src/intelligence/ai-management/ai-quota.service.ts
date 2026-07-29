import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { estimateCostUsd } from './ai-models.catalog';

export function currentYearMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface UsageSnapshot {
  yearMonth: string;
  queriesUsed: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUsage(companyId: string, yearMonth = currentYearMonth()): Promise<UsageSnapshot> {
    try {
      const row = await this.prisma.aIQuotaUsage.findUnique({
        where: { companyId_yearMonth: { companyId, yearMonth } },
      });
      return {
        yearMonth,
        queriesUsed: row?.queriesUsed ?? 0,
        tokensIn: row?.tokensIn ?? 0,
        tokensOut: row?.tokensOut ?? 0,
        costUsd: row ? Number(row.costUsd) : 0,
      };
    } catch {
      return { yearMonth, queriesUsed: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    }
  }

  async getUsageHistory(companyId: string, months = 6): Promise<UsageSnapshot[]> {
    try {
      const rows = await this.prisma.aIQuotaUsage.findMany({
        where: { companyId },
        orderBy: { yearMonth: 'desc' },
        take: Math.min(Math.max(months, 1), 24),
      });
      return rows.map((r) => ({
        yearMonth: r.yearMonth,
        queriesUsed: r.queriesUsed,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        costUsd: Number(r.costUsd),
      }));
    } catch {
      return [];
    }
  }

  // Soft tracking — fire-and-forget. Never throws into the chat path.
  async consume(companyId: string, input: { model: string; tokensIn: number; tokensOut: number }) {
    const yearMonth = currentYearMonth();
    const costUsd = estimateCostUsd(input.model, input.tokensIn, input.tokensOut);
    try {
      await this.prisma.aIQuotaUsage.upsert({
        where: { companyId_yearMonth: { companyId, yearMonth } },
        create: {
          companyId,
          yearMonth,
          queriesUsed: 1,
          tokensIn: input.tokensIn,
          tokensOut: input.tokensOut,
          costUsd,
        },
        update: {
          queriesUsed: { increment: 1 },
          tokensIn: { increment: input.tokensIn },
          tokensOut: { increment: input.tokensOut },
          costUsd: { increment: costUsd },
        },
      });
    } catch (e: any) {
      this.logger.warn(`AI usage consume skipped: ${e?.message}`);
    }
  }
}
