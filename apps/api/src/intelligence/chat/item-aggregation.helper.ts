// Pure helpers for the item-supply chat tools. No Nest/Prisma imports so
// everything here is unit-testable.

export interface ItemLine {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  catalogNumber?: string | null;
  docId: string;
  docNumber: string | null;
  docDate: string | null; // ISO yyyy-mm-dd
  projectId: string | null;
  projectName: string | null;
  supplierId: string | null;
  supplierName: string | null;
}

export type ItemGroupBy = 'project' | 'supplier' | 'month' | 'none';
export type ItemSourceType = 'invoice' | 'delivery_note' | 'purchase_order';

export interface ItemSupplySource {
  type: ItemSourceType;
  number: string | null;
  docId: string | null;
}

export interface SupplierBreakdownRow {
  key: string;
  label: string;
  totalQuantity: number;
  avgUnitPrice: number | null;
  totalSpend: number;
  sharePct: number;
  supplierId: string | null;
  firstDate: string | null;
  lastDate: string | null;
  source: ItemSupplySource | null;
}

export interface LeadingSupplier {
  name: string;
  totalQuantity: number;
  totalSpend: number;
  sharePct: number;
}

export interface PriceInsight {
  kind: 'stable' | 'variance';
  variancePct: number | null;
  supplierName: string | null;
  docNumber: string | null;
  outlierUnitPrice: number | null;
  avgUnitPrice: number | null;
  estBudgetImpact: number | null;
}

export interface ItemSupplyAggregation {
  matchedLineCount: number;
  documentCount: number;
  itemCode: string | null;
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  leadingSupplier: LeadingSupplier | null;
  supplierBreakdown: SupplierBreakdownRow[];
  priceInsight: PriceInsight | null;
  breakdown: Array<{
    key: string;
    label: string;
    id: string | null;
    totalQuantity: number;
    totalSpend: number;
    documentCount: number;
  }>;
}

const DEFAULT_UNIT = 'יח׳';

