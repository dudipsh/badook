import { describe, it, expect, beforeEach } from 'vitest';
import { buildLineItem } from '../domain/projects/build-line-item';
import {
  buildPO,
  buildDN,
  buildInvoice,
  buildMatch,
  resetIds,
} from './helpers/mock-data-builder';
import type {
  ParsedPurchaseOrder,
  ParsedDeliveryNote,
  ParsedInvoice,
} from '../intelligence/ocr/ocr.types';

// ─── Shared mock data factories ────────────────────

const makeParsedPO = (
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    unit?: string;
    discountPercent?: number;
  }>,
): ParsedPurchaseOrder => ({
  poNumber: 'PO-001',
  supplierName: 'ספק לדוגמה',
  supplierAddress: null,
  supplierPhone: null,
  supplierBusinessId: null,
  customerName: null,
  deliveryAddress: null,
  projectName: null,
  orderDate: null,
  expectedDelivery: null,
  supplierOrderNumber: null,
  quoteReference: null,
  deliveryNoteReferences: null,
  documentSubtype: null,
  lineItems: items.map((i) => ({
    description: i.description,
    catalogNumber: null,
    quantity: i.quantity,
    unit: i.unit || 'יח׳',
    unitPrice: i.unitPrice,
    totalPrice: i.totalPrice ?? i.quantity * i.unitPrice,
    discountPercent: i.discountPercent ?? null,
    discountAmount: null,
    priceBeforeDiscount: null,
    remarks: null,
    expectedDeliveryDate: null,
  })),
  subtotal: null,
  vatRate: null,
  vatAmount: null,
  totalAmount: null,
  notes: null,
  confidence: 0.95,
});

const makeParsedDN = (
  items: Array<{
    description: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    unit?: string;
  }>,
): ParsedDeliveryNote => ({
  noteNumber: 'DN-001',
  supplierName: 'ספק לדוגמה',
  supplierAddress: null,
  supplierPhone: null,
  supplierBusinessId: null,
  customerName: null,
  deliveryDate: '2024-01-15',
  deliveryAddress: null,
  projectName: null,
  poReference: 'PO-001',
  orderReference: null,
  lineItems: items.map((i) => ({
    description: i.description,
    catalogNumber: null,
    quantity: i.quantity,
    unit: i.unit || 'יח׳',
    unitPrice: i.unitPrice ?? null,
    totalPrice: i.totalPrice ?? null,
    discountPercent: null,
    discountAmount: null,
    priceBeforeDiscount: null,
    receivedQuantity: null,
    handwrittenNotes: null,
    remarks: null,
  })),
  subtotal: null,
  vatRate: null,
  vatAmount: null,
  totalAmount: null,
  notes: null,
  confidence: 0.9,
});

const makeParsedInvoice = (
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
  }>,
): ParsedInvoice => ({
  invoiceNumber: 'INV-001',
  supplierName: 'ספק לדוגמה',
  supplierAddress: null,
  supplierPhone: null,
  supplierBusinessId: null,
  customerName: null,
  invoiceDate: '2024-02-01',
  dueDate: null,
  poReference: 'PO-001',
  quoteReference: null,
  deliveryNoteReferences: ['DN-001'],
  lineItems: items.map((i) => ({
    description: i.description,
    catalogNumber: null,
    quantity: i.quantity,
    unit: 'יח׳',
    unitPrice: i.unitPrice,
    totalPrice: i.totalPrice ?? i.quantity * i.unitPrice,
    discountPercent: null,
    discountAmount: null,
    priceBeforeDiscount: null,
    remarks: null,
  })),
  subtotal: null,
  vatRate: null,
  vatAmount: null,
  totalAmount: null,
  notes: null,
  confidence: 0.9,
});

// ─── Tests ─────────────────────────────────────────

