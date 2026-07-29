import { Logger } from '@nestjs/common';
import { JobsService } from '../../infrastructure/jobs/jobs.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import type { AgentContext, AgentStage } from './agent.types';

/**
 * Helper class for emitting job stage progress updates via WebSocket and DB.
 * Extracted from AgentOrchestratorService to reduce its size.
 */
export class JobProgressHelper {
  private readonly logger = new Logger(JobProgressHelper.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly jobsGateway: JobsGateway,
  ) {}

  async emitStage(context: AgentContext, stage: AgentStage, status: 'running' | 'done' | 'failed', message?: string) {
    if (!context.jobId) return;
    try {
      await this.jobsService.updateStage(context.jobId, stage, status, message);
      this.jobsGateway.emitProgress(context.companyId, context.jobId, stage, status, message);
    } catch (err) {
      this.logger.warn(`Failed to emit stage update: ${err}`);
    }
  }

  async completeJob(context: AgentContext, documentId: string, documentType: string) {
    if (!context.jobId) return;
    try {
      await this.jobsService.complete(context.jobId, documentId, documentType);
      this.jobsGateway.emitComplete(context.companyId, context.jobId, documentId, documentType);
    } catch (err) {
      this.logger.warn(`Failed to complete job: ${err}`);
    }
  }

  async failJob(context: AgentContext, errorMessage: string) {
    if (!context.jobId) return;
    try {
      await this.jobsService.fail(context.jobId, errorMessage);
      this.jobsGateway.emitFailed(context.companyId, context.jobId, errorMessage);
    } catch (err) {
      this.logger.warn(`Failed to mark job as failed: ${err}`);
    }
  }
}
