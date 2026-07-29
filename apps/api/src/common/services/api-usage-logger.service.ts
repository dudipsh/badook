import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MODEL_PRICING } from '../ai-models';

// Pricing per 1M tokens (USD)
const PRICING = MODEL_PRICING;

@Injectable()
export class ApiUsageLoggerService {
  private readonly logger = new Logger(ApiUsageLoggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  logUsage(params: {
    companyId: string;
    provider: string;
    model: string;
    operation: string;
    promptTokens: number;
    completionTokens: number;
  }) {
    const { companyId, provider, model, operation, promptTokens, completionTokens } = params;
    const totalTokens = promptTokens + completionTokens;
    const pricing = PRICING[model] || { input: 0, output: 0 };
    const estimatedCostUsd =
      (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    // Fire-and-forget
    this.prisma.apiUsageLog
      .create({
        data: {
          companyId,
          provider,
          model,
          operation,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
      })
      .catch((err) => {
        this.logger.error(`Failed to log API usage: ${err.message}`);
      });
  }
}
