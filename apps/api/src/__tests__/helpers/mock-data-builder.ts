/**
 * Builds DB-like objects from ParsedData JSON for use with buildLineItem().
 * Used by both inline unit tests and fixture-driven tests.
 */

import type {
  ParsedPurchaseOrder,
  ParsedDeliveryNote,
  ParsedInvoice,
} from '../../intelligence/ocr/ocr.types';

let idCounter = 0;
const nextId = () => `test-${++idCounter}`;

export const resetIds = () => {
  idCounter = 0;
};

/** Build a PO record with line items (mimics Prisma PurchaseOrder + POLineItem[]) */
export const buildPO = (
  parsed: ParsedPurchaseOrder,
  overrides: Record<string, any> = {},
) => {
  const poId = nextId();
  return {
    id: poId,
    poNumber: parsed.poNumber || `PO-${poId}`,
    supplierName: parsed.supplierName,
    totalAmount: parsed.totalAmount,
    currency: 'ILS',
    quoteReference: parsed.quoteReference || null,
    originalFileUrl: null,
    lineItems: parsed.lineItems.map((li, i) => ({
      id: nextId(),
      purchaseOrderId: poId,
      description: li.description,
      catalogNumber: li.catalogNumber,
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      sortOrder: i,
      discountPercent: li.discountPercent,
      discountAmount: li.discountAmount,
      priceBeforeDiscount: li.priceBeforeDiscount,
    })),
    ...overrides,
  };
};

/** Build a DN record with line items (mimics Prisma DeliveryNote + LineItem[]) */
export const buildDN = (
  parsed: ParsedDeliveryNote,
  overrides: Record<string, any> = {},
) => {
  const dnId = nextId();
  return {
    id: dnId,
    noteNumber: parsed.noteNumber || `DN-${dnId}`,
    supplierName: parsed.supplierName,
    deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : null,
    totalAmount: parsed.totalAmount,
    originalFileUrl: null,
    originalFileName: null,
    lineItems: parsed.lineItems.map((li, i) => ({
      id: nextId(),
      deliveryNoteId: dnId,
      description: li.description,
      catalogNumber: li.catalogNumber,
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      sortOrder: i,
      delivered: true,
    })),
    ...overrides,
  };
};

/** Build an Invoice record with line items (mimics Prisma Invoice + InvoiceLineItem[]) */
export const buildInvoice = (
  parsed: ParsedInvoice,
  overrides: Record<string, any> = {},
) => {
  const invId = nextId();
  return {
    id: invId,
    invoiceNumber: parsed.invoiceNumber || `INV-${invId}`,
    supplierName: parsed.supplierName,
    invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
    totalAmount: parsed.totalAmount,
    originalFileUrl: null,
    lineItems: parsed.lineItems.map((li, i) => ({
      id: nextId(),
      invoiceId: invId,
      description: li.description,
      catalogNumber: li.catalogNumber,
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      sortOrder: i,
    })),
    ...overrides,
  };
};

/**
 * Build a ThreeWayMatch-like object with lineItemPairings.
 * pairings maps PO line items to DN/Invoice line items by index.
 */
export const buildMatch = (
  po: ReturnType<typeof buildPO>,
  dns: ReturnType<typeof buildDN>[],
  invoices: ReturnType<typeof buildInvoice>[],
  pairings: Array<{
    poIndex: number;
    dnIndex?: number;
    invIndex?: number;
    dnDescription?: string;
    invDescription?: string;
    invQuantity?: number;
  }>,
) => {
  const match = {
    id: nextId(),
    purchaseOrderId: po.id,
    deliveryNotes: dns,
    invoices,
    status: 'PARTIAL' as string,
    discrepancies: [] as any[],
    lineItemPairings: pairings.map((p) => {
      const poLine = po.lineItems[p.poIndex];
      const dnLine =
        p.dnIndex != null && dns[0]
          ? dns[0].lineItems[p.dnIndex]
          : undefined;
      const invLine =
        p.invIndex != null && invoices[0]
          ? invoices[0].lineItems[p.invIndex]
          : undefined;

      return {
        po: {
          index: poLine?.sortOrder ?? p.poIndex,
          description: poLine?.description || '',
          quantity: poLine?.quantity ?? 0,
        },
        dn: dnLine
          ? {
              index: dnLine.sortOrder,
              description: p.dnDescription || dnLine.description,
              quantity: dnLine.quantity,
            }
          : undefined,
        inv: invLine
          ? {
              index: invLine.sortOrder,
              description: p.invDescription || invLine.description,
              quantity: p.invQuantity ?? invLine.quantity,
            }
          : undefined,
      };
    }),
  };

  return match;
};
