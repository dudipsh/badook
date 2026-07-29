import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TrainingExportService } from './training-export.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { OcrModule } from '../../intelligence/ocr/ocr.module';
import { PromptsModule } from '../../intelligence/prompts/prompts.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { DeliveryNotesModule } from '../../domain/delivery-notes/delivery-notes.module';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuthModule, OcrModule, PromptsModule, StorageModule, DeliveryNotesModule, ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, TrainingExportService, SuperAdminGuard],
})
export class AdminModule {}
