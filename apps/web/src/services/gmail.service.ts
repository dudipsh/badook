import { apiClient } from './api-client';

export type OcrProvider = 'OPENAI' | 'GEMINI' | 'GEMINI_FINETUNED';

export interface GmailSettings {
  scanDaysBack: number;
  scanSent: boolean;
  connected: boolean;
  gmailEmail: string | null;
  connectedAt: string | null;
  ocrProvider: OcrProvider;
  ocrAutoFixesEnabled: boolean;
}

export interface EmailScanAttachment {
  id: string;
  fileName: string;
  filePath: string | null;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  documentType: string | null;
  documentId: string | null;
  errorMessage: string | null;
}

export interface EmailScanLog {
  id: string;
  gmailMessageId: string;
  subject: string | null;
  senderEmail: string | null;
  senderName: string | null;
  receivedAt: string | null;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NO_ATTACHMENTS' | 'BLOCKED';
  attachmentCount: number;
  processedCount: number;
  errorMessage: string | null;
  createdAt: string;
  attachments: EmailScanAttachment[];
  deliveryNotes: Array<{
    id: string;
    supplierName: string;
    status: string;
    originalFileUrl: string | null;
    originalFileName: string | null;
  }>;
}

export interface BlockedEmailRule {
  type: 'sender' | 'subject';
  pattern: string;
}

export interface LocalFolder {
  name: string;
  fileCount: number;
}

export const gmailService = {
  getSettings() {
    return apiClient.get<GmailSettings>('/gmail/settings').then((r) => r.data);
  },
  updateSettings(data: { scanDaysBack: number; scanSent?: boolean }) {
    return apiClient.patch<GmailSettings>('/gmail/settings', data).then((r) => r.data);
  },
  triggerScan() {
    return apiClient.post<{ message: string }>('/gmail/trigger').then((r) => r.data);
  },
  getLogs(limit = 50) {
    return apiClient.get<EmailScanLog[]>('/gmail/logs', { params: { limit } }).then((r) => r.data);
  },
  getAuthUrl() {
    return apiClient.get<{ url: string }>('/gmail/oauth/url').then((r) => r.data);
  },
  disconnect() {
    return apiClient.post('/gmail/disconnect').then((r) => r.data);
  },
  updateOcrProvider(provider: OcrProvider) {
    return apiClient.patch<{ ocrProvider: OcrProvider }>('/gmail/ocr-provider', { provider }).then((r) => r.data);
  },
  updateOcrAutoFixes(enabled: boolean) {
    return apiClient.patch<{ ocrAutoFixesEnabled: boolean }>('/gmail/ocr-auto-fixes', { enabled }).then((r) => r.data);
  },
  retryScanLog(scanLogId: string) {
    return apiClient.post<{ message: string }>(`/gmail/logs/${scanLogId}/retry`).then((r) => r.data);
  },
  retryAttachment(attachmentId: string) {
    return apiClient.post<{ message: string }>(`/gmail/attachments/${attachmentId}/retry`).then((r) => r.data);
  },
  dismissScanLog(scanLogId: string) {
    return apiClient.post<{ message: string }>(`/gmail/logs/${scanLogId}/dismiss`).then((r) => r.data);
  },
  getScanStatus() {
    return apiClient.get<{ scanning: boolean }>('/gmail/scan-status').then((r) => r.data);
  },
  getLocalFolders() {
    return apiClient.get<LocalFolder[]>('/gmail/local-folders').then((r) => r.data);
  },
  triggerLocalScan(folders: string[]) {
    return apiClient.post<{ message: string }>('/gmail/local-scan', { folders }).then((r) => r.data);
  },
  uploadManualScan(formData: FormData) {
    return apiClient.post<{ started: boolean; fileCount: number }>(
      '/upload/manual-scan',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data);
  },
  cancelAllJobs() {
    return apiClient.post<{ cancelled: number }>('/jobs/cancel-all').then((r) => r.data);
  },
  getBlockedRules() {
    return apiClient.get<{ rules: BlockedEmailRule[] }>('/gmail/blocked-rules').then((r) => r.data);
  },
  addBlockedRule(type: 'sender' | 'subject', pattern: string) {
    return apiClient.post<{ rules: BlockedEmailRule[] }>('/gmail/blocked-rules', { type, pattern }).then((r) => r.data);
  },
  removeBlockedRule(index: number) {
    return apiClient.delete<{ rules: BlockedEmailRule[] }>(`/gmail/blocked-rules/${index}`).then((r) => r.data);
  },
};
