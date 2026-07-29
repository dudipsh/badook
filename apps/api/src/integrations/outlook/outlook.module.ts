import { Module } from '@nestjs/common';
import { OutlookService } from './outlook.service';
import { OutlookScannerService } from './outlook-scanner.service';
import { OutlookController } from './outlook.controller';
import { AuthModule } from '../../identity/auth/auth.module';
import { ProjectsModule } from '../../domain/projects/projects.module';
import { EncryptionModule } from '../../infrastructure/encryption/encryption.module';

@Module({
  imports: [AuthModule, ProjectsModule, EncryptionModule],
  controllers: [OutlookController],
  providers: [OutlookService, OutlookScannerService],
  exports: [OutlookService, OutlookScannerService],
})
export class OutlookModule {}
