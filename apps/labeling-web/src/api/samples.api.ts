import apiClient from './client';
import type { Sample, PaginatedSamples, Stats, SampleFilters, DocumentType, AiModel } from '@/types/sample.types';

export const fetchSamples = async (filters: SampleFilters): Promise<PaginatedSamples> => {
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.limit,
  };
  if (filters.status) params.status = filters.status;
  if (filters.documentType) params.documentType = filters.documentType;
  if (filters.search) params.search = filters.search;

  const { data } = await apiClient.get<PaginatedSamples>('/samples', { params });
  return data;
};

export const fetchSample = async (id: string): Promise<Sample> => {
  const { data } = await apiClient.get<Sample>(`/samples/${id}`);
  return data;
};

export const checkDuplicate = async (fileName: string): Promise<{ isDuplicate: boolean; existingId: string | null; existingFileName: string | null }> => {
  const { data } = await apiClient.get<{ isDuplicate: boolean; existingId: string | null; existingFileName: string | null }>(
    '/samples/check-duplicate',
    { params: { fileName } },
  );
  return data;
};

export const uploadSample = async (file: File, replaceId?: string): Promise<Sample[]> => {
  const formData = new FormData();
  formData.append('file', file);
  if (replaceId) formData.append('replaceId', replaceId);

  const { data } = await apiClient.post<Sample[]>('/samples/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateGroundTruth = async (
  id: string,
  groundTruth: unknown,
  tags?: string[],
  notes?: string,
): Promise<Sample> => {
  const body: Record<string, unknown> = { groundTruth };
  if (tags) body.tags = tags;
  if (notes !== undefined) body.notes = notes;

  const { data } = await apiClient.patch<Sample>(`/samples/${id}/ground-truth`, body);
  return data;
};

export const verifySample = async (id: string): Promise<Sample> => {
  const { data } = await apiClient.post<Sample>(`/samples/${id}/verify`);
  return data;
};

export const reExtractSample = async (id: string, modelId?: string): Promise<Sample> => {
  if (modelId === 'gemini-finetuned') {
    const { data } = await apiClient.post<Sample>(`/samples/${id}/re-extract-finetuned`);
    return data;
  }
  // Default: Gemini base
  const { data } = await apiClient.post<Sample>(`/samples/${id}/re-extract`);
  return data;
};

export const fetchModels = async (): Promise<AiModel[]> => {
  const { data } = await apiClient.get<AiModel[]>('/models');
  return data;
};

export const updateDocumentType = async (id: string, documentType: DocumentType): Promise<Sample> => {
  const { data } = await apiClient.patch<Sample>(`/samples/${id}/document-type`, { documentType });
  return data;
};

export const deleteSample = async (id: string): Promise<Sample> => {
  const { data } = await apiClient.delete<Sample>(`/samples/${id}`);
  return data;
};

export const fetchStats = async (): Promise<Stats> => {
  const { data } = await apiClient.get<Stats>('/stats');
  return data;
};

export const getFileUrl = (sampleId: string): string => {
  return `/api/files/${sampleId}`;
};

export const checkHealth = async (): Promise<{ status: string; timestamp: string }> => {
  const { data } = await apiClient.get('/health');
  return data;
};
