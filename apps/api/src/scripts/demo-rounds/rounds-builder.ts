// apps/api/src/scripts/demo-rounds/rounds-builder.ts
import {
  DemoConfig,
  DemoDoc,
  DemoDocType,
  DemoItem,
  DemoProject,
  DemoRound,
  DemoSupplier,
  DocLine,
  RoundScenario,
} from './types';
import { Rng, createRng, hashString, intBetween, priceBetween, round2 } from './rng';

export interface RoundPlan {
  scenario: RoundScenario;
  supplierIdx: number;
  projectIdx: number;
  month: number; // 1..5 → Jan..May 2026
  dnCount: number;
  mustIncludeItemIdx?: number[];
}

// 12 rounds → 12 POs, 12 invoices, 15 delivery notes (3 + 2 + 1×10).
// Item 0 (cement) is planted across 3 suppliers and 3 projects so the demo
// questions (total / per-project+dates / per-supplier+price) have rich,
// comparable answers. Supplier 0 = ש. דוגמה, project 0 = אולם ספורט רעננה.
export const ROUND_PLANS: RoundPlan[] = [
  { scenario: 'split-delivery', supplierIdx: 0, projectIdx: 0, month: 1, dnCount: 3, mustIncludeItemIdx: [0] },
  { scenario: 'shortage', supplierIdx: 1, projectIdx: 1, month: 2, dnCount: 1, mustIncludeItemIdx: [0] },
  { scenario: 'overcharge', supplierIdx: 2, projectIdx: 0, month: 3, dnCount: 1, mustIncludeItemIdx: [1] },
  { scenario: 'clean', supplierIdx: 0, projectIdx: 2, month: 2, dnCount: 2, mustIncludeItemIdx: [0] },
  { scenario: 'clean', supplierIdx: 3, projectIdx: 0, month: 4, dnCount: 1, mustIncludeItemIdx: [0] },
  { scenario: 'clean', supplierIdx: 0, projectIdx: 0, month: 5, dnCount: 1, mustIncludeItemIdx: [0, 1] },
  { scenario: 'clean', supplierIdx: 4, projectIdx: 1, month: 1, dnCount: 1 },
  { scenario: 'clean', supplierIdx: 2, projectIdx: 3, month: 3, dnCount: 1, mustIncludeItemIdx: [1] },
  { scenario: 'clean', supplierIdx: 1, projectIdx: 2, month: 4, dnCount: 1, mustIncludeItemIdx: [0] },
  { scenario: 'clean', supplierIdx: 4, projectIdx: 3, month: 5, dnCount: 1 },
  { scenario: 'clean', supplierIdx: 3, projectIdx: 1, month: 2, dnCount: 1, mustIncludeItemIdx: [0] },
  { scenario: 'clean', supplierIdx: 1, projectIdx: 0, month: 3, dnCount: 1, mustIncludeItemIdx: [1, 0] },
];

const DEMO_YEAR = 2026;

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (month: number, day: number) => `${DEMO_YEAR}-${pad2(month)}-${pad2(day)}`;

const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Different suppliers may name the same catalog item differently. Pick is
// stable per (supplier, item) so every doc from that supplier agrees.
const aliasFor = (supplier: DemoSupplier, item: DemoItem): string => {
  const names = [item.description, ...(item.aliases ?? [])];
  return names[hashString(`${supplier.docPrefix}:${item.catalogNumber}`) % names.length];
};

// Bulk materials get bulk quantities; expensive tools get small ones.
const quantityFor = (rng: Rng, item: DemoItem): number => {
  if (item.priceMax <= 30) return intBetween(rng, 50, 300);
  if (item.priceMax <= 120) return intBetween(rng, 20, 100);
  return intBetween(rng, 2, 10);
};

interface Counters {
  po: number;
  inv: number;
  dnBySupplier: Record<string, number>;
}

export const buildRounds = (config: DemoConfig): DemoRound[] => {
  const rng = createRng(config.seed);
  const counters: Counters = { po: 1000, inv: 0, dnBySupplier: {} };
  return ROUND_PLANS.map((plan, index) => buildRound(config, plan, index, rng, counters));
};

