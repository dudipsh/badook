export interface DeliveryNote {
  id: string;
  noteNumber: string | null;
  supplierName: string;
  supplierId: string | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  companyId: string;
  deliveryDate: string | null;
  totalAmount: number | null;
  currency: string;
  vatAmount: number | null;
  status: DeliveryNoteStatus;
  source: DeliveryNoteSource;
  originalFileUrl: string;
  originalFileName: string | null;
  parsedData: ParsedDeliveryNote | null;
  parsingConfidence: number | null;
  notes: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: LineItem[];
}

export interface QuantityComponent {
  label: string;
  value: number;
  unit: string;
}

export interface LineItem {
  id: string;
  deliveryNoteId: string;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  quantityBreakdown?: QuantityComponent[] | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  delivered: boolean;
  receivedQuantity: number | null;
  handwrittenNotes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryNoteStatus =
  | 'PENDING'
  | 'PARSED'
  | 'PARSE_FAILED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED';

export type DeliveryNoteSource = 'EMAIL' | 'MOBILE' | 'MANUAL';

export interface ParsedDeliveryNote {
  noteNumber: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierBusinessId: string | null;
  customerName: string | null;
  deliveryDate: string | null;
  deliveryAddress: string | null;
  projectName: string | null;
  lineItems: ParsedLineItem[];
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string | null;
  confidence: number;
}

export interface ParsedLineItem {
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  quantityBreakdown?: QuantityComponent[] | null;
  unitPrice: number | null;
  totalPrice: number | null;
}
