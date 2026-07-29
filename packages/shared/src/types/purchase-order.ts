export interface POLineItem {
  id: string;
  purchaseOrderId: string;
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

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierId: string | null;
  companyId: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  notes: string | null;
  quoteReference: string | null;
  isQuote: boolean;
  source: string;
  originalFileUrl: string | null;
  originalFileUrlHq: string | null;
  parsedData: any;
  projectId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: POLineItem[];
}
