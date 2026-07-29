import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_SERVICE, type QueueServiceInterface } from '../queue/queue.types';
import type { JobStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueServiceInterface,
  ) {}

  async create(data: {
    companyId: string;
    fileName: string;
    userId?: string;
    projectId?: string;
  }) {
    return this.prisma.processingJob.create({
      data: {
        companyId: data.companyId,
        fileName: data.fileName,
        userId: data.userId ?? undefined,
        projectId: data.projectId ?? undefined,
        status: 'PENDING',
      },
    });
  }

  async updateStage(jobId: string, stage: string, stageStatus: string, message?: string) {
    const status: JobStatus = stageStatus === 'failed' ? 'FAILED' : 'RUNNING';
    return this.prisma.processingJob.update({
      where: { id: jobId },
      data: { stage, stageStatus, stageMessage: message ?? null, status },
    });
  }

  async complete(jobId: string, documentId: string, documentType: string) {
    return this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        documentId,
        documentType,
        stage: 'saving',
        stageStatus: 'done',
      },
    });
  }

  async fail(jobId: string, errorMessage: string) {
    return this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage.slice(0, 500),
      },
    });
  }

  async cancelAll(companyId: string) {
    const result = await this.prisma.processingJob.updateMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED', errorMessage: 'Cancelled by user' },
    });

    // Cancel actual BullMQ queue jobs
    const queueCancelled = await this.queueService.cancelAllJobs();
    this.logger.log(`Cancelled ${result.count} DB jobs and ${queueCancelled} queue jobs for company ${companyId}`);

    // Mark stale EmailScanAttachments as FAILED
    await this.prisma.emailScanAttachment.updateMany({
      where: { status: 'PROCESSING', emailScanLog: { companyId } },
      data: { status: 'FAILED', errorMessage: 'בוטל על ידי המשתמש' },
    });

    // Release scan lock so a new scan can start
    await this.queueService.setScanRunning(companyId, false);
    return { cancelled: result.count + queueCancelled };
  }

  async getActiveByCompany(companyId: string) {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);

    // Auto-fail jobs stuck for >10 minutes
    await this.prisma.processingJob.updateMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'RUNNING'] },
        createdAt: { lt: staleThreshold },
      },
      data: { status: 'FAILED', errorMessage: 'Job timed out' },
    });

    return this.prisma.processingJob.findMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecentByCompany(companyId: string, limit = 10) {
    return this.prisma.processingJob.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
