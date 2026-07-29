export type DocumentType = 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';

export type SampleStatus = 'PENDING' | 'AUTO_EXTRACTED' | 'LABELED' | 'VERIFIED';

export interface LineItem {
  description: string;
  catalogNumber: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  remarks: string;
}

export interface BaseExtraction {
  supplierName: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierBusinessId: string;
  customerName: string;
  lineItems: LineItem[];
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string;
  confidence: number | null;
}

export interface DeliveryNoteExtraction extends BaseExtraction {
  noteNumber: string;
  deliveryDate: string;
  deliveryAddress: string;
  projectName: string;
  poReference: string;
}

export interface InvoiceExtraction extends BaseExtraction {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poReference: string;
  deliveryNoteReferences: string[];
}

export interface PurchaseOrderExtraction extends BaseExtraction {
  poNumber: string;
  orderDate: string;
  expectedDelivery: string;
  deliveryAddress: string;
  projectName: string;
}

export type Extraction = DeliveryNoteExtraction | InvoiceExtraction | PurchaseOrderExtraction;

export interface Sample {
  id: string;
  documentType: DocumentType;
  status: SampleStatus;
  originalFileName: string;
  filePath: string;
  pageCount: number;
  geminiExtraction: Extraction | null;
  geminiConfidence: number | null;
  geminiTokens: number | null;
  geminiCostUsd: number | null;
  finetunedExtraction: Extraction | null;
  finetunedConfidence: number | null;
  groundTruth: Extraction | null;
  labeledAt: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSamples {
  samples: Sample[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Stats {
  total: number;
  byStatus: Record<SampleStatus, number>;
  byType: Record<DocumentType, number>;
}

export interface SampleFilters {
  page: number;
  limit: number;
  status?: SampleStatus;
  documentType?: DocumentType;
  search?: string;
}

export interface AiModel {
  id: string;
  name: string;
  provider: 'google' | 'vertex-ai';
  available: boolean;
  description?: string;
}
