import { describe, expect, it } from 'vitest';
import {
  ItemLine,
  aggregateItemLines,
  buildDescriptionWhere,
  tokenVariants,
} from '../intelligence/chat/item-aggregation.helper';

const line = (overrides: Partial<ItemLine>): ItemLine => ({
  description: 'מלט שחור 25 ק"ג',
  quantity: 10,
  unit: 'שק',
  unitPrice: 20,
  totalPrice: 200,
  docId: 'doc-1',
  docNumber: '1001',
  docDate: '2026-01-15',
  projectId: 'proj-1',
  projectName: 'אולם ספורט רעננה',
  supplierId: 'sup-1',
  supplierName: 'ש. דוגמה',
  ...overrides,
});

describe('tokenVariants', () => {
  it('splits a query into tokens', () => {
    expect(tokenVariants('מלט שחור 25')).toEqual([['מלט'], ['שחור'], ['25']]);
  });

  it('generates straight-quote, gershayim and bare variants for quoted tokens', () => {
    const variants = tokenVariants('ק"ג')[0];
    expect(variants).toContain('ק"ג');
    expect(variants).toContain('ק״ג');
    expect(variants).toContain('קג');
  });
});

describe('buildDescriptionWhere', () => {
  it('requires every token and ORs its variants', () => {
    const where = buildDescriptionWhere('מלט ק"ג') as any;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual([
      { description: { contains: 'מלט', mode: 'insensitive' } },
    ]);
    expect(where.AND[1].OR.length).toBeGreaterThanOrEqual(3);
  });
});

describe('aggregateItemLines', () => {
  it('sums quantities per unit and counts distinct documents', () => {
    const agg = aggregateItemLines(
      [
        line({ docId: 'a', quantity: 100 }),
        line({ docId: 'b', quantity: 50 }),
        line({ docId: 'b', quantity: 5, unit: 'קרטון', unitPrice: null, totalPrice: null }),
      ],
      'none',
    );
    expect(agg.matchedLineCount).toBe(3);
    expect(agg.documentCount).toBe(2);
    expect(agg.dominantUnit).toBe('שק');
    expect(agg.totalsByUnit).toEqual([
      { unit: 'שק', totalQuantity: 150, lineCount: 2 },
      { unit: 'קרטון', totalQuantity: 5, lineCount: 1 },
    ]);
  });

  it('computes quantity-weighted average price and min/max', () => {
    const agg = aggregateItemLines(
      [
        line({ quantity: 100, unitPrice: 15, totalPrice: 1500 }),
        line({ docId: 'b', quantity: 50, unitPrice: 24, totalPrice: 1200 }),
      ],
      'none',
    );
    expect(agg.price.avgUnitPrice).toBe(18); // (100*15 + 50*24) / 150
    expect(agg.price.minUnitPrice).toBe(15);
    expect(agg.price.maxUnitPrice).toBe(24);
    expect(agg.price.totalSpend).toBe(2700);
  });

  it('breaks down by supplier sorted by quantity desc', () => {
    const agg = aggregateItemLines(
      [
        line({ quantity: 30, supplierName: 'ש. דוגמה' }),
        line({ docId: 'b', quantity: 70, supplierName: 'אלוני' }),
      ],
      'supplier',
    );
    expect(agg.breakdown.map((b) => b.label)).toEqual(['אלוני', 'ש. דוגמה']);
    expect(agg.breakdown[0].totalQuantity).toBe(70);
  });

  it('breaks down by month sorted chronologically', () => {
    const agg = aggregateItemLines(
      [
        line({ docDate: '2026-03-02', quantity: 5 }),
        line({ docId: 'b', docDate: '2026-01-20', quantity: 9 }),
      ],
      'month',
    );
    expect(agg.breakdown.map((b) => b.key)).toEqual(['2026-01', '2026-03']);
  });

  it('handles empty input', () => {
    const agg = aggregateItemLines([], 'none');
    expect(agg.matchedLineCount).toBe(0);
    expect(agg.price.avgUnitPrice).toBeNull();
    expect(agg.dominantUnit).toBeNull();
    expect(agg.supplierBreakdown).toEqual([]);
    expect(agg.leadingSupplier).toBeNull();
    expect(agg.priceInsight).toBeNull();
    expect(agg.itemCode).toBeNull();
  });

  it('builds a rich supplier breakdown with share, weighted price and source doc', () => {
    const agg = aggregateItemLines(
      [
        line({ docId: 'a', docNumber: '8716', quantity: 1605, unitPrice: 17.44, totalPrice: 27991.2, supplierName: 'ת. דוגמה' }),
        line({ docId: 'b', docNumber: '1242', quantity: 175, unitPrice: 18.1, totalPrice: 3167.5, supplierName: 'חב׳ הדוגמה' }),
        line({ docId: 'c', docNumber: '4051', quantity: 60, unitPrice: 17.85, totalPrice: 1071, supplierName: 'בטון לדוגמה' }),
      ],
      'none',
      'invoice',
    );
    expect(agg.supplierBreakdown.map((s) => s.label)).toEqual(['ת. דוגמה', 'חב׳ הדוגמה', 'בטון לדוגמה']);
    const leader = agg.supplierBreakdown[0];
    expect(leader.totalQuantity).toBe(1605);
    expect(leader.avgUnitPrice).toBe(17.44);
    expect(leader.sharePct).toBe(87.2); // 1605 / 1840
    expect(leader.source).toEqual({ type: 'invoice', number: '8716', docId: 'a' });
    expect(leader.supplierId).toBe('sup-1');
    expect(leader.firstDate).toBe('2026-01-15');
    expect(leader.lastDate).toBe('2026-01-15');
    expect(agg.leadingSupplier?.name).toBe('ת. דוגמה');
    expect(agg.leadingSupplier?.sharePct).toBe(87.2);
  });

  it('flags the biggest unit-price deviation as a variance insight', () => {
    const agg = aggregateItemLines(
      [
        line({ docId: 'a', quantity: 1000, unitPrice: 17.44, totalPrice: 17440 }),
        line({ docId: 'b', docNumber: '8842', quantity: 50, unitPrice: 22, totalPrice: 1100, supplierName: 'חב׳ הדוגמה' }),
      ],
      'none',
      'invoice',
    );
    expect(agg.priceInsight?.kind).toBe('variance');
    expect(agg.priceInsight?.docNumber).toBe('8842');
    expect(agg.priceInsight?.supplierName).toBe('חב׳ הדוגמה');
    expect(agg.priceInsight?.estBudgetImpact).toBeGreaterThan(0);
  });

  it('reports a stable price insight when prices barely move', () => {
    const agg = aggregateItemLines(
      [
        line({ docId: 'a', quantity: 100, unitPrice: 17.44, totalPrice: 1744 }),
        line({ docId: 'b', quantity: 100, unitPrice: 17.45, totalPrice: 1745 }),
      ],
      'none',
    );
    expect(agg.priceInsight?.kind).toBe('stable');
  });

  it('picks the most common catalog number as the item code', () => {
    const agg = aggregateItemLines(
      [
        line({ docId: 'a', catalogNumber: '10002' }),
        line({ docId: 'b', catalogNumber: '10002' }),
        line({ docId: 'c', catalogNumber: '99999' }),
      ],
      'none',
    );
    expect(agg.itemCode).toBe('10002');
  });
});
