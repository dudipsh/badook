import { apiClient } from './api-client';

export type ChatDocType = 'invoice' | 'delivery_note' | 'purchase_order';

export interface DocumentDetailLine {
  id: string;
  description: string;
  catalogNumber: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface DocumentDetail {
  type: ChatDocType;
  id: string;
  number: string | null;
  date: string | null;
  supplierName: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string | null;
  currency: string;
  totalAmount: number | null;
  vatAmount: number | null;
  originalFileUrl: string | null;
  lineItems: DocumentDetailLine[];
}

const ENDPOINT: Record<ChatDocType, string> = {
  delivery_note: '/delivery-notes',
  invoice: '/invoices',
  purchase_order: '/purchase-orders',
};

// Amounts arrive as Prisma Decimals (serialized to strings) — coerce to numbers.
const num = (v: unknown): number | null =>
  v == null || v === '' ? null : Number(v);

const mapLines = (lineItems: any[] | undefined | null): DocumentDetailLine[] =>
  (lineItems ?? []).map((l) => ({
    id: l.id,
    description: l.description,
    catalogNumber: l.catalogNumber ?? null,
    // Delivery notes carry a handwritten received qty that wins over the printed one.
    quantity: num(l.receivedQuantity ?? l.quantity),
    unit: l.unit ?? null,
    unitPrice: num(l.unitPrice),
    totalPrice: num(l.totalPrice),
  }));

/** Fetches a single document (DN / invoice / PO) with its line items for the chat doc modal. */
export const fetchDocumentDetail = async (
  type: ChatDocType,
  id: string,
): Promise<DocumentDetail> => {
  const { data } = await apiClient.get<any>(`${ENDPOINT[type]}/${id}`);
  return {
    type,
    id: data.id,
    number: data.noteNumber ?? data.invoiceNumber ?? data.poNumber ?? null,
    date: data.deliveryDate ?? data.invoiceDate ?? data.orderDate ?? null,
    supplierName: data.supplier?.name ?? data.supplierName ?? null,
    projectId: data.project?.id ?? data.projectId ?? null,
    projectName: data.project?.name ?? null,
    status: data.status ?? null,
    currency: data.currency ?? 'ILS',
    totalAmount: num(data.totalAmount),
    vatAmount: num(data.vatAmount),
    originalFileUrl: data.originalFileUrl ?? null,
    lineItems: mapLines(data.lineItems),
  };
};
