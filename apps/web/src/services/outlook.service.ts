import { apiClient } from './api-client';
import type { EmailScanLog } from './gmail.service';

export interface OutlookSettings {
  scanDaysBack: number;
  scanSent: boolean;
  connected: boolean;
  outlookEmail: string | null;
  connectedAt: string | null;
  ocrProvider: 'OPENAI' | 'GEMINI' | 'GEMINI_FINETUNED';
  ocrAutoFixesEnabled: boolean;
}

export const outlookService = {
  getSettings() {
    return apiClient.get<OutlookSettings>('/outlook/settings').then((r) => r.data);
  },
  updateSettings(data: { scanDaysBack: number; scanSent?: boolean }) {
    return apiClient.patch<OutlookSettings>('/outlook/settings', data).then((r) => r.data);
  },
  triggerScan() {
    return apiClient.post<{ message: string }>('/outlook/trigger').then((r) => r.data);
  },
  getLogs(limit = 50) {
    return apiClient.get<EmailScanLog[]>('/outlook/logs', { params: { limit } }).then((r) => r.data);
  },
  getAuthUrl() {
    return apiClient.get<{ url: string }>('/outlook/oauth/url').then((r) => r.data);
  },
  disconnect() {
    return apiClient.post('/outlook/disconnect').then((r) => r.data);
  },
  retryScanLog(scanLogId: string) {
    return apiClient.post<{ message: string }>(`/outlook/logs/${scanLogId}/retry`).then((r) => r.data);
  },
  retryAttachment(attachmentId: string) {
    return apiClient.post<{ message: string }>(`/outlook/attachments/${attachmentId}/retry`).then((r) => r.data);
  },
  dismissScanLog(scanLogId: string) {
    return apiClient.post<{ message: string }>(`/outlook/logs/${scanLogId}/dismiss`).then((r) => r.data);
  },
  getScanStatus() {
    return apiClient.get<{ scanning: boolean }>('/outlook/scan-status').then((r) => r.data);
  },
  cancelAllJobs() {
    return apiClient.post<{ cancelled: number }>('/jobs/cancel-all').then((r) => r.data);
  },
};
