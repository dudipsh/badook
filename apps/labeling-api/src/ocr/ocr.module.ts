import { Module } from '@nestjs/common';
import { VisionApiService } from './vision-api.service';
import { OcrService } from './ocr.service';

@Module({
  providers: [VisionApiService, OcrService],
  exports: [OcrService],
})
export class OcrModule {}
