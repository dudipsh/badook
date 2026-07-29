import { apiClient } from './api-client';

export interface AIModelEntry {
  id: string;
  label: string;
  inPerM: number;
  outPerM: number;
  vision: boolean;
  finetuned?: boolean;
}

export interface AISettings {
  id: string;
  companyId: string;
  enabled: boolean;
  defaultModel: string;
  fileModel: string | null;
  maxContextTokens: number;
  thinkingBudget: number;
  maxOutputTokens: number;
  monthlyQueryQuota: number;
  maxAttachmentsPerMessage: number;
  maxAttachmentSizeMb: number;
  autoFilterLargeFiles: boolean;
}

export interface AIUsageSnapshot {
  yearMonth: string;
  queriesUsed: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface CompanyAIResponse {
  company: { id: string; name: string };
  settings: AISettings;
  usage: AIUsageSnapshot;
}

export type AISettingsInput = Partial<Omit<AISettings, 'id' | 'companyId'>>;

export const aiManagementService = {
  get(companyId: string) {
    return apiClient.get<CompanyAIResponse>(`/admin/companies/${companyId}/ai`).then((r) => r.data);
  },
  update(companyId: string, dto: AISettingsInput) {
    return apiClient.patch<AISettings>(`/admin/companies/${companyId}/ai`, dto).then((r) => r.data);
  },
  getUsageHistory(companyId: string, months = 6) {
    return apiClient
      .get<AIUsageSnapshot[]>(`/admin/companies/${companyId}/ai/usage`, { params: { months } })
      .then((r) => r.data);
  },
  listModels() {
    return apiClient.get<AIModelEntry[]>('/admin/ai-models').then((r) => r.data);
  },
};
