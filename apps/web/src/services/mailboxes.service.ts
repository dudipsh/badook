import { apiClient } from './api-client';

export type MailboxType = 'GMAIL' | 'OUTLOOK';
export type MailboxStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface Mailbox {
  id: string | null;
  slot: number;
  type: MailboxType | null;
  status: MailboxStatus;
  externalId: string | null;
  scanDaysBack: number;
  scanSent: boolean;
  connectedAt: string | null;
  lastScannedAt: string | null;
  errorMessage: string | null;
}

export const mailboxesService = {
  list: () => apiClient.get<{ slots: Mailbox[] }>('/mailboxes').then((r) => r.data),

  update: (id: string, data: { scanDaysBack?: number; scanSent?: boolean }) =>
    apiClient.patch<Mailbox>(`/mailboxes/${id}`, data).then((r) => r.data),

  disconnect: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/mailboxes/${id}`).then((r) => r.data),

  getGmailAuthUrl: (slot: number) =>
    apiClient.get<{ url: string }>(`/gmail/oauth/url`, { params: { slot } }).then((r) => r.data),

  getOutlookAuthUrl: (slot: number) =>
    apiClient.get<{ url: string }>(`/outlook/oauth/url`, { params: { slot } }).then((r) => r.data),

  triggerGmailScan: (mailboxId: string) =>
    apiClient.post<{ message: string }>(`/gmail/trigger/${mailboxId}`).then((r) => r.data),

  triggerOutlookScan: (mailboxId: string) =>
    apiClient.post<{ message: string }>(`/outlook/trigger/${mailboxId}`).then((r) => r.data),
};
