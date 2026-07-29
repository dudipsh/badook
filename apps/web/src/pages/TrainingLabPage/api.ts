import { labelingApi } from '../../services/labeling-api.client';
import type { Sample, PaginatedSamples, Stats, DocumentType, SampleStatus, ExportRecord } from './types';

export const samplesApi = {
  list: async (params: { page: number; limit: number; status?: SampleStatus; documentType?: DocumentType; search?: string }) => {
    const { data } = await labelingApi.get<PaginatedSamples>('/samples', { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await labelingApi.get<Sample>(`/samples/${id}`);
    return data;
  },

  checkDuplicate: async (fileName: string) => {
    const { data } = await labelingApi.get<{ isDuplicate: boolean; existingId: string | null; existingFileName: string | null }>(
      '/samples/check-duplicate',
      { params: { fileName } },
    );
    return data;
  },

  upload: async (file: File, replaceId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (replaceId) formData.append('replaceId', replaceId);
    const { data } = await labelingApi.post<Sample[]>('/samples/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  updateGroundTruth: async (id: string, groundTruth: unknown, tags?: string[], notes?: string) => {
    const body: Record<string, unknown> = { groundTruth };
    if (tags) body.tags = tags;
    if (notes !== undefined) body.notes = notes;
    const { data } = await labelingApi.patch<Sample>(`/samples/${id}/ground-truth`, body);
    return data;
  },

  verify: async (id: string) => {
    const { data } = await labelingApi.post<Sample>(`/samples/${id}/verify`);
    return data;
  },

  reExtract: async (id: string) => {
    const { data } = await labelingApi.post<Sample>(`/samples/${id}/re-extract`);
    return data;
  },

  reExtractWithModel: async (id: string, modelId: string) => {
    if (modelId === 'gemini-finetuned') {
      const { data } = await labelingApi.post<Sample>(`/samples/${id}/re-extract-finetuned`);
      return data;
    }
    const { data } = await labelingApi.post<Sample>(`/samples/${id}/re-extract`);
    return data;
  },

  fetchModels: async () => {
    const { data } = await labelingApi.get<Array<{ id: string; name: string; provider: string; available: boolean; description?: string }>>('/models');
    return data;
  },

  updateDocumentType: async (id: string, documentType: DocumentType) => {
    const { data } = await labelingApi.patch<Sample>(`/samples/${id}/document-type`, { documentType });
    return data;
  },

  delete: async (id: string) => {
    const { data } = await labelingApi.delete<Sample>(`/samples/${id}`);
    return data;
  },

  stats: async () => {
    const { data } = await labelingApi.get<Stats>('/stats');
    return data;
  },

  fileUrl: (sampleId: string) => {
    const base = import.meta.env.VITE_LABELING_API_URL || '/labeling-api';
    return `${base}/files/${sampleId}`;
  },
};

export const exportsApi = {
  create: async (params: { documentType?: DocumentType; format?: string; minStatus?: 'LABELED' | 'VERIFIED' }) => {
    const { data } = await labelingApi.post<ExportRecord>('/export', params);
    return data;
  },

  list: async () => {
    const { data } = await labelingApi.get<ExportRecord[]>('/exports');
    return data;
  },

  downloadUrl: (id: string) => {
    const base = import.meta.env.VITE_LABELING_API_URL || '/labeling-api';
    return `${base}/exports/${id}/download`;
  },

  download: async (id: string) => {
    const response = await labelingApi.get(`/exports/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${id}.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
