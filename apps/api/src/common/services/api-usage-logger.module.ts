import { Module } from '@nestjs/common';
import { ApiUsageLoggerService } from './api-usage-logger.service';

@Module({
  providers: [ApiUsageLoggerService],
  exports: [ApiUsageLoggerService],
})
export class ApiUsageLoggerModule {}
