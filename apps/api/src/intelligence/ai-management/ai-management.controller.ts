import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { AiQuotaService } from './ai-quota.service';
import { AI_MODEL_CATALOG } from './ai-models.catalog';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

@Controller('admin')
@UseGuards(AuthGuard, SuperAdminGuard)
export class AiManagementController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
    private readonly quota: AiQuotaService,
  ) {}

  @Get('ai-models')
  listModels() {
    return AI_MODEL_CATALOG;
  }

  @Get('companies/:id/ai')
  async getCompanyAi(@Param('id') id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('חברה לא נמצאה');
    const [settings, usage] = await Promise.all([
      this.settings.getOrCreate(id),
      this.quota.getUsage(id),
    ]);
    return { company, settings, usage };
  }

  @Patch('companies/:id/ai')
  updateCompanyAi(@Param('id') id: string, @Body() dto: UpdateAiSettingsDto) {
    return this.settings.update(id, dto);
  }

  @Get('companies/:id/ai/usage')
  usageHistory(@Param('id') id: string, @Query('months') months?: string) {
    return this.quota.getUsageHistory(id, months ? parseInt(months, 10) : 6);
  }
}
