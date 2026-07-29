import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../identity/auth/auth.module';
import { AiManagementController } from './ai-management.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiQuotaService } from './ai-quota.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [AiManagementController],
  providers: [AiSettingsService, AiQuotaService, SuperAdminGuard],
  exports: [AiSettingsService, AiQuotaService],
})
export class AiManagementModule {}
