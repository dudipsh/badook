export type DocumentType = 'delivery_note' | 'invoice' | 'purchase_order' | 'order_confirmation' | 'credit_note' | 'unknown';

/** Common line-item fields shared by all parsed document types */
export interface ParsedLineItemBase {
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  remarks: string | null;
}

/** Per-field confidence scores (0-1) reported by the AI model */
export type FieldConfidence = Record<string, number>;

export interface DetectedDocument {
  documentType: DocumentType;
  documentSubtype: 'price_quote' | null;
  confidence: number;
  reason: string;
}

export interface DocumentSegment {
  startPage: number;
  endPage: number;
  documentType: DocumentType;
  documentNumber: string | null;
  filePath: string;
  /** Brief description from multi-doc detection AI, used as context hint for extraction */
  description?: string;
}

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
  poReference: string | null;
  orderReference: string | null;
  lineItems: Array<{
    description: string;
    catalogNumber: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number | null;
    totalPrice: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    priceBeforeDiscount: number | null;
    receivedQuantity: number | null;
    handwrittenNotes: string | null;
    /** Remarks/notes from the הערה column — separate from description */
    remarks: string | null;
    quantityBreakdown?: Array<{ label: string; value: number; unit: string }> | null;
  }>;
  rejectedItems?: Array<{
    index: number;
    reason: string;
  }>;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string | null;
  confidence: number;
  fieldConfidence?: FieldConfidence;
}

export interface ParsedInvoice {
  invoiceNumber: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierBusinessId: string | null;
  customerName: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  poReference: string | null;
  quoteReference: string | null;
  deliveryNoteReferences: string[] | null;
  lineItems: Array<{
    description: string;
    catalogNumber: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number | null;
    totalPrice: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    priceBeforeDiscount: number | null;
    /** Remarks/notes from the הערה column — separate from description */
    remarks: string | null;
  }>;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string | null;
  confidence: number;
  fieldConfidence?: FieldConfidence;
}

export interface ParsedPurchaseOrder {
  poNumber: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierBusinessId: string | null;
  customerName: string | null;
  deliveryAddress: string | null;
  projectName: string | null;
  orderDate: string | null;
  expectedDelivery: string | null;
  supplierOrderNumber: string | null;
  quoteReference: string | null;
  deliveryNoteReferences: string[] | null;
  documentSubtype: 'price_quote' | null;
  lineItems: Array<{
    description: string;
    catalogNumber: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number | null;
    totalPrice: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    priceBeforeDiscount: number | null;
    /** Remarks/notes from the הערה column — separate from description */
    remarks: string | null;
    /** Expected delivery date for this specific line item */
    expectedDeliveryDate: string | null;
  }>;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string | null;
  confidence: number;
  fieldConfidence?: FieldConfidence;
}
