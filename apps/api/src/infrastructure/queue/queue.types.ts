import type { AgentContext, FileProcessingResult } from '../../intelligence/agents/agent.types';

export interface DocumentProcessingJobData {
  context: AgentContext;
  /** ID of the EmailScanAttachment record (if processing an email attachment) */
  attachmentRecordId?: string;
}

export interface DocumentProcessingJobResult {
  result: FileProcessingResult;
}

export interface QueueServiceInterface {
  /** Enqueue a single file for processing. Returns the BullMQ job ID. */
  addDocumentJob(data: DocumentProcessingJobData): Promise<string>;

  /** Enqueue multiple files and wait for all to complete. Returns aggregated results. */
  addDocumentJobsAndWait(
    jobs: DocumentProcessingJobData[],
  ): Promise<FileProcessingResult[]>;

  /** Check if a scan is actively running (used to replace in-memory isScanning flag) */
  isScanRunning(companyId: string): Promise<boolean>;

  /** Mark a company as scanning (distributed lock) */
  setScanRunning(companyId: string, running: boolean): Promise<void>;

  /** Atomically try to acquire the scan lock. Returns true if acquired, false if already held. */
  tryAcquireScanLock(companyId: string): Promise<boolean>;

  /** Extend the scan lock TTL (call periodically during long scans) */
  renewScanLock(companyId: string): Promise<void>;

  /** Remove all waiting/delayed jobs from the queue. Returns count of removed jobs. */
  cancelAllJobs(): Promise<number>;
}

export const QUEUE_SERVICE = 'QUEUE_SERVICE';
export const DOCUMENT_QUEUE = 'document-processing';
