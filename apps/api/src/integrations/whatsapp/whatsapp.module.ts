import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { ProjectsModule } from '../../domain/projects/projects.module';
import { MatchingModule } from '../../domain/matching/matching.module';

@Module({
  imports: [AuthModule, ProjectsModule, MatchingModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppWebhookService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