describe('buildLineItem', () => {
  beforeEach(() => resetIds());

  describe('quantity identification', () => {
    it('returns correct orderedQty from PO', () => {
      const parsedPO = makeParsedPO([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
        { description: 'בטון B30', quantity: 50, unitPrice: 120 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [
        { poIndex: 0 },
        { poIndex: 1 },
      ]);

      const result0 = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      const result1 = buildLineItem(po, po.lineItems[1], match, match.lineItemPairings);

      expect(result0.orderedQty).toBe(100);
      expect(result1.orderedQty).toBe(50);
    });

    it('returns correct receivedQty from DN', () => {
      const parsedPO = makeParsedPO([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ברזל 10 מ"מ', quantity: 80 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.receivedQty).toBe(80);
      expect(result.remaining).toBe(20);
    });

    it('handles zero received qty', () => {
      const parsedPO = makeParsedPO([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.receivedQty).toBe(0);
      expect(result.remaining).toBe(100);
    });
  });

  describe('delivery status', () => {
    it('returns "full" when received equals ordered', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור PVC 4"', quantity: 20, unitPrice: 50 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור PVC 4"', quantity: 20 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [{ poIndex: 0, dnIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.deliveryStatus).toBe('full');
    });

    it('returns "partial" when received is less than ordered', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור PVC 4"', quantity: 20, unitPrice: 50 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור PVC 4"', quantity: 15 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [{ poIndex: 0, dnIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.deliveryStatus).toBe('partial');
      expect(result.remaining).toBe(5);
    });

    it('returns "over" when received exceeds ordered', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור PVC 4"', quantity: 20, unitPrice: 50 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור PVC 4"', quantity: 25 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [{ poIndex: 0, dnIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.deliveryStatus).toBe('over');
    });

    it('returns "none" when no delivery notes exist', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור PVC 4"', quantity: 20, unitPrice: 50 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.deliveryStatus).toBe('none');
    });
  });

  describe('duplicate items', () => {
    it('aggregates quantities from multiple DN items with same description', () => {
      const parsedPO = makeParsedPO([
        { description: 'אריחים 60x60', quantity: 200, unitPrice: 35 },
      ]);
      // DN has the same item appearing twice (e.g., two shipments in one DN)
      const parsedDN = makeParsedDN([
        { description: 'אריחים 60x60', quantity: 120 },
        { description: 'אריחים 60x60', quantity: 80 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // Both DN items with same description should be aggregated
      expect(result.receivedQty).toBe(200);
      expect(result.deliveryStatus).toBe('full');
    });

    it('aggregates quantities from multiple delivery notes', () => {
      const parsedPO = makeParsedPO([
        { description: 'בלוקים 20', quantity: 500, unitPrice: 8 },
      ]);
      const parsedDN1 = makeParsedDN([
        { description: 'בלוקים 20', quantity: 300 },
      ]);
      const parsedDN2 = makeParsedDN([
        { description: 'בלוקים 20', quantity: 200 },
      ]);
      const po = buildPO(parsedPO);
      const dn1 = buildDN(parsedDN1);
      const dn2 = buildDN(parsedDN2);
      const match = buildMatch(po, [dn1, dn2], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.receivedQty).toBe(500);
      expect(result.deliveryStatus).toBe('full');
    });
  });

  describe('duplicate PO items — per-line quantity isolation', () => {
    it('each PO line gets only its paired DN quantity (same description, different qty)', () => {
      const parsedPO = makeParsedPO([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5, unitPrice: 900 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8, unitPrice: 900 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
        { poIndex: 1, dnIndex: 1 },
      ]);

      const result0 = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      const result1 = buildLineItem(po, po.lineItems[1], match, match.lineItemPairings);

      expect(result0.receivedQty).toBe(5);
      expect(result0.deliveryStatus).toBe('full');
      expect(result0.remaining).toBe(0);

      expect(result1.receivedQty).toBe(8);
      expect(result1.deliveryStatus).toBe('full');
      expect(result1.remaining).toBe(0);
    });

    it('follows pairing index even when DN order differs from PO order', () => {
      const parsedPO = makeParsedPO([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5, unitPrice: 900 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8, unitPrice: 900 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      // Pairings cross-reference: PO[0] (qty=5) → DN[1] (qty=5), PO[1] (qty=8) → DN[0] (qty=8)
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 1 },
        { poIndex: 1, dnIndex: 0 },
      ]);

      const result0 = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      const result1 = buildLineItem(po, po.lineItems[1], match, match.lineItemPairings);

      expect(result0.receivedQty).toBe(5);
      expect(result0.remaining).toBe(0);

      expect(result1.receivedQty).toBe(8);
      expect(result1.remaining).toBe(0);
    });

    it('does not show surplus/shortage for correctly paired duplicates', () => {
      const parsedPO = makeParsedPO([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5, unitPrice: 900 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8, unitPrice: 900 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ספסל קלאסי צר ללא תא', quantity: 5 },
        { description: 'ספסל קלאסי צר ללא תא', quantity: 8 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
        { poIndex: 1, dnIndex: 1 },
      ]);

      const result0 = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      const result1 = buildLineItem(po, po.lineItems[1], match, match.lineItemPairings);

      // Neither line should show surplus or shortage
      expect(result0.deliveryStatus).not.toBe('over');
      expect(result0.deliveryStatus).not.toBe('partial');
      expect(result1.deliveryStatus).not.toBe('over');
      expect(result1.deliveryStatus).not.toBe('partial');
    });
  });

  describe('service item detection', () => {
    it('detects service items by Hebrew keywords', () => {
      const serviceDescriptions = [
        'התקנה של מערכת חשמל',
        'עבודה כללית',
        'שירות תחזוקה',
        'הובלה למחסן',
        'משלוח חומרים',
        'פירוק קיר ישן',
        'הרכבה של דלתות',
        'מנוף להרמה',
      ];

      for (const desc of serviceDescriptions) {
        resetIds();
        const parsedPO = makeParsedPO([
          { description: desc, quantity: 1, unitPrice: 1000 },
        ]);
        const po = buildPO(parsedPO);
        const match = buildMatch(po, [buildDN({ ...makeParsedDN([]), lineItems: [] } as any)], [], [
          { poIndex: 0 },
        ]);
        // Give it a DN in the match but no pairing to DN line
        match.deliveryNotes = [buildDN(makeParsedDN([]))];

        const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
        expect(result.isService).toBe(true);
        expect(result.deliveryStatus).toBe('none');
      }
    });

    it('does not mark non-service items as service', () => {
      const parsedPO = makeParsedPO([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.isService).toBe(false);
    });

    it('does not mark as service if received qty > 0', () => {
      const parsedPO = makeParsedPO([
        { description: 'התקנה של דלתות', quantity: 5, unitPrice: 500 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'התקנה של דלתות', quantity: 5 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.isService).toBe(false);
    });
  });

  describe('invoice matching', () => {
    it('returns "matched" when invoiced qty equals received qty', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור 2"', quantity: 30, unitPrice: 40 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור 2"', quantity: 30 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'צינור 2"', quantity: 30, unitPrice: 40 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 30 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.invoicedStatus).toBe('matched');
      expect(result.invoicedAmount).toBe(30);
    });

    it('returns "mismatch" when invoiced qty differs from received', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור 2"', quantity: 30, unitPrice: 40 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור 2"', quantity: 25 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'צינור 2"', quantity: 30, unitPrice: 40 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 30 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.invoicedStatus).toBe('mismatch');
      expect(result.mismatchReason).toBeTruthy();
      expect(result.mismatchReason).toContain('חויב');
    });

    it('returns "pending" when no invoice exists', () => {
      const parsedPO = makeParsedPO([
        { description: 'צינור 2"', quantity: 30, unitPrice: 40 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'צינור 2"', quantity: 30 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.invoicedStatus).toBe('pending');
    });

    it('returns "service" for service items', () => {
      const parsedPO = makeParsedPO([
        { description: 'הובלה', quantity: 1, unitPrice: 2000 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(makeParsedDN([]));
      const match = buildMatch(po, [dn], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.invoicedStatus).toBe('service');
    });
  });

  describe('discount calculations', () => {
    it('applies discount percent to unit price', () => {
      const parsedPO = makeParsedPO([
        { description: 'חומר X', quantity: 10, unitPrice: 100, discountPercent: 20 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.unitPrice).toBe(80); // 100 * (1 - 0.20)
      expect(result.discountPercent).toBe(20);
    });

    it('does not apply discount when percent is 0', () => {
      const parsedPO = makeParsedPO([
        { description: 'חומר Y', quantity: 10, unitPrice: 100 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.unitPrice).toBe(100);
      expect(result.discountPercent).toBeNull();
    });
  });

  describe('OCR quantity cross-check', () => {
    it('trusts AI-extracted quantity even when inconsistent with totalPrice', () => {
      // AI extracted qty=10 but totalPrice=2500, unitPrice=50
      // We trust the AI extraction — never recalculate qty from price fields
      const parsedPO = makeParsedPO([
        { description: 'חומר Z', quantity: 10, unitPrice: 50, totalPrice: 2500 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      // buildLineItem trusts AI extraction — qty stays as extracted
      expect(result.orderedQty).toBe(10);
    });

    it('keeps quantity when consistent with totalPrice', () => {
      const parsedPO = makeParsedPO([
        { description: 'חומר W', quantity: 10, unitPrice: 50, totalPrice: 500 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.orderedQty).toBe(10);
    });
  });

  describe('mismatch reason generation', () => {
    it('generates Hebrew mismatch reason with surplus', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט א', quantity: 20, unitPrice: 10 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'פריט א', quantity: 15 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'פריט א', quantity: 20, unitPrice: 10 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 20 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.mismatchReason).toContain('עודף');
    });

    it('generates Hebrew mismatch reason with shortage', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט ב', quantity: 20, unitPrice: 10 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'פריט ב', quantity: 20 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'פריט ב', quantity: 15, unitPrice: 10 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 15 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.mismatchReason).toContain('חוסר');
    });
  });

  describe('override handling', () => {
    it('uses override invoicedQty when provided', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט', quantity: 10, unitPrice: 100 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'פריט', quantity: 10 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(
        po,
        po.lineItems[0],
        match,
        match.lineItemPairings,
        { invoicedQty: 8 },
      );

      expect(result.invoicedAmount).toBe(8);
      expect(result.hasOverride).toBe(true);
    });

    it('uses override unitPrice when provided', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט', quantity: 10, unitPrice: 100 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(
        po,
        po.lineItems[0],
        match,
        match.lineItemPairings,
        { unitPrice: 90 },
      );

      expect(result.unitPrice).toBe(90);
      expect(result.hasOverride).toBe(true);
    });
  });

  describe('related documents', () => {
    it('includes PO, DN, and Invoice in related documents', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט', quantity: 10, unitPrice: 100 },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'פריט', quantity: 10 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'פריט', quantity: 10, unitPrice: 100 },
      ]);
      const po = buildPO(parsedPO, { originalFileUrl: 'po.pdf' });
      const dn = buildDN(parsedDN, { originalFileUrl: 'dn.pdf' });
      const inv = buildInvoice(parsedInv, { originalFileUrl: 'inv.pdf' });
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 10 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.relatedDocuments.length).toBe(3);
      expect(result.relatedDocuments.map((d: any) => d.type)).toEqual(['PO', 'DC', 'INV']);
    });
  });

  describe('unit conversion via invoice', () => {
    it('converts DN qty using invoice totalPrice/unitPrice when units differ', () => {
      // PO: 3360 מ"א at 3.96
      const parsedPO = makeParsedPO([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 3360, unitPrice: 3.96, unit: 'מ"א' },
      ]);
      // DN: 920 יח' (pieces)
      const parsedDN = makeParsedDN([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 920, unit: "יח'" },
      ]);
      // Invoice: qty=920 but totalPrice=12751.20, unitPrice=3.96
      // So real qty in מ"א = 12751.20 / 3.96 = 3220
      const parsedInv = makeParsedInvoice([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 920, unitPrice: 3.96, totalPrice: 12751.20 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 920 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // Should use invoice-derived qty (3220) not raw DN qty (920)
      expect(result.receivedQty).toBeCloseTo(3220, 0);
      expect(result.deliveryStatus).toBe('partial');
      expect(result.remaining).toBeCloseTo(140, 0);
    });

    it('uses raw DN qty when units match (no conversion needed)', () => {
      const parsedPO = makeParsedPO([
        { description: 'ניצב 50', quantity: 920, unitPrice: 3.96, unit: "יח'" },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ניצב 50', quantity: 920, unit: "יח'" },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.receivedQty).toBe(920);
      expect(result.deliveryStatus).toBe('full');
    });

    it('uses quantityBreakdown over invoice when available', () => {
      const parsedPO = makeParsedPO([
        { description: 'ניצב 50', quantity: 3360, unitPrice: 3.96, unit: 'מ"א' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'ניצב 50', quantity: 920, unit: "יח'" },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      // Add quantityBreakdown to the DN line item
      (dn.lineItems[0] as any).quantityBreakdown = [
        { value: 3200, unit: 'מ"א' },
      ];
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // Should use breakdown value (3200), not invoice
      expect(result.receivedQty).toBe(3200);
    });

    it('does NOT invoice-correct a same-unit DN qty (trusts it as a partial delivery)', () => {
      // Same-unit invoice-derived correction is intentionally DISABLED in
      // qty-converter.ts: when DN and PO share a unit, a smaller DN qty is
      // almost always a partial delivery, so overriding it with the
      // invoice-derived total would corrupt the real received count.
      // PO: 3360 מ"א
      const parsedPO = makeParsedPO([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 3360, unitPrice: 3.96, unit: 'מ"א' },
      ]);
      // DN: 920 מ"א (same unit as PO)
      const parsedDN = makeParsedDN([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 920, unit: 'מ"א' },
      ]);
      // Invoice would derive 3220 (12751.20 / 3.96) — must NOT override the DN.
      const parsedInv = makeParsedInvoice([
        { description: 'ניצב 50 עובי 0.6 מ"מ', quantity: 920, unitPrice: 3.96, totalPrice: 12751.20 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 920 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // Received stays the DN value (920); 920 < 3360 → partial delivery.
      expect(result.receivedQty).toBeCloseTo(920, 0);
      expect(result.deliveryStatus).toBe('partial');
    });

    it('converts piece count using per-piece length from PO description', () => {
      // PO: 3360 מ"א, description includes "אורך 3.5"
      const parsedPO = makeParsedPO([
        {
          description: 'ניצב 50 עובי 0.6 מ"מ ( יש לציין אורך)\n2 חבילות של 480 יחידות אורך 3.5',
          quantity: 3360, unitPrice: 3.95, unit: 'מ"א',
        },
      ]);
      // DN: 920 מ"א (really 920 pieces × 3.5m = 3220 מ"א)
      const parsedDN = makeParsedDN([
        { description: '*3505006* ניצב 50/3.50 עובי 0.6', quantity: 920, unit: 'מ"א' },
      ]);
      // Invoice: totalPrice/unitPrice = 920 (same as DN, doesn't help)
      const parsedInv = makeParsedInvoice([
        { description: 'ניצב 50/3.50 עובי 0.6', quantity: 920, unitPrice: 3.96, totalPrice: 3643.2 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 920 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // Should detect 920 < 50% of 3360 PO qty, extract "אורך 3.5",
      // and convert: 920 × 3.5 = 3220
      expect(result.receivedQty).toBeCloseTo(3220, 0);
      expect(result.deliveryStatus).toBe('partial');
    });

    it('does not override when units match and quantities are close', () => {
      // PO: 100 יח', DN: 95 יח', Invoice: 100 (totalPrice matches)
      const parsedPO = makeParsedPO([
        { description: 'פריט', quantity: 100, unitPrice: 10, unit: "יח'" },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'פריט', quantity: 95, unit: "יח'" },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'פריט', quantity: 100, unitPrice: 10, totalPrice: 1000 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 100 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // 5% diff is under 50% threshold, keep DN qty
      expect(result.receivedQty).toBe(95);
    });
  });

  describe('PO qty/price values are preserved (swap detection removed)', () => {
    it('preserves PO values as-is even when invoice differs', () => {
      const parsedPO = makeParsedPO([
        { description: 'NIGHT R11 30/60 קלקסטן שחור', quantity: 110.88, unitPrice: 132, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'קלקסטן שחור NIGHT R11 30/60', quantity: 110.88, unit: 'מ"ר' },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'NIGHT R11 קלקסטן שחור 30/60', quantity: 132, unitPrice: 110.88, totalPrice: 14636.16 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 132 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // PO values preserved exactly as extracted
      expect(result.orderedQty).toBe(110.88);
      expect(result.unitPrice).toBe(132);
    });

    it('preserves PO values when ratio >= 2 (unit conversion)', () => {
      const parsedPO = makeParsedPO([
        { description: 'ALBAR גאלווי 30/90', quantity: 22.95, unitPrice: 102, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'גאלווי מולבן 30/60 ALBAR', quantity: 22.95, unit: 'מ"ר' },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'ALBAR גאלווי מולבן 30/90', quantity: 102, unitPrice: 22.95, totalPrice: 2340.90 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 102 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.orderedQty).toBe(22.95);
      expect(result.unitPrice).toBe(102);
    });

    it('preserves correct PO values and handles invoice normally', () => {
      const parsedPO = makeParsedPO([
        { description: 'DARK בלייז שחור 100/300/3.5', quantity: 72, unitPrice: 239, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'בלייז שחור מט DARK 100/300/3.5', quantity: 72, unit: 'מ"ר' },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'DARK בלייז שחור מט 100/300/3.5', quantity: 239, unitPrice: 72, totalPrice: 17208 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 239 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      expect(result.orderedQty).toBe(72);
      expect(result.unitPrice).toBe(239);
    });
  });

  describe('pairing DN validation', () => {
    it('honors an explicit pairing from the matching pipeline (no overlap re-check here)', () => {
      // buildLineItem intentionally does NOT re-validate keyword overlap:
      // isPairingPartValid trusts the matching pipeline, which already runs the
      // overlap checks. A second layer here previously rejected valid matches,
      // so a pairing handed in explicitly is honored as-is.
      // PO: "אריח 60/60 טרנד בטון אפור GREY R10"
      // DN: "בלאק וואיט בריץ מבריק 120/280 BREACH"
      const parsedPO = makeParsedPO([
        { description: 'אריח 60/60 טרנד בטון אפור GREY R10', quantity: 60.48, unitPrice: 145, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'בלאק וואיט בריץ מבריק 120/280 BREACH', quantity: 67.2, unit: 'מ"ר' },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // The explicit pairing is honored: 67.2 received; 67.2 > 60.48 → over.
      expect(result.receivedQty).toBeCloseTo(67.2, 1);
      expect(result.deliveryStatus).toBe('over');
    });

    it('accepts pairing when DN shares keywords with PO', () => {
      const parsedPO = makeParsedPO([
        { description: 'אריח 30/60 קלקס SMOKE R10 30/60', quantity: 36, unitPrice: 132, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'קלקסטן אפור SMOKE R10 30/60', quantity: 36, unit: 'מ"ר' },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const match = buildMatch(po, [dn], [], [
        { poIndex: 0, dnIndex: 0 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // "SMOKE" and "R10" match → valid pairing
      expect(result.receivedQty).toBe(36);
    });
  });

  describe('mismatch tooltip uses PO orderedQty as-is (no swap)', () => {
    it('shows PO orderedQty in mismatchReason without swap correction', () => {
      // PO values used as-is — no swap detection
      const parsedPO = makeParsedPO([
        { description: 'NIGHT R11 30/60', quantity: 110.88, unitPrice: 132, unit: 'sqm' },
      ]);
      const parsedDN = makeParsedDN([
        { description: 'NIGHT R11 30/60', quantity: 110.88, unit: 'sqm' },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'NIGHT R11 30/60', quantity: 132, unitPrice: 110.88, totalPrice: 14636.16 },
      ]);
      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const inv = buildInvoice(parsedInv);
      const match = buildMatch(po, [dn], [inv], [
        { poIndex: 0, dnIndex: 0, invIndex: 0, invQuantity: 132 },
      ]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);

      // PO values preserved as extracted
      expect(result.orderedQty).toBe(110.88);
      expect(result.unitPrice).toBe(132);
    });
  });
});
