import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { StartTrainingDto } from './dto/start-training.dto';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async start(dto: StartTrainingDto) {
    const active = await this.prisma.trainingJob.findFirst({
      where: { status: { in: ['PENDING', 'EXPORTING', 'TRAINING'] } },
    });
    if (active) {
      throw new ConflictException(
        `Another training job is already in progress (id=${active.id}, status=${active.status})`,
      );
    }

    const sampleCount = await this.prisma.sample.count({
      where: {
        status: { in: ['LABELED', 'VERIFIED'] },
        groundTruth: { not: 'null' as any },
      },
    });

    if (sampleCount === 0) {
      throw new ConflictException('No labeled samples with ground truth available for training');
    }

    const job = await this.prisma.trainingJob.create({
      data: {
        status: 'PENDING',
        baseModel: dto.baseModel || 'gemini-2.0-flash-001',
        epochs: dto.epochs || 3,
        startedBy: dto.startedBy,
        sampleCount,
      },
    });

    this.spawnRunner(job.id);
    return job;
  }

  list() {
    return this.prisma.trainingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async get(id: string) {
    const job = await this.prisma.trainingJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Training job ${id} not found`);
    return job;
  }

  /**
   * Spawn the training runner as a detached background process.
   * The runner survives even if this server restarts.
   */
  private spawnRunner(jobId: string) {
    const runnerPath = path.join(__dirname, 'training-runner.js');
    const baseUrl = process.env.SELF_BASE_URL || 'http://localhost:3002';
    const apiKey = process.env.API_KEY || '';

    const child = spawn('node', [runnerPath, jobId], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        TRAINING_JOB_ID: jobId,
        SELF_BASE_URL: baseUrl,
        SELF_API_KEY: apiKey,
      },
    });
    child.unref();
    this.logger.log(`Spawned training runner for job ${jobId} (pid=${child.pid})`);
  }
}
