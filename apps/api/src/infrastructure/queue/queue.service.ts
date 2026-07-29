import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import {
  DOCUMENT_QUEUE,
  type DocumentProcessingJobData,
  type QueueServiceInterface,
} from './queue.types';
import type { FileProcessingResult } from '../../intelligence/agents/agent.types';

const SCAN_LOCK_PREFIX = 'sagur:scan-lock:';
const SCAN_LOCK_TTL = 1800; // 30 minutes in seconds

@Injectable()
export class QueueService implements QueueServiceInterface, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redis: InstanceType<typeof IORedis>;
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue(DOCUMENT_QUEUE) private readonly documentQueue: Queue,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('redis.url')!;
    this.redis = new IORedis(redisUrl);
    // QueueEvents needs its own connection — pass URL string to avoid ioredis version mismatch
    this.queueEvents = new QueueEvents(DOCUMENT_QUEUE, {
      connection: { url: redisUrl },
    });
  }

  async onModuleDestroy() {
    await this.queueEvents.close();
    this.redis.disconnect();
  }

  async addDocumentJob(data: DocumentProcessingJobData): Promise<string> {
    const job = await this.documentQueue.add('process-file', data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
    this.logger.log(
      `Enqueued document job ${job.id} for ${data.context.originalFileName || data.context.filePath}`,
    );
    return job.id!;
  }

  async addDocumentJobsAndWait(
    jobs: DocumentProcessingJobData[],
  ): Promise<FileProcessingResult[]> {
    if (jobs.length === 0) return [];

    // Enqueue all jobs
    const enqueuedJobs: Job[] = [];
    for (const data of jobs) {
      const job = await this.documentQueue.add('process-file', data, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });
      enqueuedJobs.push(job);
    }

    this.logger.log(
      `Enqueued ${enqueuedJobs.length} document jobs, waiting for completion...`,
    );

    // Wait for all jobs to complete or fail
    const results: FileProcessingResult[] = [];
    for (const job of enqueuedJobs) {
      try {
        const returnVal = await job.waitUntilFinished(this.queueEvents, 660_000); // 11 min — must exceed JOB_TIMEOUT_MS
        results.push(returnVal?.result ?? { processed: 0, skipped: 0, failed: 0, errors: [], documents: [] });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Job ${job.id} failed: ${errMsg}`);
        results.push({
          processed: 0,
          skipped: 0,
          failed: 1,
          errors: [errMsg],
          documents: [],
        });
      }
    }

    return results;
  }

  async isScanRunning(companyId: string): Promise<boolean> {
    const val = await this.redis.get(`${SCAN_LOCK_PREFIX}${companyId}`);
    return val === '1';
  }

  async setScanRunning(companyId: string, running: boolean): Promise<void> {
    const key = `${SCAN_LOCK_PREFIX}${companyId}`;
    if (running) {
      await this.redis.set(key, '1', 'EX', SCAN_LOCK_TTL);
    } else {
      await this.redis.del(key);
    }
  }

  async tryAcquireScanLock(companyId: string): Promise<boolean> {
    const key = `${SCAN_LOCK_PREFIX}${companyId}`;
    // Atomic set-if-not-exists with 30min TTL — two concurrent calls cannot both succeed
    const result = await this.redis.set(key, '1', 'EX', SCAN_LOCK_TTL, 'NX');
    return result === 'OK';
  }

  async renewScanLock(companyId: string): Promise<void> {
    const key = `${SCAN_LOCK_PREFIX}${companyId}`;
    await this.redis.expire(key, SCAN_LOCK_TTL);
  }

  async cancelAllJobs(): Promise<number> {
    const waiting = await this.documentQueue.getJobs(['waiting', 'delayed']);
    let removed = 0;
    for (const job of waiting) {
      try {
        await job.remove();
        removed++;
      } catch {
        // Job may have started processing between getJobs and remove
      }
    }
    this.logger.log(`Cancelled ${removed} waiting/delayed jobs`);
    return removed;
  }
}
