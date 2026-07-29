import { apiClient } from './api-client';
import type { ProjectStats, ProjectVendor, ReconciliationLineItem, VendorPurchaseOrder, ProjectQuote, EditLineItemPayload, LineItemAuditEntry } from '../types/reconciliation';

/* ── Inline types formerly in deleted service files ── */

export interface LineItem {
  id: string;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface DeliveryNote {
  id: string;
  noteNumber: string | null;
  supplierName: string;
  supplierId: string | null;
  deliveryDate: string | null;
  totalAmount: number | null;
  currency: string;
  vatAmount: number | null;
  status: string;
  source: string;
  originalFileUrl: string;
  originalFileName: string | null;
  parsedData: any;
  parsingConfidence: number | null;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  lineItems: LineItem[];
  supplier?: { id: string; name: string } | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
}

export interface POLineItem {
  id: string;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierId: string | null;
  orderDate: string | null;
  expectedDelivery: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  source: string;
  notes: string | null;
  quoteReference: string | null;
  originalFileUrl: string | null;
  createdAt: string;
  lineItems: POLineItem[];
  supplier?: { id: string; name: string } | null;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierId: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string;
  status: string;
  source: string;
  originalFileUrl: string | null;
  createdAt: string;
  lineItems: InvoiceLineItem[];
  supplier?: { id: string; name: string } | null;
}

export interface Discrepancy {
  field: string;
  description: string;
  poValue: string | null;
  dnValue: string | null;
  invValue: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface LineItemPairing {
  matchSource: 'catalog' | 'ai' | 'ai_second_round' | 'feedback' | 'description';
  po?: { description: string; catalogNumber?: string; quantity: number; index: number };
  dn?: { description: string; catalogNumber?: string; quantity: number; index: number };
  inv?: { description: string; catalogNumber?: string; quantity: number; index: number };
}

export interface ThreeWayMatch {
  id: string;
  companyId: string;
  purchaseOrderId: string | null;
  purchaseOrder: PurchaseOrder | null;
  deliveryNotes: DeliveryNote[];
  invoices: Invoice[];
  status: string;
  discrepancies: Discrepancy[] | null;
  lineItemPairings: LineItemPairing[] | null;
  matchedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ProjectAddress {
  id: string;
  address: string;
}

export interface Project {
  id: string;
  name: string;
  address: string | null;
  isArchived: boolean;
  createdAt: string;
  _count?: { deliveryNotes: number; purchaseOrders: number; invoices: number };
  addresses?: ProjectAddress[];
  totalSpend?: number;
  documentCount?: number;
}

export interface ProjectSummary {
  deliveryNotesCount: number;
  deliveryNotesTotal: number;
  purchaseOrdersCount: number;
  purchaseOrdersTotal: number;
  invoicesCount: number;
  invoicesTotal: number;
  matchesCount: number;
}

export interface ProjectFullDetails {
  project: Project;
  summary: ProjectSummary;
  deliveryNotes: DeliveryNote[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  matches: ThreeWayMatch[];
}

interface OrphanDocLineItem {
  description: string;
  catalogNumber: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  sortOrder: number;
}

export interface OrphanDocuments {
  deliveryNotes: Array<{
    id: string;
    noteNumber: string | null;
    supplierName: string;
    deliveryDate: string | null;
    totalAmount: number | null;
    vatAmount: number | null;
    originalFileUrl: string | null;
    createdAt: string;
    status: string;
    parsingConfidence: number | null;
    supplierId: string | null;
    emailScanLog?: { senderEmail: string; senderName: string } | null;
    lineItems: OrphanDocLineItem[];
  }>;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    supplierName: string;
    orderDate: string | null;
    totalAmount: number | null;
    originalFileUrl: string | null;
    createdAt: string;
    supplierId: string | null;
    lineItems: OrphanDocLineItem[];
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    supplierName: string;
    invoiceDate: string | null;
    totalAmount: number | null;
    vatAmount: number | null;
    originalFileUrl: string | null;
    createdAt: string;
    supplierId: string | null;
    lineItems: OrphanDocLineItem[];
  }>;
}

export const projectsService = {
  getAll(includeArchived = false) {
    return apiClient.get<Project[]>('/projects', { params: includeArchived ? { includeArchived: 'true' } : {} }).then((r) => r.data);
  },
  getOne(id: string) {
    return apiClient.get<Project>(`/projects/${id}`).then((r) => r.data);
  },
  getFullDetails(id: string) {
    return apiClient.get<ProjectFullDetails>(`/projects/${id}/full`).then((r) => r.data);
  },
  create(data: Partial<Project>) {
    return apiClient.post<Project>('/projects', data).then((r) => r.data);
  },
  update(id: string, data: Partial<Project>) {
    return apiClient.patch<Project>(`/projects/${id}`, data).then((r) => r.data);
  },
  delete(id: string) {
    return apiClient.delete(`/projects/${id}`).then((r) => r.data);
  },
  getDeliveryNotes(id: string) {
    return apiClient.get(`/projects/${id}/delivery-notes`).then((r) => r.data);
  },
  backfill() {
    return apiClient.post<{ total: number; assigned: number }>('/projects/backfill').then((r) => r.data);
  },
  getStats(id: string) {
    return apiClient.get<ProjectStats>(`/projects/${id}/stats`).then((r) => r.data);
  },
  getVendors(id: string) {
    return apiClient.get<ProjectVendor[]>(`/projects/${id}/vendors`).then((r) => r.data);
  },
  getVendorLineItems(projectId: string, vendorId: string, filters?: { poId?: string; status?: string; groupBy?: string; dateFrom?: string; dateTo?: string }) {
    return apiClient.get<ReconciliationLineItem[]>(
      `/projects/${projectId}/vendors/${vendorId}/line-items`,
      { params: filters },
    ).then((r) => r.data);
  },
  getVendorPurchaseOrders(projectId: string, vendorId: string) {
    return apiClient.get<VendorPurchaseOrder[]>(
      `/projects/${projectId}/vendors/${vendorId}/purchase-orders`,
    ).then((r) => r.data);
  },
  getOrphanDocuments() {
    return apiClient.get<OrphanDocuments>('/projects/orphan-documents').then((r) => r.data);
  },
  linkDocuments(projectId: string, documents: Array<{ id: string; type: 'deliveryNote' | 'purchaseOrder' | 'invoice' }>) {
    return apiClient.post<{ linked: number }>(`/projects/${projectId}/link-documents`, { documents }).then((r) => r.data);
  },
  deleteOrphanDocument(documentId: string, documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice') {
    return apiClient.delete(`/projects/orphan-documents/${documentId}?type=${documentType}`).then((r) => r.data);
  },
  getMergeAddresses(sourceId: string) {
    return apiClient.get<string[]>(`/projects/${sourceId}/merge-addresses`).then((r) => r.data);
  },
  merge(targetId: string, sourceProjectId: string, addressesToInclude?: string[]) {
    return apiClient.post<Project>(`/projects/${targetId}/merge`, { sourceProjectId, addressesToInclude }).then((r) => r.data);
  },
  createFromDocument(dto: { documentId: string; documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice'; name?: string }) {
    return apiClient.post<Project>('/projects/create-from-document', dto).then((r) => r.data);
  },
  getQuotes(projectId: string) {
    return apiClient.get<ProjectQuote[]>(`/projects/${projectId}/quotes`).then((r) => r.data);
  },
  editLineItem(lineItemId: string, payload: EditLineItemPayload) {
    return apiClient.patch(`/projects/line-items/${lineItemId}`, payload).then((r) => r.data);
  },
  deleteLineItem(lineItemId: string, documentType: 'dn' | 'invoice') {
    return apiClient.delete(`/projects/line-items/${lineItemId}?type=${documentType}`).then((r) => r.data);
  },
  removeDocument(documentId: string, documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice') {
    return apiClient.delete(`/projects/documents/${documentId}?type=${documentType}`).then((r) => r.data);
  },
  updateDocument(
    documentId: string,
    documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
    data: {
      supplierName?: string;
      docNumber?: string;
      date?: string;
      totalAmount?: number;
      lineItems?: { description: string; catalogNumber: string; unit: string; quantity: string; unitPrice: string; discountPercent: string }[];
    },
  ) {
    return apiClient.patch(`/projects/documents/${documentId}?type=${documentType}`, data).then((r) => r.data);
  },
  resolveException(lineItemId: string, type: string, note?: string) {
    return apiClient.post(`/projects/line-items/${lineItemId}/exception`, { type, note }).then((r) => r.data);
  },
  getLineItemAuditTrail(lineItemId: string) {
    return apiClient.get<LineItemAuditEntry[]>(`/projects/line-items/${lineItemId}/audit-trail`).then((r) => r.data);
  },
  checkReconciliation(projectId: string) {
    return apiClient.get<{ needsReconciliation: boolean }>(`/projects/${projectId}/check-reconciliation`).then((r) => r.data);
  },
};
