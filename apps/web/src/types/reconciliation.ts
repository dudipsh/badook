export type DocType = 'PO' | 'DC' | 'INVOICE';

export interface ProjectVendor {
  id: string;
  name: string;
  initials: string;
  purchaseOrderCount: number;
  deliveryNoteCount: number;
  invoiceCount: number;
  discrepancyCount: number;
}

export interface ProjectStats {
  reconciliationPercentage: number;
  reconciliationLabel: string;
  purchaseOrderCount: number;
  purchaseOrderAmount: number;
  invoiceCount: number;
  invoiceAmount: number;
  deliveryCertCount: number;
  currency: string;
}

export interface DeliveryHistoryEntry {
  deliveryNoteId: string;
  noteNumber: string;
  date: string;
  quantity: number;
  fileUrl: string | null;
}

export interface RelatedDocument {
  type: 'PO' | 'DC' | 'INV';
  name: string;
  documentNumber?: string | null;
  fileUrl: string | null;
}

export interface ReconciliationLineItem {
  id: string;
  poNumber: string;
  poId: string;
  description: string;
  orderedQty: number;
  unitPrice: number;
  receivedQty: number;
  totalQty: number;
  shipmentCount: number;
  remaining: number;
  deliveryStatus: 'full' | 'partial' | 'over' | 'none';
  invoicedStatus: 'matched' | 'mismatch' | 'pending';
  invoicedAmount: number | null;
  invoicedUnitPrice?: number | null;
  invoicedTotal?: number | null;
  mismatchReason: string | null;
  matchId: string | null;
  quoteReference: string | null;
  deliveryHistory: DeliveryHistoryEntry[];
  relatedDocuments: RelatedDocument[];
  currency: string;
  unit: string | null;
  receivedUnit?: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  lineTotal: number;
  hasOverride?: boolean;
  isService?: boolean;
  // DN/Invoice-centric view fields
  groupBy?: 'orders' | 'deliveryNotes' | 'invoices';
  priceSource?: string | null;
  priceConfirmed?: boolean;
  dnId?: string;
  dnNoteNumber?: string | null;
  dnDeliveryDate?: string | null;
  invoiceId?: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  catalogNumber?: string | null;
  quantity?: number;
  totalReceivedForLine?: number | null;   // DN view: sum across all DNs for same PO line
  totalPrice?: number | null;
  quantityBreakdown?: Array<{ label: string; value: number; unit: string }> | null;
  // Display-only: aggregation across consecutive same-description rows in a DN group
  _shortageAnchor?: boolean;
  _hideShortageBadge?: boolean;
  _aggregateOrdered?: number;
  _aggregateReceived?: number;
  _aggregateShortage?: number;
}

export type GroupByValue = 'orders' | 'deliveryNotes' | 'invoices' | 'all';

export interface VendorPurchaseOrder {
  id: string;
  poNumber: string;
  totalAmount: number;
}

export interface ProjectQuote {
  id: string;
  poNumber: string;
  supplierName: string;
  quoteReference: string | null;
  orderDate: string | null;
  totalAmount: number;
  currency: string;
  originalFileUrl: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export type LineItemEditReason =
  | 'DATA_EXTRACTION_ERROR'
  | 'PRICE_CORRECTION'
  | 'QUANTITY_ADJUSTMENT'
  | 'UNIT_TYPE_CORRECTION'
  | 'CREDIT_NOTE_APPLIED'
  | 'OVERRIDE_SUBSTITUTE'
  | 'OVERRIDE_PRICE_APPROVED'
  | 'OVERRIDE_UNIT_CORRECTION'
  | 'FLAG_DUPLICATE'
  | 'OTHER';

export interface LineItemAuditEntry {
  id: string;
  fieldName: 'invoicedQty' | 'unitPrice' | 'unit';
  oldValue: string | null;
  newValue: string;
  reason: LineItemEditReason;
  note: string | null;
  editedBy: { name: string; email: string };
  createdAt: string;
}

export interface EditLineItemPayload {
  invoicedQty?: number;
  quantity?: number;
  unitPrice?: number;
  unit?: string;
  editSource?: 'po' | 'dn' | 'invoice';
  reason: LineItemEditReason;
  note?: string;
}

export interface DiscrepancyDetail {
  lineItemId: string;
  lineItemDescription: string;
  invoicedQty: number;
  invoicedUnitPrice: number;
  invoiceDocName: string;
  invoiceFileUrl: string | null;
  receivedQty: number;
  receivedUnitPrice: number;
  dcDocName: string;
  dcFileUrl: string | null;
}
