import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { VisionApiService } from './vision-api.service';
import { DocumentDetectorService } from './document-detector.service';
import { ApiUsageLoggerModule } from '../../common/services/api-usage-logger.module';
import { PromptsModule } from '../prompts/prompts.module';
import { MatchingModule } from '../../domain/matching/matching.module';

@Module({
  imports: [ApiUsageLoggerModule, PromptsModule, MatchingModule],
  providers: [VisionApiService, DocumentDetectorService, OcrService],
  exports: [OcrService, VisionApiService, DocumentDetectorService],
})
export class OcrModule {}
