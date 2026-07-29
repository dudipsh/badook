export type DocumentType = 'delivery_note' | 'invoice' | 'purchase_order';

export type FieldConfidence = Record<string, number>;

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
    remarks: string | null;
    quantityBreakdown?: Array<{ label: string; value: number; unit: string }> | null;
  }>;
  rejectedItems?: Array<{ index: number; reason: string }>;
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
    remarks: string | null;
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