const buildRound = (
  config: DemoConfig,
  plan: RoundPlan,
  index: number,
  rng: Rng,
  counters: Counters,
): DemoRound => {
  const supplier = config.suppliers[plan.supplierIdx % config.suppliers.length];
  const project = config.projects[plan.projectIdx % config.projects.length];

  const itemIdxs = new Set<number>(
    (plan.mustIncludeItemIdx ?? []).map((i) => i % config.items.length),
  );
  const targetCount = Math.max(itemIdxs.size, intBetween(rng, 2, 4));
  while (itemIdxs.size < targetCount) {
    itemIdxs.add(intBetween(rng, 0, config.items.length - 1));
  }
  const items = [...itemIdxs].map((i) => config.items[i]);

  const poLines: DocLine[] = items.map((item) => {
    const quantity = quantityFor(rng, item);
    const unitPrice = priceBetween(rng, item.priceMin, item.priceMax);
    return {
      description: aliasFor(supplier, item),
      catalogNumber: item.catalogNumber,
      quantity,
      unit: item.unit,
      unitPrice,
      totalPrice: round2(quantity * unitPrice),
    };
  });

  const poDate = isoDate(plan.month, intBetween(rng, 2, 12));
  const poNumber = `PO-${DEMO_YEAR}-${counters.po++}`;
  const po = makeDoc('purchase_order', poNumber, poDate, supplier, project, null, poLines, config.vatRate, true);
  po.fileName = `${poNumber}.pdf`;

  const dnQuantities = splitQuantities(plan, poLines);
  const deliveryNotes: DemoDoc[] = dnQuantities.map((lineQtys, dnIdx) => {
    counters.dnBySupplier[supplier.docPrefix] =
      (counters.dnBySupplier[supplier.docPrefix] ?? 5000) + 1;
    const number = `${supplier.docPrefix}-${counters.dnBySupplier[supplier.docPrefix]}`;
    const date = addDaysIso(poDate, 2 + dnIdx * intBetween(rng, 3, 6));
    const lines: DocLine[] = poLines
      .map((poLine, i) => ({ ...poLine, quantity: lineQtys[i] }))
      .filter((l) => l.quantity > 0)
      .map((l) =>
        supplier.pricesOnDeliveryNote
          ? { ...l, totalPrice: round2(l.quantity * (l.unitPrice ?? 0)) }
          : { ...l, unitPrice: null, totalPrice: null },
      );
    const dn = makeDoc(
      'delivery_note', number, date, supplier, project, poNumber, lines,
      config.vatRate, supplier.pricesOnDeliveryNote, false,
    );
    dn.fileName = `DN-${number}.pdf`;
    return dn;
  });

  const lastDnDate = deliveryNotes[deliveryNotes.length - 1].date;
  const deliveredTotals = poLines.map((_, i) =>
    dnQuantities.reduce((s, q) => s + q[i], 0),
  );
  const priceFactor = plan.scenario === 'overcharge' ? 1.18 : 1;
  const invLines: DocLine[] = poLines
    .map((poLine, i) => {
      const quantity = deliveredTotals[i];
      const unitPrice = round2((poLine.unitPrice ?? 0) * priceFactor);
      return { ...poLine, quantity, unitPrice, totalPrice: round2(quantity * unitPrice) };
    })
    .filter((l) => l.quantity > 0);
  const invNumber =
    `${supplier.docPrefix}-INV-${DEMO_YEAR}-${String(++counters.inv).padStart(3, '0')}`;
  const invoice = makeDoc(
    'invoice', invNumber, addDaysIso(lastDnDate, intBetween(rng, 1, 2)),
    supplier, project, poNumber, invLines, config.vatRate, true,
  );
  invoice.fileName = `INV-${invNumber}.pdf`;

  return { index, scenario: plan.scenario, supplier, project, po, deliveryNotes, invoice };
};

/** How much of each PO line lands on each delivery note. */
const splitQuantities = (plan: RoundPlan, poLines: DocLine[]): number[][] => {
  if (plan.scenario === 'shortage') {
    // Single DN, every line ~80% of ordered — the classic "חוסרים" demo.
    return [poLines.map((l) => Math.max(1, Math.floor(l.quantity * 0.8)))];
  }
  if (plan.dnCount === 1) return [poLines.map((l) => l.quantity)];
  const fractions = plan.dnCount === 3 ? [0.4, 0.35, 0.25] : [0.6, 0.4];
  return fractions.map((f, idx) =>
    poLines.map((l) => {
      if (idx === fractions.length - 1) {
        const used = fractions
          .slice(0, idx)
          .reduce((s, ff) => s + Math.floor(l.quantity * ff), 0);
        return l.quantity - used;
      }
      return Math.floor(l.quantity * f);
    }),
  );
};

const makeDoc = (
  type: DemoDocType,
  number: string,
  date: string,
  supplier: DemoSupplier,
  project: DemoProject,
  poReference: string | null,
  lines: DocLine[],
  vatRate: number,
  withPrices: boolean,
  withVat: boolean = type !== 'delivery_note',
): DemoDoc => {
  const subtotal = withPrices
    ? round2(lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0))
    : null;
  const vatAmount = withPrices && withVat && subtotal != null ? round2(subtotal * vatRate) : null;
  return {
    type,
    number,
    date,
    supplier,
    project,
    poReference,
    lines,
    subtotal,
    vatAmount,
    totalAmount: subtotal != null ? round2(subtotal + (vatAmount ?? 0)) : null,
    fileName: '',
  };
};
