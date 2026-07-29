import { labelingApi } from '../../../../services/labeling-api.client';

export type TrainingJobStatus = 'PENDING' | 'EXPORTING' | 'TRAINING' | 'SUCCEEDED' | 'FAILED';

export interface TrainingJob {
  id: string;
  status: TrainingJobStatus;
  baseModel: string;
  epochs: number;
  sampleCount: number | null;
  gcsTrainUri: string | null;
  vertexJobName: string | null;
  tunedModelName: string | null;
  tunedModelEndpoint: string | null;
  error: string | null;
  startedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const trainingApi = {
  start: async (startedBy?: string): Promise<TrainingJob> => {
    const { data } = await labelingApi.post<TrainingJob>('/training/start', { startedBy });
    return data;
  },
  list: async (): Promise<TrainingJob[]> => {
    const { data } = await labelingApi.get<TrainingJob[]>('/training/jobs');
    return data;
  },
  get: async (id: string): Promise<TrainingJob> => {
    const { data } = await labelingApi.get<TrainingJob>(`/training/jobs/${id}`);
    return data;
  },
};
