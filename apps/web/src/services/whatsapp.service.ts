import { apiClient } from './api-client';

export interface WhatsAppSettings {
  connected: boolean;
  whatsappNumber: string | null;
  hasCredentials: boolean;
}

export interface WhatsAppAttachment {
  id: string;
  fileName: string;
  filePath: string | null;
  mediaId: string;
  mimeType: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  documentType: string | null;
  documentId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

export interface WhatsAppMessageLog {
  id: string;
  whatsappMessageId: string;
  senderPhone: string;
  senderName: string | null;
  messageType: string;
  caption: string | null;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  mediaCount: number;
  processedCount: number;
  errorMessage: string | null;
  replySent: boolean;
  createdAt: string;
  attachments: WhatsAppAttachment[];
  deliveryNotes: Array<{
    id: string;
    supplierName: string;
    status: string;
    originalFileUrl: string | null;
    originalFileName: string | null;
  }>;
}

export interface WhatsAppAllowedPhone {
  id: string;
  companyId: string;
  phoneNumber: string;
  contactName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const whatsappService = {
  getSettings() {
    return apiClient.get<WhatsAppSettings>('/whatsapp/settings').then((r) => r.data);
  },
  getLogs(limit = 50) {
    return apiClient
      .get<WhatsAppMessageLog[]>('/whatsapp/logs', { params: { limit } })
      .then((r) => r.data);
  },
  sendTest(phoneNumber?: string) {
    return apiClient.post<{ success: boolean; message: string }>('/whatsapp/test', { phoneNumber }).then((r) => r.data);
  },
  getAllowedPhones() {
    return apiClient.get<WhatsAppAllowedPhone[]>('/whatsapp/allowed-phones').then((r) => r.data);
  },
  addAllowedPhone(data: { phoneNumber: string; contactName?: string }) {
    return apiClient.post<WhatsAppAllowedPhone>('/whatsapp/allowed-phones', data).then((r) => r.data);
  },
  updateAllowedPhone(id: string, data: { contactName?: string; isActive?: boolean }) {
    return apiClient.patch<WhatsAppAllowedPhone>(`/whatsapp/allowed-phones/${id}`, data).then((r) => r.data);
  },
  removeAllowedPhone(id: string) {
    return apiClient.delete(`/whatsapp/allowed-phones/${id}`).then((r) => r.data);
  },
};
