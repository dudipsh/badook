import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsGateway } from './jobs.gateway';

export type ScanLogAgent =
  | 'scanner'
  | 'ocr'
  | 'intake'
  | 'extraction'
  | 'verification'
  | 'matching'
  | 'pipeline'
  | 'postScan';

export type ScanLogStatus = 'working' | 'waiting' | 'done' | 'error';

export interface ScanLogEntry {
  timestamp: string;
  agent: ScanLogAgent;
  message: string;
  details?: string;
  status?: ScanLogStatus;
}

const AGENT_LABELS: Record<ScanLogAgent, string> = {
  scanner: 'סורק',
  ocr: 'OCR',
  intake: 'זיהוי',
  extraction: 'חילוץ',
  verification: 'אימות',
  matching: 'התאמה',
  pipeline: 'צינור',
  postScan: 'סיום',
};

@Injectable()
export class ScanLogger {
  private readonly logger = new Logger(ScanLogger.name);
  private readonly verbose: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: JobsGateway,
  ) {
    this.verbose = this.config.get<boolean>('scanLog.verbose') ?? true;
    this.logger.log(`ScanLogger: verbose backend logging ${this.verbose ? 'ENABLED' : 'DISABLED'}`);
  }

  log(
    companyId: string,
    agent: ScanLogAgent,
    message: string,
    details?: string,
    status: ScanLogStatus = 'working',
  ): void {
    const entry: ScanLogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      message,
      details,
      status,
    };

    if (this.verbose) {
      this.logger.log(
        `[${agent}] ${message}${details ? ` | ${details}` : ''}`,
      );
    }

    // Always emit to frontend WebSocket — user must always see scan status
    this.gateway.emitScanLog(companyId, entry);
  }

  /** Emit a "waiting for next agent" transition message */
  transition(companyId: string, fromAgent: ScanLogAgent, toAgent: ScanLogAgent, context?: string): void {
    this.log(companyId, fromAgent, `ממתין ל-${AGENT_LABELS[toAgent]}`, context, 'waiting');
  }
}
