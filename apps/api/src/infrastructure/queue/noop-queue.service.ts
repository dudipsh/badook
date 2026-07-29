import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AgentOrchestratorService } from '../../intelligence/agents/agent-orchestrator.service';
import type {
  DocumentProcessingJobData,
  QueueServiceInterface,
} from './queue.types';
import type { FileProcessingResult } from '../../intelligence/agents/agent.types';

/**
 * Fallback queue service used when Redis is not configured.
 * Processes files directly (same as pre-BullMQ behavior).
 * Uses ModuleRef to lazily resolve AgentOrchestratorService
 * (avoids circular dependency during module loading).
 */
@Injectable()
export class NoopQueueService implements QueueServiceInterface, OnModuleInit {
  private readonly logger = new Logger(NoopQueueService.name);
  private scanningCompanies = new Set<string>();
  private orchestrator!: AgentOrchestratorService;

  constructor(private readonly moduleRef: ModuleRef) {
    this.logger.warn('Queue disabled (no REDIS_URL). Using direct processing.');
  }

  onModuleInit() {
    this.orchestrator = this.moduleRef.get(AgentOrchestratorService, { strict: false });
  }

  async addDocumentJob(data: DocumentProcessingJobData): Promise<string> {
    const fakeJobId = `noop-${Date.now()}`;
    // Fire-and-forget to match current behavior
    this.orchestrator.processFile(data.context).catch((err) => {
      this.logger.error(
        `Direct processFile failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return fakeJobId;
  }

  async addDocumentJobsAndWait(
    jobs: DocumentProcessingJobData[],
  ): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = [];
    // Process sequentially (OCR_CONCURRENCY=1 equivalent)
    for (const data of jobs) {
      try {
        const result = await this.orchestrator.processFile(data.context);
        results.push(result);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
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
    return this.scanningCompanies.has(companyId);
  }

  async setScanRunning(companyId: string, running: boolean): Promise<void> {
    if (running) {
      this.scanningCompanies.add(companyId);
    } else {
      this.scanningCompanies.delete(companyId);
    }
  }

  async tryAcquireScanLock(companyId: string): Promise<boolean> {
    if (this.scanningCompanies.has(companyId)) return false;
    this.scanningCompanies.add(companyId);
    return true;
  }

  async renewScanLock(_companyId: string): Promise<void> {
    // No-op in memory mode
  }

  async cancelAllJobs(): Promise<number> {
    return 0;
  }
}
