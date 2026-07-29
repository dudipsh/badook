import { apiClient } from './api-client';

export type ChatRole = 'USER' | 'ASSISTANT';

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  id: string;
  type: 'IMAGE';
  mimeType: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  cards?: ChatCard[];
}

export interface CompanyOverviewCardData {
  projectCount: number;
  supplierCount: number;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
  matchedCount: number;
  unmatchedOrPartialCount: number;
}

export interface ProjectSummaryCardData {
  id: string;
  name: string;
  address: string | null;
  isArchived: boolean;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
  totalInvoiceAmountIls: number;
  totalPurchaseOrderAmountIls: number;
  matchSummary: Record<string, number>;
  matchRate: number | null;
}

export interface ProjectListItem {
  id: string;
  name: string;
  address: string | null;
  isArchived: boolean;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
}

export interface ProjectListCardData {
  count: number;
  projects: ProjectListItem[];
}

export interface SupplierListItem {
  id: string;
  name: string;
  businessId: string | null;
  phone: string | null;
  email: string | null;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
}

export interface SupplierListCardData {
  count: number;
  suppliers: SupplierListItem[];
}

export interface DiscrepancyListItem {
  id: string;
  status: string;
  projectName: string | null;
  supplierName: string | null;
  poNumber: string | null;
  invoiceNumbers: string[];
  deliveryNoteNumbers: string[];
  totalInvoiceAmountIls: number;
  totalPoAmountIls: number;
  notes: string | null;
  createdAt: string;
}

export interface DiscrepancyListCardData {
  count: number;
  discrepancies: DiscrepancyListItem[];
}

export interface ItemSupplyBreakdownRow {
  key: string;
  label: string;
  id: string | null;
  totalQuantity: number;
  totalSpend: number;
  documentCount: number;
}

export interface ItemSupplySource {
  type: 'invoice' | 'delivery_note' | 'purchase_order';
  number: string | null;
  docId: string | null;
}

export interface ItemSupplierBreakdownRow {
  key: string;
  label: string;
  totalQuantity: number;
  avgUnitPrice: number | null;
  totalSpend: number;
  sharePct: number;
  supplierId: string | null;
  firstDate: string | null;
  lastDate: string | null;
  source: ItemSupplySource | null;
}

export interface ItemSupplyLeadingSupplier {
  name: string;
  totalQuantity: number;
  totalSpend: number;
  sharePct: number;
}

export interface ItemSupplyPriceInsight {
  kind: 'stable' | 'variance';
  variancePct: number | null;
  supplierName: string | null;
  docNumber: string | null;
  outlierUnitPrice: number | null;
  avgUnitPrice: number | null;
  estBudgetImpact: number | null;
}

export interface ItemSupplySummaryCardData {
  itemQuery: string;
  docType: string;
  groupBy: string;
  itemCode: string | null;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  matchedLineCount: number;
  documentCount: number;
  sourceDocCounts: { invoices: number; deliveryNotes: number };
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  leadingSupplier: ItemSupplyLeadingSupplier | null;
  supplierBreakdown: ItemSupplierBreakdownRow[];
  priceInsight: ItemSupplyPriceInsight | null;
  breakdown: ItemSupplyBreakdownRow[];
  sampleDescriptions: string[];
  truncated: boolean;
}

export interface ItemDocumentRow {
  type: 'invoice' | 'delivery_note' | 'purchase_order';
  docId: string;
  docNumber: string | null;
  docDate: string | null;
  projectId: string | null;
  projectName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  totalQuantity: number;
  unit: string | null;
  avgUnitPrice: number | null;
  lineTotal: number;
  lineCount: number;
}

export interface ItemDocumentsCardData {
  itemQuery: string;
  docType: string;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  count: number;
  totalDocuments: number;
  documents: ItemDocumentRow[];
  truncated: boolean;
}

export interface ChatScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type ChatCard =
  | { id: string; kind: 'company_overview'; data: CompanyOverviewCardData }
  | { id: string; kind: 'project_summary'; data: ProjectSummaryCardData }
  | { id: string; kind: 'project_list'; data: ProjectListCardData }
  | { id: string; kind: 'supplier_list'; data: SupplierListCardData }
  | { id: string; kind: 'discrepancy_list'; data: DiscrepancyListCardData }
  | { id: string; kind: 'item_supply_summary'; data: ItemSupplySummaryCardData }
  | { id: string; kind: 'item_documents'; data: ItemDocumentsCardData };

export type ChatStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'card'; card: ChatCard }
  | { type: 'done'; messageId: string; title?: string }
  | { type: 'error'; message: string };

export const listConversations = async (): Promise<ChatConversation[]> => {
  const { data } = await apiClient.get<ChatConversation[]>('/chat/conversations');
  return data;
};

export const createConversation = async (): Promise<ChatConversation> => {
  const { data } = await apiClient.post<ChatConversation>('/chat/conversations', {});
  return data;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await apiClient.delete(`/chat/conversations/${id}`);
};

export const listMessages = async (conversationId: string): Promise<ChatMessage[]> => {
  const { data } = await apiClient.get<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages`,
  );
  return data;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const attachmentRawUrl = (id: string) =>
  `${API_URL}/chat/attachments/${id}/raw`;

export const uploadAttachment = async (file: File): Promise<ChatAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ChatAttachment>('/chat/attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  const ext = blob.type.includes('webm') ? 'webm' : 'ogg';
  formData.append('audio', blob, `voice.${ext}`);
  const { data } = await apiClient.post<{ text: string }>('/chat/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.text;
};

export const streamMessage = async (
  conversationId: string,
  content: string,
  attachmentIds: string[],
  scope: ChatScope | undefined,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `${API_URL}/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ content, attachmentIds, ...(scope ? { scope } : {}) }),
      signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      const json = dataLine.slice(6);
      try {
        const event = JSON.parse(json) as ChatStreamEvent;
        onEvent(event);
      } catch {
        // ignore malformed chunks
      }
    }
  }
};
