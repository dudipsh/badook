import { Module } from '@nestjs/common';
import { LabelingController } from './labeling.controller';
import { LabelingService } from './labeling.service';
import { ExportService } from './export.service';
import { PrismaService } from '../common/prisma.service';
import { OcrModule } from '../ocr/ocr.module';
import { RefDataModule } from '../ref-data/ref-data.module';

@Module({
  imports: [OcrModule, RefDataModule],
  controllers: [LabelingController],
  providers: [LabelingService, ExportService, PrismaService],
})
export class LabelingModule {}
