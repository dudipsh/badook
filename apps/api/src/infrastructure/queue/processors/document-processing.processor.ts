import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import { DOCUMENT_QUEUE } from '../queue.types';
import { AgentOrchestratorService } from '../../../intelligence/agents/agent-orchestrator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanLogger } from '../../jobs/scan-logger.service';
import type { DocumentProcessingJobData } from '../queue.types';
import type { FileProcessingResult } from '../../../intelligence/agents/agent.types';

const JOB_TIMEOUT_MS = 600_000; // 10 minutes — large PDFs (34+ pages) can take ~5min to process

@Processor(DOCUMENT_QUEUE, {
  concurrency: parseInt(process.env.OCR_CONCURRENCY || '2', 10),
  lockDuration: JOB_TIMEOUT_MS,
})
export class DocumentProcessingProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);
  private orchestrator!: AgentOrchestratorService;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
    private readonly scanLogger: ScanLogger,
  ) {
    super();
    this.logger.log(
      `Document processor started (concurrency=${process.env.OCR_CONCURRENCY || '2'})`,
    );
  }

  onModuleInit() {
    this.orchestrator = this.moduleRef.get(AgentOrchestratorService, { strict: false });
  }

  async process(
    job: Job<DocumentProcessingJobData>,
  ): Promise<{ result: FileProcessingResult }> {
    const { context, attachmentRecordId } = job.data;
    const filename = context.originalFileName || context.filePath;
    this.logger.log(`Processing file: ${filename} (job ${job.id})`);

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Job timed out after ${JOB_TIMEOUT_MS / 1000}s`)), JOB_TIMEOUT_MS),
      );
      const result = await Promise.race([
        this.orchestrator.processFile(context),
        timeoutPromise,
      ]);

      // Update the attachment record (email or WhatsApp)
      if (attachmentRecordId) {
        const doc = result.documents[0];
        const status = result.skipped > 0 ? 'SKIPPED' : result.failed > 0 ? 'FAILED' : 'SUCCESS';
        const updateData = {
          status,
          documentType: doc?.documentType ?? null,
          documentId: doc?.documentId ?? null,
          errorMessage: result.errors.length > 0 ? result.errors.join(' | ') : null,
        };

        if (context.source === 'MOBILE') {
          await this.prisma.whatsAppAttachment.update({
            where: { id: attachmentRecordId },
            data: updateData,
          });
        } else {
          await this.prisma.emailScanAttachment.update({
            where: { id: attachmentRecordId },
            data: updateData,
          });
        }
      }

      return { result };
    } catch (error) {
      const errMsg = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 500);
      this.logger.error(`File processing failed: ${filename}`, error);

      if (attachmentRecordId) {
        await this.prisma.emailScanAttachment
          .update({
            where: { id: attachmentRecordId },
            data: { status: 'FAILED', errorMessage: errMsg },
          })
          .catch(() => {});
      }

      this.scanLogger.log(
        context.companyId,
        'ocr',
        `שגיאה בעיבוד ${filename}`,
        errMsg,
        'error',
      );
      throw error; // Let BullMQ handle retry
    }
  }
}
