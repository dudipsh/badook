import { describe, it, expect, beforeEach } from 'vitest';
import { buildLineItem } from '../domain/projects/build-line-item';
import { resolveInvoiced } from '../domain/projects/resolve-invoiced';
import { deriveQtyFromInvoice } from '../domain/projects/qty-converter';
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

// ─── Shared factories ─────────────────────────────

const makeParsedPO = (
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    unit?: string;
    catalogNumber?: string;
  }>,
): ParsedPurchaseOrder => ({
  poNumber: 'PO-25000432',
  supplierName: 'ספק פרקט',
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
    catalogNumber: i.catalogNumber ?? null,
    quantity: i.quantity,
    unit: i.unit || 'מר',
    unitPrice: i.unitPrice,
    totalPrice: i.totalPrice ?? i.quantity * i.unitPrice,
    discountPercent: null,
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
  noteNumber: 'SH25P000884',
  supplierName: 'ספק פרקט',
  supplierAddress: null,
  supplierPhone: null,
  supplierBusinessId: null,
  customerName: null,
  deliveryDate: '2024-01-15',
  deliveryAddress: null,
  projectName: null,
  poReference: 'PO-25000432',
  orderReference: null,
  lineItems: items.map((i) => ({
    description: i.description,
    catalogNumber: null,
    quantity: i.quantity,
    unit: i.unit || 'מיר',
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
  invoiceNumber = 'INV-001',
): ParsedInvoice => ({
  invoiceNumber,
  supplierName: 'ספק פרקט',
  supplierAddress: null,
  supplierPhone: null,
  supplierBusinessId: null,
  customerName: null,
  invoiceDate: '2024-02-01',
  dueDate: null,
  poReference: 'PO-25000432',
  quoteReference: null,
  deliveryNoteReferences: ['SH25P000884'],
  lineItems: items.map((i) => ({
    description: i.description,
    catalogNumber: null,
    quantity: i.quantity,
    unit: 'יחידות',
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

// ─── Helper to build pairings with full inv fields ─

const buildPairingWithInvDetails = (
  po: any,
  dns: any[],
  invoices: any[],
  specs: Array<{
    poIndex: number;
    dnIndex?: number;
    invIndex?: number;
    invoiceArrayIndex?: number;
    matchSource?: string;
  }>,
) => {
  return specs.map((s) => {
    const poLine = po.lineItems[s.poIndex];
    const dnLine = s.dnIndex != null && dns[0] ? dns[0].lineItems[s.dnIndex] : undefined;
    const inv = s.invoiceArrayIndex != null ? invoices[s.invoiceArrayIndex] : invoices[0];
    const invLine = s.invIndex != null && inv ? inv.lineItems[s.invIndex] : undefined;

    return {
      matchSource: s.matchSource || 'ai',
      po: poLine ? {
        id: poLine.id,
        index: poLine.sortOrder,
        description: poLine.description,
        quantity: poLine.quantity,
        unitPrice: poLine.unitPrice,
        totalPrice: poLine.totalPrice,
        catalogNumber: poLine.catalogNumber,
      } : undefined,
      dn: dnLine ? {
        id: dnLine.id,
        index: dnLine.sortOrder,
        description: dnLine.description,
        quantity: dnLine.quantity,
      } : undefined,
      inv: invLine ? {
        id: invLine.id,
        index: invLine.sortOrder,
        invoiceIdx: s.invoiceArrayIndex ?? 0,
        description: invLine.description,
        quantity: invLine.quantity,
        unitPrice: invLine.unitPrice,
        totalPrice: invLine.totalPrice,
      } : undefined,
    };
  });
};

// ─── Tests ────────────────────────────────────────

describe('Settlement invoices (גמר חשבון / מקדמה)', () => {
  beforeEach(() => resetIds());

  describe('resolveInvoiced – settlement detection', () => {
    it('sets invoiced amount = ordered qty for settlement line', () => {
      const parsedPO = makeParsedPO([
        { description: 'אלון שברון Elegant', quantity: 82.5, unitPrice: 691.86 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'גמר חשבון - הזמנת רכש 25000432', quantity: 1, unitPrice: 57380.51 },
      ]);
      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
      ]);

      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      const result = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        167.38, po.lineItems[0], 82.5, 691.86,
      );

      expect(result.amount).toBe(82.5);
      expect(result.total).toBe(57380.51);
      expect(result.unitPrice).toBeCloseTo(695.52, 1);
    });

    it('sets invoiced amount = ordered qty for מקדמה line', () => {
      const parsedPO = makeParsedPO([
        { description: 'אלון שכבתי Elegant', quantity: 41, unitPrice: 516 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'מקדמה', quantity: 1, unitPrice: 23650.34 },
      ]);
      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
      ]);

      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      const result = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        83.952, po.lineItems[0], 41, 516,
      );

      expect(result.amount).toBe(41);
      expect(result.total).toBe(23650.34);
    });

    it('does NOT treat regular invoice lines as settlement', () => {
      const parsedPO = makeParsedPO([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'ברזל 10 מ"מ', quantity: 100, unitPrice: 25 },
      ]);
      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
      ]);

      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      const result = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        100, po.lineItems[0], 100, 25,
      );

      // Regular line: amount = actual qty from invoice
      expect(result.amount).toBe(100);
      expect(result.total).toBe(2500);
    });
  });

  describe('resolveInvoiced – invoice lookup by ID', () => {
    it('finds correct invoice line even when invoiceIdx order changed', () => {
      // Simulates the bug: invoiceIdx points to wrong invoice because DB order differs
      const parsedPO = makeParsedPO([
        { description: 'אלון שברון Elegant', quantity: 82.5, unitPrice: 691.86 },
      ]);

      // Two invoices — settlement (גמר חשבון) and advance (מקדמה)
      const parsedSettlement = makeParsedInvoice(
        [{ description: 'גמר חשבון - הזמנת רכש', quantity: 1, unitPrice: 57380.51 }],
        'SI256P002575',
      );
      const parsedAdvance = makeParsedInvoice(
        [{ description: 'מקדמה', quantity: 1, unitPrice: 23650.34 }],
        'SI256P000076',
      );

      const po = buildPO(parsedPO);
      const settlementInv = buildInvoice(parsedSettlement);
      const advanceInv = buildInvoice(parsedAdvance);

      // Pairing says invoiceIdx=0 (settlement was first during matching)
      // But in DB, advance invoice comes first
      const pairings = [{
        matchSource: 'ai',
        po: {
          id: po.lineItems[0].id,
          index: 0,
          description: po.lineItems[0].description,
          quantity: 82.5,
          unitPrice: 691.86,
        },
        inv: {
          id: settlementInv.lineItems[0].id, // ID points to correct line
          index: 0,
          invoiceIdx: 0, // But invoiceIdx is stale — DB has different order
          description: 'גמר חשבון - הזמנת רכש',
          quantity: 1,
          unitPrice: 57380.51,
          totalPrice: 57380.51,
        },
      }];

      // In DB, advance comes first (index 0), settlement second (index 1)
      const match = {
        id: 'match-1',
        invoices: [advanceInv, settlementInv], // different order than invoiceIdx!
        deliveryNotes: [],
      };

      const result = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        167.38, po.lineItems[0], 82.5, 691.86,
      );

      // Should find the settlement line by ID, not by invoiceIdx
      expect(result.total).toBe(57380.51);
      expect(result.amount).toBe(82.5);
    });
  });

  describe('resolveInvoiced – proportional distribution', () => {
    it('distributes settlement total proportionally when it covers full PO', () => {
      const parsedPO = makeParsedPO([
        { description: 'פריט א', quantity: 60, unitPrice: 100 },
        { description: 'פריט ב', quantity: 40, unitPrice: 100 },
      ]);
      // Settlement covers entire PO (10000 = 6000 + 4000)
      const parsedInv = makeParsedInvoice([
        { description: 'גמר חשבון', quantity: 1, unitPrice: 10000 },
      ]);

      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
        { poIndex: 1, invIndex: 0 },
      ]);

      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      // Line 0: 60 × 100 = 6000, which is 60% of 10000
      const result0 = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        60, po.lineItems[0], 60, 100,
      );

      expect(result0.amount).toBe(60);
      expect(result0.total).toBe(6000); // 10000 × (6000/10000)
    });

    it('does NOT distribute when settlement covers only one PO line', () => {
      const parsedPO = makeParsedPO([
        { description: 'אלון שברון', quantity: 82.5, unitPrice: 691.86 },
        { description: 'הובלה', quantity: 1, unitPrice: 600 },
      ]);
      // Settlement total ≈ PO line 0 total only (not full PO)
      const parsedInv = makeParsedInvoice([
        { description: 'גמר חשבון', quantity: 1, unitPrice: 57380.51 },
      ]);

      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
      ]);

      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      const result = resolveInvoiced(
        pairings[0], pairings, match, undefined,
        167.38, po.lineItems[0], 82.5, 691.86,
      );

      // Should keep total as-is (not distribute) since it covers only this PO line
      expect(result.total).toBe(57380.51);
      expect(result.amount).toBe(82.5);
    });
  });

  describe('deriveQtyFromInvoice – settlement line filtering', () => {
    it('skips settlement invoice lines (גמר חשבון)', () => {
      const match = {
        invoices: [{
          lineItems: [
            { description: 'הזמנת רכש- גמר חשבון', totalPrice: 57380.51, unitPrice: 57380.51, sortOrder: 0, id: 'inv-li-1' },
          ],
        }],
      };

      const pairing = {
        inv: { id: 'inv-li-1', index: 0, invoiceIdx: 0, description: 'הזמנת רכש- גמר חשבון' },
      };

      const result = deriveQtyFromInvoice(pairing, match, 'אלון שברון', undefined);
      expect(result).toBeNull();
    });

    it('skips מקדמה lines', () => {
      const match = {
        invoices: [{
          lineItems: [
            { description: 'מקדמה', totalPrice: 23650.34, unitPrice: 23650.34, sortOrder: 0, id: 'inv-li-1' },
          ],
        }],
      };

      const pairing = {
        inv: { id: 'inv-li-1', index: 0, invoiceIdx: 0, description: 'מקדמה' },
      };

      const result = deriveQtyFromInvoice(pairing, match, 'אלון שכבתי', undefined);
      expect(result).toBeNull();
    });

    it('returns qty for regular invoice lines', () => {
      const match = {
        invoices: [{
          lineItems: [
            { description: 'ברזל 10 מ"מ', totalPrice: 2500, unitPrice: 25, sortOrder: 0, id: 'inv-li-1' },
          ],
        }],
      };

      const pairing = {
        inv: { id: 'inv-li-1', index: 0, invoiceIdx: 0, description: 'ברזל 10 מ"מ' },
      };

      const result = deriveQtyFromInvoice(pairing, match, 'ברזל 10 מ"מ', undefined);
      expect(result).toBe(100); // 2500 / 25 = 100
    });
  });

  describe('buildLineItem – full settlement scenario (prod4)', () => {
    it('handles PO with settlement + advance invoices correctly', () => {
      // Reproduces the exact prod4 scenario
      const parsedPO = makeParsedPO([
        { description: 'Grigio Dolomite 12.5/90/540גמר לכה Elegant אלון שברון', quantity: 82.5, unitPrice: 691.86, catalogNumber: '5245800126' },
        { description: '12.5/90/490-1200 אלון Elegant Grigio Dolomite שכבתי', quantity: 41, unitPrice: 516, catalogNumber: '5245800126' },
        { description: 'הובלה', quantity: 1, unitPrice: 600, catalogNumber: '4143400001' },
      ]);

      const parsedDN = makeParsedDN([
        { description: 'אלון שברון Elegant Grigio Dolomite 12.5/90/540 גמר לכה', quantity: 167.38, unitPrice: 691.86 },
        { description: 'אלון שכבתי Elegant Grigio Dolomite ,12.5/90/490-1200 לכה', quantity: 83.952, unitPrice: 516 },
        { description: 'הובלה, (אזור מרכז: נתניה -ת"א) - עד 7 טון', quantity: 1, unitPrice: 600 },
      ]);

      const parsedSettlement = makeParsedInvoice(
        [{ description: 'גמר חשבון - הזמנת רכש 25000432', quantity: 1, unitPrice: 57380.51 }],
        'SI256P002575',
      );
      const parsedAdvance = makeParsedInvoice(
        [{ description: 'מקדמה', quantity: 1, unitPrice: 23650.34 }],
        'SI256P000076',
      );

      const po = buildPO(parsedPO);
      const dn = buildDN(parsedDN);
      const settlementInv = buildInvoice(parsedSettlement);
      const advanceInv = buildInvoice(parsedAdvance);

      // Pairings like the real matching produces
      const pairings = buildPairingWithInvDetails(
        po, [dn], [settlementInv, advanceInv],
        [
          { poIndex: 0, dnIndex: 0, invIndex: 0, invoiceArrayIndex: 0 },
          { poIndex: 1, dnIndex: 1, invIndex: 0, invoiceArrayIndex: 1 },
          { poIndex: 2, dnIndex: 2 },
        ],
      );

      const match = {
        id: 'match-1',
        deliveryNotes: [dn],
        invoices: [settlementInv, advanceInv],
        lineItemPairings: pairings,
      };

      // Line 0: שברון with settlement invoice
      const r0 = buildLineItem(po, po.lineItems[0], match, pairings);
      expect(r0.orderedQty).toBe(82.5);
      expect(r0.receivedQty).toBe(167.38);
      expect(r0.unitPrice).toBe(691.86);
      expect(r0.invoicedAmount).toBe(82.5);
      expect(r0.invoicedTotal).toBe(57380.51);
      expect(r0.deliveryStatus).toBe('over');

      // Line 1: שכבתי with advance payment
      const r1 = buildLineItem(po, po.lineItems[1], match, pairings);
      expect(r1.orderedQty).toBe(41);
      expect(r1.receivedQty).toBe(83.952);
      expect(r1.unitPrice).toBe(516);
      expect(r1.invoicedAmount).toBe(41);
      expect(r1.invoicedTotal).toBe(23650.34);
      expect(r1.deliveryStatus).toBe('over');

      // Line 2: הובלה – no invoice paired
      const r2 = buildLineItem(po, po.lineItems[2], match, pairings);
      expect(r2.orderedQty).toBe(1);
      expect(r2.receivedQty).toBe(1);
      expect(r2.unitPrice).toBe(600);
      expect(r2.invoicedStatus).toBe('pending');
      expect(r2.deliveryStatus).toBe('full');
    });

    it('does not swap qty/price for settlement lines', () => {
      // Settlement line: qty=1, unitPrice=57380.51
      // This should NEVER produce qty=57380.51 (the old swap bug)
      const parsedPO = makeParsedPO([
        { description: 'אלון שברון', quantity: 82.5, unitPrice: 691.86 },
      ]);
      const parsedInv = makeParsedInvoice([
        { description: 'גמר חשבון', quantity: 1, unitPrice: 57380.51 },
      ]);

      const po = buildPO(parsedPO);
      const inv = buildInvoice(parsedInv);

      const pairings = buildPairingWithInvDetails(po, [], [inv], [
        { poIndex: 0, invIndex: 0 },
      ]);
      const match = { id: 'match-1', invoices: [inv], deliveryNotes: [] };

      const result = buildLineItem(po, po.lineItems[0], match, pairings);

      // invoicedAmount should be ordered qty, NOT 57380.51
      expect(result.invoicedAmount).toBe(82.5);
      expect(result.invoicedAmount).not.toBe(57380.51);
      expect(result.invoicedAmount).not.toBe(1);
    });
  });

  describe('buildLineItem – service items', () => {
    it('marks service items (הובלה) correctly', () => {
      const parsedPO = makeParsedPO([
        { description: 'הובלה', quantity: 1, unitPrice: 600 },
      ]);
      const po = buildPO(parsedPO);
      const match = buildMatch(po, [], [], [{ poIndex: 0 }]);

      const result = buildLineItem(po, po.lineItems[0], match, match.lineItemPairings);
      expect(result.isService).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.deliveryStatus).toBe('none');
    });
  });
});
