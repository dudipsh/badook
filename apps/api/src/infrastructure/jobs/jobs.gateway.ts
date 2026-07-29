import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import IORedis from 'ioredis';
import { JobsService } from './jobs.service';
import type { ScanLogEntry } from './scan-logger.service';

const REDIS_CHANNEL = 'budapest:socket-events';

@SkipThrottle()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class JobsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsGateway.name);
  private redisPub?: InstanceType<typeof IORedis>;
  private redisSub?: InstanceType<typeof IORedis>;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly jobsService: JobsService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('redis.url');
    if (!redisUrl) return;

    // Publisher — used by worker process to send events to main server
    this.redisPub = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    // Subscriber — main server listens and forwards to Socket.IO clients
    this.redisSub = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.redisSub.subscribe(REDIS_CHANNEL).catch(() => {});
    this.redisSub.on('message', (_channel: string, message: string) => {
      if (!this.server) return; // Only main server forwards events
      try {
        const { companyId, event, data } = JSON.parse(message);
        this.server.to(`company:${companyId}`).emit(event, data);
      } catch {
        // ignore malformed messages
      }
    });
  }

  async onModuleDestroy() {
    await this.redisPub?.quit().catch(() => {});
    await this.redisSub?.quit().catch(() => {});
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn('WebSocket connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('jwt.secret'),
      });

      const companyId = payload.companyId;
      if (!companyId) {
        this.logger.warn('WebSocket connection rejected: no companyId in token');
        client.disconnect();
        return;
      }

      // Store companyId on socket for later use
      (client as any).companyId = companyId;
      (client as any).userId = payload.sub;

      // Join company room
      client.join(`company:${companyId}`);
      this.logger.log(`Client connected: ${client.id} → company:${companyId}`);

      // Send active jobs on connect
      const activeJobs = await this.jobsService.getActiveByCompany(companyId);
      if (activeJobs.length > 0) {
        client.emit('jobs:active', activeJobs);
      }
    } catch (error) {
      this.logger.warn(`WebSocket auth failed: ${error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  private emit(companyId: string, event: string, data: any) {
    if (this.server) {
      // Main server — emit directly via Socket.IO
      this.server.to(`company:${companyId}`).emit(event, data);
    } else if (this.redisPub) {
      // Worker process — publish to Redis, main server will forward
      this.redisPub.publish(REDIS_CHANNEL, JSON.stringify({ companyId, event, data }));
    }
  }

  emitProgress(companyId: string, jobId: string, stage: string, stageStatus: string, message?: string) {
    this.emit(companyId, 'job:progress', { jobId, stage, status: stageStatus, message });
  }

  emitComplete(companyId: string, jobId: string, documentId: string, documentType: string) {
    this.emit(companyId, 'job:complete', { jobId, documentId, documentType });
  }

  emitFailed(companyId: string, jobId: string, error: string) {
    this.emit(companyId, 'job:failed', { jobId, error });
  }

  emitScanStarted(companyId: string, source: 'gmail' | 'local' | 'manual' | 'outlook') {
    this.emit(companyId, 'scan:started', { source });
  }

  emitScanProgress(companyId: string, data: { processed: number; total: number }) {
    this.emit(companyId, 'scan:progress', data);
  }

  emitScanComplete(companyId: string, source: 'gmail' | 'local' | 'manual' | 'outlook') {
    this.emit(companyId, 'scan:complete', { source });
  }

  emitScanLog(companyId: string, entry: ScanLogEntry) {
    this.emit(companyId, 'scan:log', entry);
  }

  emitMatchingStarted(companyId: string, projectId?: string) {
    this.emit(companyId, 'matching:started', { projectId });
  }

  emitMatchingComplete(companyId: string, projectId?: string, matchesCreated?: number) {
    this.emit(companyId, 'matching:complete', { projectId, matchesCreated });
  }

  emitDataChanged(companyId: string, entity: string, data?: any) {
    this.emit(companyId, 'data:changed', { entity, data });
  }
}
