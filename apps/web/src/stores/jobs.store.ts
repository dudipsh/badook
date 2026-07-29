import { makeAutoObservable, runInAction } from 'mobx';
import { socketService } from '../services/socket.service';
import { apiClient } from '../services/api-client';

export interface ProcessingJob {
  id: string;
  companyId: string;
  fileName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  stage: string | null;
  stageStatus: string | null;
  stageMessage: string | null;
  documentId: string | null;
  documentType: string | null;
  errorMessage: string | null;
  projectId: string | null;
  createdAt: string;
}

export interface JobStages {
  intake: 'pending' | 'running' | 'done' | 'failed';
  extraction: 'pending' | 'running' | 'done' | 'failed';
  matching: 'pending' | 'running' | 'done' | 'failed';
  saving: 'pending' | 'running' | 'done' | 'failed';
}

const STAGE_ORDER = ['intake', 'extraction', 'matching', 'saving'] as const;

function buildStages(currentStage: string | null, stageStatus: string | null): JobStages {
  const stages: JobStages = {
    intake: 'pending',
    extraction: 'pending',
    matching: 'pending',
    saving: 'pending',
  };

  if (!currentStage) return stages;

  const currentIdx = STAGE_ORDER.indexOf(currentStage as any);
  if (currentIdx === -1) return stages;

  // All stages before current are done
  for (let i = 0; i < currentIdx; i++) {
    stages[STAGE_ORDER[i]] = 'done';
  }

  // Current stage has its actual status
  stages[STAGE_ORDER[currentIdx]] = (stageStatus as any) || 'running';

  // If current stage is done, show next stage as running so there's always an active indicator
  if (stageStatus === 'done' && currentIdx < STAGE_ORDER.length - 1) {
    stages[STAGE_ORDER[currentIdx + 1]] = 'running';
  }

  return stages;
}

export class JobsStore {
  activeJobs = new Map<string, ProcessingJob>();

  constructor() {
    makeAutoObservable(this);
  }

  private listenersReady = false;

  setupListeners() {
    if (this.listenersReady) return;
    this.listenersReady = true;

    socketService.on('jobs:active', (jobs: ProcessingJob[]) => {
      runInAction(() => {
        for (const job of jobs) {
          if (job.status === 'PENDING' || job.status === 'RUNNING') {
            this.activeJobs.set(job.id, job);
          }
        }
      });
    });

    socketService.on('job:progress', (data: { jobId: string; stage: string; status: string; message?: string }) => {
      runInAction(() => {
        const job = this.activeJobs.get(data.jobId);
        if (job) {
          const prevIdx = STAGE_ORDER.indexOf(job.stage as any);
          const nextIdx = STAGE_ORDER.indexOf(data.stage as any);
          const isForward = nextIdx > prevIdx || (nextIdx === prevIdx && !(job.stageStatus === 'done' && data.status !== 'done'));
          if (isForward) {
            job.stage = data.stage;
            job.stageStatus = data.status;
          }
          job.stageMessage = data.message ?? null;
          job.status = data.status === 'failed' ? 'FAILED' : 'RUNNING';
        }
      });
    });

    socketService.on('job:complete', (data: { jobId: string; documentId: string; documentType: string }) => {
      runInAction(() => {
        const job = this.activeJobs.get(data.jobId);
        if (job) {
          job.status = 'COMPLETED';
          job.documentId = data.documentId;
          job.documentType = data.documentType;
          job.stage = 'saving';
          job.stageStatus = 'done';
        }
        // Remove from active after a short delay so UI can show completion
        setTimeout(() => {
          runInAction(() => { this.activeJobs.delete(data.jobId); });
        }, 3000);
      });
    });

    socketService.on('job:failed', (data: { jobId: string; error: string }) => {
      runInAction(() => {
        const job = this.activeJobs.get(data.jobId);
        if (job) {
          job.status = 'FAILED';
          job.errorMessage = data.error;
        }
        // Remove from active after showing error
        setTimeout(() => {
          runInAction(() => { this.activeJobs.delete(data.jobId); });
        }, 5000);
      });
    });
  }

  addJob(jobId: string, fileName: string, projectId?: string) {
    this.activeJobs.set(jobId, {
      id: jobId,
      companyId: '',
      fileName,
      status: 'RUNNING',
      stage: 'intake',
      stageStatus: 'running',
      stageMessage: null,
      documentId: null,
      documentType: null,
      errorMessage: null,
      projectId: projectId ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  getStages(jobId: string): JobStages | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;
    return buildStages(job.stage, job.stageStatus);
  }

  getJobsForProject(projectId: string): ProcessingJob[] {
    return Array.from(this.activeJobs.values()).filter((j) => j.projectId === projectId);
  }

  /** Remove all PENDING/RUNNING jobs for a project (used when matching completes) */
  clearStaleProjectJobs(projectId: string) {
    for (const [id, job] of this.activeJobs) {
      if (job.projectId === projectId && (job.status === 'PENDING' || job.status === 'RUNNING')) {
        this.activeJobs.delete(id);
      }
    }
  }

  async loadActive() {
    try {
      const { data } = await apiClient.get<ProcessingJob[]>('/jobs/active');
      runInAction(() => {
        // Replace all active jobs with fresh server state (clears stale local jobs)
        this.activeJobs.clear();
        for (const job of data) {
          this.activeJobs.set(job.id, job);
        }
      });
    } catch {
      // Ignore - will get updates via WebSocket
    }
  }

  /** Remove jobs that have been stuck in PENDING/RUNNING for too long */
  cleanupStaleJobs(maxAgeMs = 5 * 60 * 1000) {
    const now = Date.now();
    for (const [id, job] of this.activeJobs) {
      if (
        (job.status === 'PENDING' || job.status === 'RUNNING') &&
        now - new Date(job.createdAt).getTime() > maxAgeMs
      ) {
        this.activeJobs.delete(id);
      }
    }
  }
}
