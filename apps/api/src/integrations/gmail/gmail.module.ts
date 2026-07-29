import { Module, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailScannerService } from './gmail-scanner.service';
import { EmailProcessorService } from './email-processor.service';
import { GmailScannerCron } from './gmail-scanner.cron';
import { GmailController } from './gmail.controller';
import { AuthModule } from '../../identity/auth/auth.module';
import { ProjectsModule } from '../../domain/projects/projects.module';
import { MatchingModule } from '../../domain/matching/matching.module';
import { EncryptionModule } from '../../infrastructure/encryption/encryption.module';
import { OutlookModule } from '../outlook/outlook.module';

@Module({
  imports: [AuthModule, ProjectsModule, MatchingModule, EncryptionModule, forwardRef(() => OutlookModule)],
  controllers: [GmailController],
  providers: [GmailService, GmailScannerService, EmailProcessorService, GmailScannerCron],
  exports: [GmailService, GmailScannerService],
})
export class GmailModule implements OnModuleInit {
  private readonly logger = new Logger(GmailModule.name);

  constructor(private readonly cronService: GmailScannerCron) {}

  onModuleInit() {
    this.cronService.setEnabled(true);
    this.logger.log('✅ Gmail automatic email scanning enabled (every 5 minutes)');
  }
}
