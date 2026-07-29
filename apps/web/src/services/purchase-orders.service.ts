import { apiClient } from './api-client';

export interface ExtractedQuoteData {
  fileUrl: string;
  poNumber: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  vatNumber: string | null;
  orderDate: string | null;
  expectedDelivery: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  notes: string | null;
  lineItems: Array<{
    description: string;
    catalogNumber: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number | null;
    totalPrice: number | null;
    discountPercent: number | null;
  }>;
  confidence: number;
}

export interface CreatePOPayload {
  poNumber: string;
  supplierName: string;
  projectId?: string;
  orderDate?: string;
  expectedDelivery?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string;
  paymentTerms?: string;
  vendorAddress?: string;
  vatNumber?: string;
  withholdingTax?: string;
  siteContact?: string;
  sitePhone?: string;
  deliveryNotes?: string;
  originalFileUrl?: string;
  lineItems?: Array<{
    description: string;
    catalogNumber?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
    discountPercent?: number;
  }>;
}

export interface ExistingPO {
  id: string;
  poNumber: string;
  supplierName: string;
  totalAmount: number | null;
  status: string;
  createdAt: string;
}

export const purchaseOrdersService = {
  extractQuote(file: File): Promise<ExtractedQuoteData> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<ExtractedQuoteData>('/purchase-orders/extract-quote', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      .then((r) => r.data);
  },

  search(query: string): Promise<{ data: ExistingPO[]; total: number }> {
    return apiClient
      .get<{ data: ExistingPO[]; total: number }>('/purchase-orders', {
        params: { search: query, limit: 5 },
      })
      .then((r) => r.data);
  },

  create(payload: CreatePOPayload): Promise<any> {
    return apiClient
      .post('/purchase-orders', payload)
      .then((r) => r.data);
  },
};
