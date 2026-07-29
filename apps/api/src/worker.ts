import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Worker');

  if (!process.env.REDIS_URL) {
    logger.error('REDIS_URL is required for the worker process. Exiting.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(WorkerModule);
  logger.log('Worker process started — listening for BullMQ jobs');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