const hasQuote = (s: string) => /["״'׳]/.test(s);

/**
 * Splits a free-text item query into tokens; each token maps to the spelling
 * variants that should match in the DB. Hebrew docs mix straight quotes (ק"ג)
 * with gershayim (ק״ג), so quoted tokens get both forms plus a bare form.
 */
export const tokenVariants = (query: string): string[][] =>
  query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => {
      if (!hasQuote(token)) return [token];
      const straight = token.replace(/״/g, '"').replace(/׳/g, "'");
      const gershayim = token.replace(/"/g, '״').replace(/'/g, '׳');
      const bare = token.replace(/["״'׳]/g, '');
      return [...new Set([straight, gershayim, bare].filter(Boolean))];
    });

/** Prisma where fragment: every token must appear (any variant, insensitive). */
export const buildDescriptionWhere = (itemQuery: string) => ({
  AND: tokenVariants(itemQuery).map((variants) => ({
    OR: variants.map((v) => ({
      description: { contains: v, mode: 'insensitive' as const },
    })),
  })),
});

/**
 * Relaxed fallbacks for when the strict (all-tokens) match returns nothing.
 * Each fragment requires ALL tokens except one (drop-one-token), so a query
 * that uses a canonical word absent from the documents still matches: e.g.
 * "מלט שחור 25 ק״ג" — suppliers print aliases like "שק מלט 25 ק״ג" /
 * "מלט אפור שק 25 ק״ג" that never contain "שחור"; dropping it keeps
 * מלט+25+ק״ג and unifies all aliases of the same product. Only used when there
 * are ≥3 tokens (dropping one still leaves ≥2 — narrow enough to stay safe);
 * returns [] otherwise so short queries keep the strict behaviour.
 */
export const buildRelaxedDescriptionWheres = (itemQuery: string) => {
  const tokens = tokenVariants(itemQuery);
  if (tokens.length < 3) return [];
  return tokens.map((_, dropIdx) => ({
    AND: tokens
      .filter((__, i) => i !== dropIdx)
      .map((variants) => ({
        OR: variants.map((v) => ({
          description: { contains: v, mode: 'insensitive' as const },
        })),
      })),
  }));
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Most frequent non-empty value, or null. Used to surface a representative item code. */
const pickMostCommon = (values: Array<string | null | undefined>): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
};

/** Key with the largest accumulated value, or null for an empty map. */
const topKey = (map: Map<string, number>): string | null => {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of map) {
    if (value > bestValue) {
      bestValue = value;
      best = key;
    }
  }
  return best;
};

/** Per-supplier rollup with weighted unit price, quantity share and a representative source doc. */
const buildSupplierBreakdown = (
  lines: ItemLine[],
  docType: ItemSourceType,
  totalQuantity: number,
): SupplierBreakdownRow[] => {
  const map = new Map<
    string,
    {
      qty: number;
      spend: number;
      pricedQty: number;
      weighted: number;
      supplierId: string | null;
      docQty: Map<string, number>;
      docIds: Map<string, string>; // docNumber -> docId (representative)
      firstDate: string | null;
      lastDate: string | null;
    }
  >();
  for (const l of lines) {
    const name = l.supplierName?.trim() || 'ללא ספק';
    const g =
      map.get(name) ??
      {
        qty: 0,
        spend: 0,
        pricedQty: 0,
        weighted: 0,
        supplierId: null,
        docQty: new Map<string, number>(),
        docIds: new Map<string, string>(),
        firstDate: null,
        lastDate: null,
      };
    g.qty += l.quantity;
    g.spend += l.totalPrice ?? l.quantity * (l.unitPrice ?? 0);
    if (l.unitPrice != null && l.unitPrice > 0) {
      g.pricedQty += l.quantity;
      g.weighted += l.quantity * l.unitPrice;
    }
    if (g.supplierId == null && l.supplierId) g.supplierId = l.supplierId;
    if (l.docNumber) {
      g.docQty.set(l.docNumber, (g.docQty.get(l.docNumber) ?? 0) + l.quantity);
      if (!g.docIds.has(l.docNumber)) g.docIds.set(l.docNumber, l.docId);
    }
    if (l.docDate) {
      if (!g.firstDate || l.docDate < g.firstDate) g.firstDate = l.docDate;
      if (!g.lastDate || l.docDate > g.lastDate) g.lastDate = l.docDate;
    }
    map.set(name, g);
  }
  return [...map.entries()]
    .map(([key, g]) => {
      const repDoc = topKey(g.docQty);
      return {
        key,
        label: key,
        totalQuantity: round3(g.qty),
        avgUnitPrice: g.pricedQty > 0 ? round2(g.weighted / g.pricedQty) : null,
        totalSpend: round2(g.spend),
        sharePct: totalQuantity > 0 ? round1((g.qty / totalQuantity) * 100) : 0,
        supplierId: g.supplierId,
        firstDate: g.firstDate,
        lastDate: g.lastDate,
        source: {
          type: docType,
          number: repDoc,
          docId: repDoc ? g.docIds.get(repDoc) ?? null : null,
        },
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
};

/** Flags the single biggest unit-price deviation from the weighted average (best-effort). */
const buildPriceInsight = (priced: ItemLine[], avg: number | null): PriceInsight | null => {
  if (!priced.length || avg == null || avg <= 0) return null;
  let outlier: ItemLine | null = null;
  let maxDev = 0;
  for (const l of priced) {
    const dev = Math.abs((l.unitPrice as number) - avg) / avg;
    if (dev > maxDev) {
      maxDev = dev;
      outlier = l;
    }
  }
  if (!outlier || maxDev < 0.02) {
    return {
      kind: 'stable',
      variancePct: null,
      supplierName: null,
      docNumber: null,
      outlierUnitPrice: null,
      avgUnitPrice: round2(avg),
      estBudgetImpact: null,
    };
  }
  const up = outlier.unitPrice as number;
  return {
    kind: 'variance',
    variancePct: round1(((up - avg) / avg) * 100),
    supplierName: outlier.supplierName,
    docNumber: outlier.docNumber,
    outlierUnitPrice: round2(up),
    avgUnitPrice: round2(avg),
    estBudgetImpact: round2(Math.abs(up - avg) * outlier.quantity),
  };
};

const groupKeyOf = (
  l: ItemLine,
  groupBy: ItemGroupBy,
): { key: string; label: string; id: string | null } => {
  if (groupBy === 'project') {
    const name = l.projectName ?? 'ללא פרויקט';
    return { key: name, label: name, id: l.projectId ?? null };
  }
  if (groupBy === 'supplier') {
    const name = l.supplierName ?? 'ללא ספק';
    return { key: name, label: name, id: l.supplierId ?? null };
  }
  const month = l.docDate ? l.docDate.slice(0, 7) : 'ללא תאריך';
  return { key: month, label: month, id: null };
};

export const aggregateItemLines = (
  lines: ItemLine[],
  groupBy: ItemGroupBy,
  docType: ItemSourceType = 'delivery_note',
): ItemSupplyAggregation => {
  const docIds = new Set(lines.map((l) => l.docId));

  const unitMap = new Map<string, { totalQuantity: number; lineCount: number }>();
  for (const l of lines) {
    const unit = (l.unit ?? '').trim() || DEFAULT_UNIT;
    const entry = unitMap.get(unit) ?? { totalQuantity: 0, lineCount: 0 };
    entry.totalQuantity += l.quantity;
    entry.lineCount += 1;
    unitMap.set(unit, entry);
  }
  const totalsByUnit = [...unitMap.entries()]
    .map(([unit, v]) => ({
      unit,
      totalQuantity: round3(v.totalQuantity),
      lineCount: v.lineCount,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
  const dominantUnit = totalsByUnit[0]?.unit ?? null;

  const priced = lines.filter((l) => l.unitPrice != null && l.unitPrice > 0);
  const pricedQty = priced.reduce((s, l) => s + l.quantity, 0);
  const weighted = priced.reduce((s, l) => s + l.quantity * (l.unitPrice as number), 0);
  const totalSpend = lines.reduce(
    (s, l) => s + (l.totalPrice ?? l.quantity * (l.unitPrice ?? 0)),
    0,
  );

  const groups = new Map<
    string,
    { label: string; id: string | null; totalQuantity: number; totalSpend: number; docIds: Set<string> }
  >();
  if (groupBy !== 'none') {
    for (const l of lines) {
      const { key, label, id } = groupKeyOf(l, groupBy);
      const g =
        groups.get(key) ??
        { label, id, totalQuantity: 0, totalSpend: 0, docIds: new Set<string>() };
      const unit = (l.unit ?? '').trim() || DEFAULT_UNIT;
      // Quantities are only comparable within one unit — count the dominant
      // unit's quantity per group; spend is summable across units.
      if (unit === dominantUnit) g.totalQuantity += l.quantity;
      g.totalSpend += l.totalPrice ?? l.quantity * (l.unitPrice ?? 0);
      g.docIds.add(l.docId);
      groups.set(key, g);
    }
  }

  const breakdown = [...groups.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    id: g.id,
    totalQuantity: round3(g.totalQuantity),
    totalSpend: round2(g.totalSpend),
    documentCount: g.docIds.size,
  }));
  breakdown.sort((a, b) =>
    groupBy === 'month' ? a.key.localeCompare(b.key) : b.totalQuantity - a.totalQuantity,
  );

  const avgUnitPrice = pricedQty > 0 ? round2(weighted / pricedQty) : null;
  const totalQuantityAll = lines.reduce((s, l) => s + l.quantity, 0);
  const supplierBreakdown = buildSupplierBreakdown(lines, docType, totalQuantityAll);
  const top = supplierBreakdown[0];
  const leadingSupplier: LeadingSupplier | null = top
    ? {
        name: top.label,
        totalQuantity: top.totalQuantity,
        totalSpend: top.totalSpend,
        sharePct: top.sharePct,
      }
    : null;

  return {
    matchedLineCount: lines.length,
    documentCount: docIds.size,
    itemCode: pickMostCommon(lines.map((l) => l.catalogNumber)),
    totalsByUnit,
    dominantUnit,
    price: {
      avgUnitPrice,
      minUnitPrice: priced.length
        ? Math.min(...priced.map((l) => l.unitPrice as number))
        : null,
      maxUnitPrice: priced.length
        ? Math.max(...priced.map((l) => l.unitPrice as number))
        : null,
      totalSpend: round2(totalSpend),
    },
    leadingSupplier,
    supplierBreakdown,
    priceInsight: buildPriceInsight(priced, avgUnitPrice),
    breakdown,
  };
};
