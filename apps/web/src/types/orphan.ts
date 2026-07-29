export type OrphanDocType = 'deliveryNote' | 'purchaseOrder' | 'invoice';
export type OrphanReason = 'MISSING_PO' | 'PARSING_ERROR' | 'MISSING_PROJECT' | 'UNKNOWN_VENDOR';

export interface OrphanLineItem {
  description: string;
  catalogNumber: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
}

export interface OrphanedDoc {
  id: string;
  docType: OrphanDocType;
  docNumber: string | null;
  supplierName: string;
  date: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  originalFileUrl: string | null;
  createdAt: string;
  reason: OrphanReason;
  lineItems: OrphanLineItem[];
  senderEmail?: string;
  senderName?: string;
}
