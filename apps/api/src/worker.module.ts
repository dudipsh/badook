import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AgentsModule } from './intelligence/agents/agents.module';
import { OcrModule } from './intelligence/ocr/ocr.module';
import { AuthModule } from './identity/auth/auth.module';
import configuration from './config/configuration';

/**
 * Worker module — runs BullMQ processors without HTTP/WebSocket servers.
 * Start with: node dist/src/worker.js
 *
 * Imports only the modules needed for document processing:
 * - Config, Prisma, Storage (infra)
 * - Jobs (for progress tracking + WebSocket relay in Phase 2)
 * - Queue (registers BullMQ processors)
 * - Agents (AgentOrchestratorService — the core processing pipeline)
 * - OCR (used by agents)
 * - Auth (needed by JobsModule for JWT verification in gateway)
 *
 * Does NOT import: ScheduleModule, Controllers, Gmail, Upload, Dashboard, etc.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    StorageModule,
    AuthModule,
    JobsModule,
    QueueModule.forRoot(),
    AgentsModule,
    OcrModule,
  ],
})
export class WorkerModule {}
