export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierId: string | null;
  companyId: string;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string;
  status: string;
  source: string;
  originalFileUrl: string | null;
  originalFileUrlHq: string | null;
  parsedData: any;
  projectId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: InvoiceLineItem[];
}
