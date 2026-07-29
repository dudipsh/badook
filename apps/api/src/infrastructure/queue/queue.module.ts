import { Global, Module, type DynamicModule, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentProcessingProcessor } from './processors/document-processing.processor';
import { QueueService } from './queue.service';
import { NoopQueueService } from './noop-queue.service';
import { QUEUE_SERVICE, DOCUMENT_QUEUE } from './queue.types';

const logger = new Logger('QueueModule');

@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.warn('REDIS_URL not set — queue disabled, using direct processing');
      return {
        module: QueueModule,
        providers: [
          NoopQueueService,
          { provide: QUEUE_SERVICE, useExisting: NoopQueueService },
        ],
        exports: [QUEUE_SERVICE],
      };
    }

    logger.log('Redis configured — BullMQ queue enabled');
    return {
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          connection: { url: redisUrl },
          defaultJobOptions: {
            removeOnComplete: { age: 24 * 3600, count: 500 },
            removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
          },
        }),
        BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
      ],
      providers: [
        QueueService,
        DocumentProcessingProcessor,
        { provide: QUEUE_SERVICE, useExisting: QueueService },
      ],
      exports: [QUEUE_SERVICE],
    };
  }
}
