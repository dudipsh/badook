# Chat Item Analytics — תוכנית מימוש (שאילתות כמות/מחיר לפריטים + פילטרים ועיצוב לצ'אט)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** הצ'אט של Badook יידע לענות על שאלות כמותיות ברמת פריט — "כמה שקי מלט שחור 25 ק"ג סופקו בכל הפרויקטים?", "כמה סופקו בפרויקט אולם ספורט רעננה בין ינואר למאי 2026?", "כמה סיפק ש. דוגמה ובאיזה מחיר?" — ולהציג את התשובות בכרטיס ייעודי + Markdown מעוצב, עם סרגל פילטרים (פרויקט/ספק/תקופה) בממשק הצ'אט.

**Architecture:** שני כלים חדשים ב-tool-calling של Gemini (`find_supplied_items` לאיתור ניסוח פריט, `aggregate_item_supply` לסיכום כמויות/מחירים עם פילוח). האגרגציה נעשית ב-helper טהור (testable) אחרי שליפת שורות LineItem/InvoiceLineItem/POLineItem עם Prisma. בפרונט: כרטיס `item_supply_summary` חדש, רינדור Markdown להודעות הסוכן, סרגל scope שנשלח עם כל הודעה ומוזרק גם לפרומפט וגם כברירות מחדל לכלים.

**Tech Stack:** NestJS + Prisma + `@google/generative-ai` (קיים), React 19 + MobX + DaisyUI + i18next (קיים), `react-markdown` + `remark-gfm` (חדש, web בלבד).

---

## ⚠️ כללי עבודה מחייבים (הנחיות המשתמש — גוברות על הכל)

1. **אין ליצור git commits** עד שהמשתמש מאשר במפורש. דלגו על צעדי commit; במקומם הריצו את צעד האימות.
2. **אחרי כל שינוי backend**: `cd apps/api && npm run lint` חייב לעבור. בסוף העבודה — build מלא + הפעלה מחדש של השרת (Task 5).
3. **אין שינויי סכמת Prisma בתוכנית הזו** — אסור להריץ `prisma generate`/`db push`.
4. קבצי frontend: קומפוננטה אחת לקובץ, arrow functions, מקס' ~80 שורות לקומפוננטה, מקס' 3 props, כל טקסט דרך i18n. צבעי מותג רק דרך מחלקות theme של DaisyUI (`primary`, `base-200`...) — לא `bg-purple-100` וכד'.
5. שירותים/קבצים בצד שרת: עד ~400 שורות. לכן הכלים החדשים בקובץ service נפרד.
6. תוכנית זו אינה מתנגשת עם תוכנית `2026-06-12-demo-rounds-generator.md` (קבצים שונים לגמרי) — אפשר לרוץ במקביל.

---

## File Structure

**Create (api):**
- `apps/api/src/intelligence/chat/item-aggregation.helper.ts` — פונקציות טהורות: tokenization עם וריאנטים של גרשיים, בניית where, אגרגציה
- `apps/api/src/intelligence/chat/item-aggregation.helper.spec.ts` — בדיקות vitest
- `apps/api/src/intelligence/chat/chat-item-tools.service.ts` — מימוש שני הכלים החדשים

**Modify (api):**
- `apps/api/src/intelligence/chat/chat-tools.definitions.ts` — 2 הצהרות כלים חדשות
- `apps/api/src/intelligence/chat/chat-tools.service.ts` — ניתוב + מיזוג scope defaults
- `apps/api/src/intelligence/chat/chat.types.ts` — `ItemSupplySummaryCardData`, kind חדש, `ChatMessageScope`, עדכון `SendMessageDto`
- `apps/api/src/intelligence/chat/chat.service.ts` — מיפוי כלי→כרטיס, הנחיות Markdown, תמיכת scope
- `apps/api/src/intelligence/chat/chat.controller.ts` — העברת scope
- `apps/api/src/intelligence/chat/chat.module.ts` — רישום provider

**Create (web):**
- `apps/web/src/components/chat/ChatMarkdown.tsx`
- `apps/web/src/components/chat/ChatScopeBar.tsx`
- `apps/web/src/components/chat/ChatSuggestionChips.tsx`
- `apps/web/src/components/chat/cards/ItemSupplySummaryCard.tsx`
- `apps/web/src/components/chat/cards/ItemSupplyBreakdown.tsx`

**Modify (web):**
- `apps/web/src/services/chat.service.ts` — טיפוסים + scope ב-streamMessage
- `apps/web/src/stores/chat.store.ts` — state של scope
- `apps/web/src/components/chat/ChatMessageFeed.tsx` — שימוש ב-ChatMarkdown
- `apps/web/src/components/chat/cards/ChatCardRenderer.tsx` — case חדש
- `apps/web/src/components/chat/ChatModal.tsx` — הרכבת ChatScopeBar
- `apps/web/src/components/chat/ChatWelcomeScreen.tsx` — צ'יפים של שאלות לדוגמה
- `apps/web/src/i18n/locales/he/chat.json`, `apps/web/src/i18n/locales/en/chat.json`

---

### Task 1: helper טהור לאגרגציה + בדיקות

**Files:**
- Create: `apps/api/src/intelligence/chat/item-aggregation.helper.ts`
- Create: `apps/api/src/intelligence/chat/item-aggregation.helper.spec.ts`

- [ ] **Step 1.1: כתבו את קובץ הבדיקות (נכשל כי המודול לא קיים)**

```ts
// apps/api/src/intelligence/chat/item-aggregation.helper.spec.ts
import { describe, expect, it } from 'vitest';
import {
  ItemLine,
  aggregateItemLines,
  buildDescriptionWhere,
  tokenVariants,
} from './item-aggregation.helper';

const line = (overrides: Partial<ItemLine>): ItemLine => ({
  description: 'מלט שחור 25 ק"ג',
  quantity: 10,
  unit: 'שק',
  unitPrice: 20,
  totalPrice: 200,
  docId: 'doc-1',
  docNumber: '1001',
  docDate: '2026-01-15',
  projectName: 'אולם ספורט רעננה',
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
  });
});
```

- [ ] **Step 1.2: הריצו ובדקו שנכשל**

Run: `cd apps/api && npx vitest run src/intelligence/chat/item-aggregation.helper.spec.ts`
Expected: FAIL — "Cannot find module './item-aggregation.helper'"

- [ ] **Step 1.3: כתבו את המימוש**

```ts
// apps/api/src/intelligence/chat/item-aggregation.helper.ts
// Pure helpers for the item-supply chat tools. No Nest/Prisma imports so
// everything here is unit-testable.

export interface ItemLine {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  docId: string;
  docNumber: string | null;
  docDate: string | null; // ISO yyyy-mm-dd
  projectName: string | null;
  supplierName: string | null;
}

export type ItemGroupBy = 'project' | 'supplier' | 'month' | 'none';

export interface ItemSupplyAggregation {
  matchedLineCount: number;
  documentCount: number;
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  breakdown: Array<{
    key: string;
    label: string;
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

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const groupKeyOf = (l: ItemLine, groupBy: ItemGroupBy): { key: string; label: string } => {
  if (groupBy === 'project') {
    const name = l.projectName ?? 'ללא פרויקט';
    return { key: name, label: name };
  }
  if (groupBy === 'supplier') {
    const name = l.supplierName ?? 'ללא ספק';
    return { key: name, label: name };
  }
  const month = l.docDate ? l.docDate.slice(0, 7) : 'ללא תאריך';
  return { key: month, label: month };
};

export const aggregateItemLines = (
  lines: ItemLine[],
  groupBy: ItemGroupBy,
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
    { label: string; totalQuantity: number; totalSpend: number; docIds: Set<string> }
  >();
  if (groupBy !== 'none') {
    for (const l of lines) {
      const { key, label } = groupKeyOf(l, groupBy);
      const g =
        groups.get(key) ??
        { label, totalQuantity: 0, totalSpend: 0, docIds: new Set<string>() };
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
    totalQuantity: round3(g.totalQuantity),
    totalSpend: round2(g.totalSpend),
    documentCount: g.docIds.size,
  }));
  breakdown.sort((a, b) =>
    groupBy === 'month' ? a.key.localeCompare(b.key) : b.totalQuantity - a.totalQuantity,
  );

  return {
    matchedLineCount: lines.length,
    documentCount: docIds.size,
    totalsByUnit,
    dominantUnit,
    price: {
      avgUnitPrice: pricedQty > 0 ? round2(weighted / pricedQty) : null,
      minUnitPrice: priced.length
        ? Math.min(...priced.map((l) => l.unitPrice as number))
        : null,
      maxUnitPrice: priced.length
        ? Math.max(...priced.map((l) => l.unitPrice as number))
        : null,
      totalSpend: round2(totalSpend),
    },
    breakdown,
  };
};
```

- [ ] **Step 1.4: הריצו את הבדיקות — חייבות לעבור**

Run: `cd apps/api && npx vitest run src/intelligence/chat/item-aggregation.helper.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 1.5: אימות טיפוסים**

Run: `cd apps/api && npm run lint`
Expected: success, ללא שגיאות

---

### Task 2: שירות הכלים החדש — ChatItemToolsService

**Files:**
- Create: `apps/api/src/intelligence/chat/chat-item-tools.service.ts`

- [ ] **Step 2.1: כתבו את השירות**

```ts
// apps/api/src/intelligence/chat/chat-item-tools.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ItemGroupBy,
  ItemLine,
  aggregateItemLines,
  buildDescriptionWhere,
} from './item-aggregation.helper';

const MAX_LINES = 2000;
const MAX_DISTINCT_ITEMS = 20;

export type ItemDocType = 'delivery_note' | 'invoice' | 'purchase_order';

export interface AggregateItemArgs {
  itemQuery: string;
  docType?: string;
  groupBy?: string;
  projectId?: string;
  projectName?: string;
  supplierId?: string;
  supplierName?: string;
  dateFrom?: string;
  dateTo?: string;
}

const normalizeDocType = (v?: string): ItemDocType =>
  v === 'invoice' || v === 'purchase_order' ? v : 'delivery_note';

const normalizeGroupBy = (v?: string): ItemGroupBy =>
  v === 'project' || v === 'supplier' || v === 'month' ? v : 'none';

const toDateRange = (from?: string, to?: string) => {
  if (!from && !to) return null;
  return {
    ...(from ? { gte: new Date(`${from.slice(0, 10)}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to.slice(0, 10)}T23:59:59.999Z`) } : {}),
  };
};

@Injectable()
export class ChatItemToolsService {
  private readonly logger = new Logger(ChatItemToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Distinct item descriptions matching a free-text query (disambiguation). */
  async findSuppliedItems(args: AggregateItemArgs, companyId: string) {
    const docType = normalizeDocType(args.docType);
    const { lines } = await this.fetchLines(docType, args, companyId, 1000);
    const byDescription = new Map<
      string,
      { description: string; unit: string | null; lineCount: number }
    >();
    for (const l of lines) {
      const key = l.description.trim();
      const entry = byDescription.get(key) ?? {
        description: key,
        unit: l.unit,
        lineCount: 0,
      };
      entry.lineCount += 1;
      byDescription.set(key, entry);
    }
    const items = [...byDescription.values()]
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, MAX_DISTINCT_ITEMS);
    return { itemQuery: args.itemQuery, docType, count: items.length, items };
  }

  /** Sums quantities + price stats for an item, with optional grouping. */
  async aggregateItemSupply(args: AggregateItemArgs, companyId: string) {
    const docType = normalizeDocType(args.docType);
    const groupBy = normalizeGroupBy(args.groupBy);
    const { lines, truncated } = await this.fetchLines(docType, args, companyId, MAX_LINES);
    const aggregation = aggregateItemLines(lines, groupBy);
    const filters = await this.resolveFilterLabels(args, companyId);
    const sampleDescriptions = [...new Set(lines.map((l) => l.description.trim()))].slice(0, 5);
    return {
      itemQuery: args.itemQuery,
      docType,
      groupBy,
      filters,
      ...aggregation,
      sampleDescriptions,
      truncated,
    };
  }

  private async fetchLines(
    docType: ItemDocType,
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<{ lines: ItemLine[]; truncated: boolean }> {
    const rows =
      docType === 'invoice'
        ? await this.fetchInvoiceLines(args, companyId, limit)
        : docType === 'purchase_order'
          ? await this.fetchPoLines(args, companyId, limit)
          : await this.fetchDeliveryLines(args, companyId, limit);
    return { lines: rows.slice(0, limit), truncated: rows.length > limit };
  }

  private docWhere(
    companyId: string,
    args: AggregateItemArgs,
    dateField: 'deliveryDate' | 'invoiceDate' | 'orderDate',
  ) {
    const dateRange = toDateRange(args.dateFrom, args.dateTo);
    return {
      companyId,
      ...(args.projectId ? { projectId: args.projectId } : {}),
      ...(args.projectName
        ? {
            project: {
              is: { name: { contains: args.projectName, mode: 'insensitive' as const } },
            },
          }
        : {}),
      ...(args.supplierId ? { supplierId: args.supplierId } : {}),
      ...(args.supplierName
        ? {
            OR: [
              { supplierName: { contains: args.supplierName, mode: 'insensitive' as const } },
              {
                supplier: {
                  is: { name: { contains: args.supplierName, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
      ...(dateRange ? { [dateField]: dateRange } : {}),
    };
  }

  private async fetchDeliveryLines(
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.lineItem.findMany({
      where: {
        ...buildDescriptionWhere(args.itemQuery),
        deliveryNote: this.docWhere(companyId, args, 'deliveryDate'),
      },
      select: {
        description: true,
        quantity: true,
        receivedQuantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        deliveryNote: {
          select: {
            id: true,
            noteNumber: true,
            deliveryDate: true,
            supplierName: true,
            supplier: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      // Handwritten corrections (received qty) win over the printed qty.
      quantity: Number(r.receivedQuantity ?? r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      docId: r.deliveryNote.id,
      docNumber: r.deliveryNote.noteNumber,
      docDate: r.deliveryNote.deliveryDate?.toISOString().slice(0, 10) ?? null,
      projectName: r.deliveryNote.project?.name ?? null,
      supplierName: r.deliveryNote.supplier?.name ?? r.deliveryNote.supplierName,
    }));
  }

  private async fetchInvoiceLines(
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.invoiceLineItem.findMany({
      where: {
        ...buildDescriptionWhere(args.itemQuery),
        invoice: this.docWhere(companyId, args, 'invoiceDate'),
      },
      select: {
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            supplierName: true,
            supplier: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      docId: r.invoice.id,
      docNumber: r.invoice.invoiceNumber,
      docDate: r.invoice.invoiceDate?.toISOString().slice(0, 10) ?? null,
      projectName: r.invoice.project?.name ?? null,
      supplierName: r.invoice.supplier?.name ?? r.invoice.supplierName,
    }));
  }

  private async fetchPoLines(
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.pOLineItem.findMany({
      where: {
        ...buildDescriptionWhere(args.itemQuery),
        purchaseOrder: this.docWhere(companyId, args, 'orderDate'),
      },
      select: {
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            orderDate: true,
            supplierName: true,
            supplier: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      docId: r.purchaseOrder.id,
      docNumber: r.purchaseOrder.poNumber,
      docDate: r.purchaseOrder.orderDate?.toISOString().slice(0, 10) ?? null,
      projectName: r.purchaseOrder.project?.name ?? null,
      supplierName: r.purchaseOrder.supplier?.name ?? r.purchaseOrder.supplierName,
    }));
  }

  private async resolveFilterLabels(args: AggregateItemArgs, companyId: string) {
    const [project, supplier] = await Promise.all([
      args.projectId
        ? this.prisma.project.findFirst({
            where: { id: args.projectId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
      args.supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: args.supplierId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      projectName: project?.name ?? args.projectName ?? null,
      supplierName: supplier?.name ?? args.supplierName ?? null,
      dateFrom: args.dateFrom ?? null,
      dateTo: args.dateTo ?? null,
    };
  }
}
```

הערה: אם `npm run lint` יתלונן ש-`pOLineItem` לא קיים על PrismaClient — בדקו ב-`node_modules/.prisma/client/index.d.ts` את שם ה-delegate של `POLineItem` (camelCase של פריזמה: האות הראשונה בלבד מוקטנת, כלומר `pOLineItem`) והתאימו.

- [ ] **Step 2.2: אימות טיפוסים**

Run: `cd apps/api && npm run lint`
Expected: success

---

### Task 3: הצהרות כלים, ניתוב, כרטיס וטיפוסים

**Files:**
- Modify: `apps/api/src/intelligence/chat/chat-tools.definitions.ts`
- Modify: `apps/api/src/intelligence/chat/chat-tools.service.ts`
- Modify: `apps/api/src/intelligence/chat/chat.types.ts`
- Modify: `apps/api/src/intelligence/chat/chat.service.ts`
- Modify: `apps/api/src/intelligence/chat/chat.module.ts`

- [ ] **Step 3.1: הוסיפו את שתי ההצהרות לסוף המערך `CHAT_TOOL_DECLARATIONS`** (לפני הסוגר `];`)

```ts
  {
    name: 'find_supplied_items',
    description:
      'מאתר שמות פריטים כפי שהם מופיעים בשורות המסמכים. השתמש לפני aggregate_item_supply כשאינך בטוח בניסוח המדויק של הפריט, או אם aggregate_item_supply החזיר 0 תוצאות (נסה אז מילות מפתח חלקיות, למשל "מלט" במקום "שקי מלט שחור").',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['itemQuery'],
      properties: {
        itemQuery: {
          type: SchemaType.STRING,
          description: 'מילות מפתח מתיאור הפריט, למשל "מלט שחור".',
        },
        docType: {
          type: SchemaType.STRING,
          description: 'delivery_note (ברירת מחדל) | invoice | purchase_order',
        },
      },
    },
  },
  {
    name: 'aggregate_item_supply',
    description:
      'סוכם כמויות ומחירים של פריט מסוים על פני מסמכים. עונה על: "כמה שקי מלט שחור 25 קילו סופקו בכל הפרויקטים?", "כמה סופקו בפרויקט X בין ינואר למאי 2026?", "כמה סיפק ספק Y ובאיזה מחיר ממוצע?". ברירת המחדל היא תעודות משלוח (אספקה בפועל); למחירים השתמש גם ב-docType=invoice. לפילוח (לפי פרויקט/ספק/חודש) העבר groupBy.',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['itemQuery'],
      properties: {
        itemQuery: {
          type: SchemaType.STRING,
          description:
            'תיאור הפריט, למשל: מלט שחור 25 ק"ג. כל מילה חייבת להופיע בתיאור השורה. אל תכלול מילות יחידה כמו "שקי".',
        },
        docType: {
          type: SchemaType.STRING,
          description: 'delivery_note (ברירת מחדל, כמה סופק) | invoice (כמה חויב + מחירים) | purchase_order (כמה הוזמן)',
        },
        groupBy: {
          type: SchemaType.STRING,
          description: 'פילוח תוצאות: project | supplier | month | none (ברירת מחדל)',
        },
        projectId: { type: SchemaType.STRING, description: 'מזהה פרויקט (מ-list_projects).' },
        projectName: { type: SchemaType.STRING, description: 'לחלופין: שם פרויקט (חיפוש חלקי).' },
        supplierId: { type: SchemaType.STRING, description: 'מזהה ספק (מ-list_suppliers).' },
        supplierName: { type: SchemaType.STRING, description: 'לחלופין: שם ספק (חיפוש חלקי).' },
        dateFrom: { type: SchemaType.STRING, description: 'מתאריך YYYY-MM-DD (לפי תאריך המסמך).' },
        dateTo: { type: SchemaType.STRING, description: 'עד תאריך YYYY-MM-DD.' },
      },
    },
  },
```

- [ ] **Step 3.2: עדכנו את `chat-tools.service.ts`** — הזרקה, scope בקונטקסט, ניתוב:

החליפו את ה-imports, ה-interface וה-constructor בראש הקובץ:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AggregateItemArgs, ChatItemToolsService } from './chat-item-tools.service';

const MAX_ROWS = 50;

export interface ChatToolScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatToolContext {
  companyId: string;
  userId: string;
  scope?: ChatToolScope;
}

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly itemTools: ChatItemToolsService,
  ) {}
```

החליפו את מתודת `execute` כולה ב:

```ts
  /**
   * Single entry point — routes a function call from the LLM to its implementation.
   * Returns a plain JSON-serializable object. Never throws — errors are returned as { error: string }.
   */
  async execute(name: string, args: Record<string, any>, ctx: ChatToolContext): Promise<unknown> {
    try {
      const effectiveArgs = this.withScopeDefaults(name, args, ctx);
      switch (name) {
        case 'list_projects':
          return await this.listProjects(effectiveArgs, ctx);
        case 'get_project_summary':
          return await this.getProjectSummary(effectiveArgs as { projectId: string }, ctx);
        case 'list_suppliers':
          return await this.listSuppliers(effectiveArgs, ctx);
        case 'list_discrepancies':
          return await this.listDiscrepancies(effectiveArgs, ctx);
        case 'get_company_overview':
          return await this.getCompanyOverview(ctx);
        case 'find_supplied_items':
          return await this.itemTools.findSuppliedItems(
            effectiveArgs as AggregateItemArgs,
            ctx.companyId,
          );
        case 'aggregate_item_supply':
          return await this.itemTools.aggregateItemSupply(
            effectiveArgs as AggregateItemArgs,
            ctx.companyId,
          );
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      this.logger.error(`Tool ${name} failed: ${err?.message}`, err?.stack);
      return { error: err?.message ?? 'Tool execution failed' };
    }
  }

  /**
   * UI scope (project/supplier/date filters) becomes the default for filter-
   * aware tools. Explicit args from the model always win.
   */
  private withScopeDefaults(
    name: string,
    args: Record<string, any>,
    ctx: ChatToolContext,
  ): Record<string, any> {
    const scope = ctx.scope;
    if (!scope) return args;
    const SCOPED_TOOLS = new Set([
      'aggregate_item_supply',
      'find_supplied_items',
      'list_discrepancies',
    ]);
    if (!SCOPED_TOOLS.has(name)) return args;
    const defaults: Record<string, any> = {};
    if (scope.projectId) defaults.projectId = scope.projectId;
    if (scope.supplierId) defaults.supplierId = scope.supplierId;
    if (name === 'aggregate_item_supply') {
      if (scope.dateFrom) defaults.dateFrom = scope.dateFrom;
      if (scope.dateTo) defaults.dateTo = scope.dateTo;
    }
    return { ...defaults, ...args };
  }
```

- [ ] **Step 3.3: הוסיפו טיפוסים ל-`chat.types.ts`** — מתחת ל-`DiscrepancyListCardData` והחליפו את ה-union:

```ts
export interface ItemSupplyBreakdownRow {
  key: string;
  label: string;
  totalQuantity: number;
  totalSpend: number;
  documentCount: number;
}

export interface ItemSupplySummaryCardData {
  itemQuery: string;
  docType: string;
  groupBy: string;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  matchedLineCount: number;
  documentCount: number;
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  breakdown: ItemSupplyBreakdownRow[];
  sampleDescriptions: string[];
  truncated: boolean;
}
```

עדכנו את `ChatCardKind` (הוסיפו `| 'item_supply_summary'`) ואת `ChatCard`:

```ts
export type ChatCard =
  | { id: string; kind: 'company_overview'; data: CompanyOverviewCardData }
  | { id: string; kind: 'project_summary'; data: ProjectSummaryCardData }
  | { id: string; kind: 'project_list'; data: ProjectListCardData }
  | { id: string; kind: 'supplier_list'; data: SupplierListCardData }
  | { id: string; kind: 'discrepancy_list'; data: DiscrepancyListCardData }
  | { id: string; kind: 'item_supply_summary'; data: ItemSupplySummaryCardData };
```

כמו כן הוסיפו ל-`chat.types.ts` (ליד ה-DTOs, יידרש ב-Task 4):

```ts
export interface ChatMessageScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

וב-`SendMessageDto` הוסיפו שדה (צריך `IsObject` ב-import מ-class-validator):

```ts
  @IsOptional()
  @IsObject()
  scope?: ChatMessageScope;
```

- [ ] **Step 3.4: עדכנו את `chat.service.ts`** — מיפוי כרטיס + הנחיות עיצוב:

ב-`TOOL_CARD_KINDS` הוסיפו שורה:

```ts
  aggregate_item_supply: 'item_supply_summary',
```

מתחת ל-`TOOL_DISPLAY_GUARDRAILS` הוסיפו:

```ts
// Markdown is rendered client-side; nudge the model to use it + lead with the
// number when answering quantity/price questions.
const FORMATTING_GUIDELINES =
  '\n\nעיצוב תשובות: השתמש ב-Markdown — הדגשות, רשימות וטבלאות קצרות כשמציגים נתונים. ' +
  'בשאלות כמות/מחיר פתח במשפט תשובה ישיר עם המספר המודגש, ואז פירוט קצר. ' +
  'אל תשכפל בטקסט נתונים שכבר מופיעים בכרטיס שצורף.';
```

ובשני המקומות שבונים system prompt (ב-`streamOpenAi` וב-`streamGemini`) החליפו:

```ts
    const systemPrompt = agent.hasTools
      ? agent.systemPrompt + TOOL_DISPLAY_GUARDRAILS + FORMATTING_GUIDELINES
      : agent.systemPrompt + FORMATTING_GUIDELINES;
```

(ב-`streamGemini` זה בתוך `systemInstruction:` — אותו ביטוי.)

- [ ] **Step 3.5: רשמו את ה-provider ב-`chat.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat-tools.service';
import { ChatItemToolsService } from './chat-item-tools.service';
import { AiManagementModule } from '../ai-management/ai-management.module';

@Module({
  imports: [AuthModule, AiManagementModule],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, ChatItemToolsService],
  exports: [ChatService],
})
export class ChatModule {}
```

- [ ] **Step 3.6: אימות**

Run: `cd apps/api && npm run lint && npx vitest run src/intelligence/chat`
Expected: success + כל הבדיקות עוברות

---

### Task 4: תמיכת scope בצד שרת (DTO → controller → service → tools)

**Files:**
- Modify: `apps/api/src/intelligence/chat/chat.controller.ts`
- Modify: `apps/api/src/intelligence/chat/chat.service.ts`

- [ ] **Step 4.1: controller — העבירו scope**: במתודת `stream` החליפו את קריאת השירות:

```ts
    const subscription = this.service
      .streamReply(companyId, userId, id, dto.content, dto.attachmentIds ?? [], dto.scope)
      .subscribe({
```

- [ ] **Step 4.2: chat.service.ts — חתימה + הקשר scope.**

עדכנו import: `import { ChatCard, ChatCardKind, ChatMessageScope, ChatStreamEvent } from './chat.types';` וכן `import { ChatToolContext, ChatToolsService } from './chat-tools.service';`

חתימת `streamReply`:

```ts
  streamReply(
    companyId: string,
    userId: string,
    conversationId: string,
    userContent: string,
    attachmentIds: string[] = [],
    scope?: ChatMessageScope,
  ): Observable<ChatStreamEvent> {
```

בתוך ה-async IIFE, אחרי טעינת ה-settings ולפני יצירת `userMessage`, הוסיפו:

```ts
          const scopeContext = await this.buildScopeContext(companyId, scope);
```

החליפו את קריאת `streamFromProvider`:

```ts
          const tokens = this.streamFromProvider(
            effectiveAgent,
            history,
            scopeContext ? `${userContent}${scopeContext.promptSuffix}` : userContent,
            attachments,
            { companyId, userId, scope: scopeContext?.scope },
          );
```

עדכנו את הטיפוס של פרמטר ה-ctx ב-`streamFromProvider` וב-`streamGemini` מ-`{ companyId: string; userId: string }` ל-`ChatToolContext`.

הוסיפו מתודה פרטית (למשל אחרי `toCard`):

```ts
  /**
   * Turns the UI scope into (a) a prompt suffix so the model knows a filter is
   * active, and (b) a sanitized scope object used as tool-arg defaults. The
   * suffix is NOT persisted — only the raw user text is saved.
   */
  private async buildScopeContext(companyId: string, scope?: ChatMessageScope) {
    if (!scope) return null;
    const clean: ChatMessageScope = {
      ...(typeof scope.projectId === 'string' && scope.projectId
        ? { projectId: scope.projectId }
        : {}),
      ...(typeof scope.supplierId === 'string' && scope.supplierId
        ? { supplierId: scope.supplierId }
        : {}),
      ...(typeof scope.dateFrom === 'string' && scope.dateFrom
        ? { dateFrom: scope.dateFrom }
        : {}),
      ...(typeof scope.dateTo === 'string' && scope.dateTo ? { dateTo: scope.dateTo } : {}),
    };
    if (Object.keys(clean).length === 0) return null;
    const [project, supplier] = await Promise.all([
      clean.projectId
        ? this.prisma.project.findFirst({
            where: { id: clean.projectId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
      clean.supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: clean.supplierId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    const parts = [
      project ? `פרויקט: ${project.name}` : null,
      supplier ? `ספק: ${supplier.name}` : null,
      clean.dateFrom || clean.dateTo
        ? `תאריכים: ${clean.dateFrom ?? '...'} עד ${clean.dateTo ?? 'היום'}`
        : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return {
      scope: clean,
      promptSuffix: `\n\n[סינון פעיל בממשק: ${parts.join(' | ')}. החל אותו בקריאות לכלים, אלא אם המשתמש ביקש מפורשות אחרת.]`,
    };
  }
```

- [ ] **Step 4.3: אימות**

Run: `cd apps/api && npm run lint`
Expected: success

---

### Task 5: אימות backend מלא + הפעלה מחדש של השרת

- [ ] **Step 5.1:** `cd apps/api && npm run lint && npm run test` — הכל עובר
- [ ] **Step 5.2:** `cd apps/api && npm run build` — מצליח
- [ ] **Step 5.3: הפעילו מחדש את השרת** (חובה לפי כללי הפרויקט):

```bash
cd apps/api && npm run stop && nohup npm run start > /tmp/badook-api.log 2>&1 &
sleep 5 && grep -m1 "Nest application successfully started\|listening" /tmp/badook-api.log || tail -20 /tmp/badook-api.log
```

אם המשתמש מריץ את השרת בעצמו ב-watch — בקשו ממנו להפעיל מחדש במקום זאת.

- [ ] **Step 5.4: בדיקת עשן ידנית (אם יש נתונים ב-DB):** התחברו לקבלת token ושלחו שאלה:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<demo-user>","password":"<demo-pass>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
CONV=$(curl -s -X POST http://localhost:3001/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -N -s -X POST "http://localhost:3001/api/chat/conversations/$CONV/messages" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"כמה שקי מלט סופקו סך הכל?"}' | head -40
```

Expected: זרם SSE עם `type":"card"` מסוג `item_supply_summary` (או תשובה הגיונית אם אין נתוני מלט). אם פרטי ההתחברות לא ידועים — דלגו, הבדיקה תיעשה מה-UI ב-Task 10.

---

### Task 6: web — טיפוסים, scope ב-service, רינדור Markdown

**Files:**
- Modify: `apps/web/src/services/chat.service.ts`
- Create: `apps/web/src/components/chat/ChatMarkdown.tsx`
- Modify: `apps/web/src/components/chat/ChatMessageFeed.tsx`

- [ ] **Step 6.1: התקינו תלויות**

Run: `pnpm --filter @budapest/web add react-markdown remark-gfm`
Expected: מותקן בהצלחה

- [ ] **Step 6.2: עדכנו את `apps/web/src/services/chat.service.ts`:**

אחרי `DiscrepancyListCardData` הוסיפו (זהה לטיפוסי ה-api):

```ts
export interface ItemSupplyBreakdownRow {
  key: string;
  label: string;
  totalQuantity: number;
  totalSpend: number;
  documentCount: number;
}

export interface ItemSupplySummaryCardData {
  itemQuery: string;
  docType: string;
  groupBy: string;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  matchedLineCount: number;
  documentCount: number;
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  breakdown: ItemSupplyBreakdownRow[];
  sampleDescriptions: string[];
  truncated: boolean;
}

export interface ChatScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

הוסיפו ל-union של `ChatCard`:

```ts
  | { id: string; kind: 'item_supply_summary'; data: ItemSupplySummaryCardData };
```

עדכנו את חתימת `streamMessage` (פרמטר `scope` אחרי `attachmentIds`) ואת ה-body:

```ts
export const streamMessage = async (
  conversationId: string,
  content: string,
  attachmentIds: string[],
  scope: ChatScope | undefined,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
```

```ts
      body: JSON.stringify({ content, attachmentIds, ...(scope ? { scope } : {}) }),
```

- [ ] **Step 6.3: צרו את `apps/web/src/components/chat/ChatMarkdown.tsx`:**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export const ChatMarkdown = ({ content }: Props) => (
  <div className="px-1 pt-1 text-[15.5px] leading-relaxed text-base-content text-start">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc ps-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ps-5 mb-2 space-y-1">{children}</ol>,
        h1: ({ children }) => <p className="font-bold text-[17px] mb-1.5">{children}</p>,
        h2: ({ children }) => <p className="font-bold text-[16px] mb-1.5">{children}</p>,
        h3: ({ children }) => <p className="font-bold mb-1">{children}</p>,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 rounded-xl border border-base-200">
            <table className="table table-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="text-start text-[12px] text-base-content/60">{children}</th>
        ),
        td: ({ children }) => <td className="text-start tabular-nums">{children}</td>,
        code: ({ children }) => (
          <code className="bg-base-200/70 rounded px-1.5 py-0.5 text-[13px]">{children}</code>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="link link-primary">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
```

- [ ] **Step 6.4: עדכנו את `ChatMessageFeed.tsx`** — הוסיפו import:

```ts
import { ChatMarkdown } from './ChatMarkdown';
```

והחליפו את בלוק תוכן הסוכן (השורות עם `whitespace-pre-wrap` של הודעת ה-assistant):

```tsx
                    {msg.content && <ChatMarkdown content={msg.content} />}
```

(הודעות המשתמש נשארות טקסט פשוט כפי שהן.)

- [ ] **Step 6.5: תקנו את קריאת `streamMessage` ב-store** — ב-`apps/web/src/stores/chat.store.ts` בתוך `sendMessage` עדכנו זמנית (יוחלף ב-Task 8):

```ts
      await streamMessage(
        conversationId,
        trimmed,
        attachmentIds,
        undefined,
        (event) => {
```

- [ ] **Step 6.6: אימות**

Run: `pnpm --filter @budapest/web run lint`
Expected: success

---

### Task 7: כרטיס item_supply_summary + i18n

**Files:**
- Create: `apps/web/src/components/chat/cards/ItemSupplySummaryCard.tsx`
- Create: `apps/web/src/components/chat/cards/ItemSupplyBreakdown.tsx`
- Modify: `apps/web/src/components/chat/cards/ChatCardRenderer.tsx`
- Modify: `apps/web/src/i18n/locales/he/chat.json`, `apps/web/src/i18n/locales/en/chat.json`

- [ ] **Step 7.1: צרו את `ItemSupplyBreakdown.tsx`:**

```tsx
import { useTranslation } from 'react-i18next';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';

interface Props {
  data: ItemSupplySummaryCardData;
}

const TITLE_KEY: Record<string, string> = {
  project: 'cards.itemSupply.breakdownByProject',
  supplier: 'cards.itemSupply.breakdownBySupplier',
  month: 'cards.itemSupply.breakdownByMonth',
};

const MAX_ROWS = 8;

export const ItemSupplyBreakdown = ({ data }: Props) => {
  const { t } = useTranslation('chat');
  const max = Math.max(...data.breakdown.map((r) => r.totalQuantity), 1);
  const titleKey = TITLE_KEY[data.groupBy];

  return (
    <div className="mt-3">
      {titleKey && (
        <p className="text-[11px] text-base-content/50 font-medium mb-1.5">{t(titleKey)}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {data.breakdown.slice(0, MAX_ROWS).map((row) => (
          <div key={row.key} className="relative rounded-lg bg-base-200/40 overflow-hidden">
            <div
              className="absolute inset-y-0 start-0 bg-primary/15"
              style={{ width: `${Math.round((row.totalQuantity / max) * 100)}%` }}
            />
            <div className="relative flex items-center justify-between px-3 py-1.5 gap-2">
              <span className="text-[12px] font-medium text-base-content truncate">
                {row.label}
              </span>
              <span className="text-[12px] font-bold text-base-content tabular-nums shrink-0">
                {row.totalQuantity.toLocaleString('he-IL', { maximumFractionDigits: 2 })}
                {data.dominantUnit ? ` ${data.dominantUnit}` : ''}
                {row.totalSpend > 0 ? ` · ${formatCurrency(row.totalSpend)}` : ''}
              </span>
            </div>
          </div>
        ))}
        {data.breakdown.length > MAX_ROWS && (
          <p className="text-[11px] text-base-content/40">
            {t('cards.more', { count: data.breakdown.length - MAX_ROWS })}
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 7.2: צרו את `ItemSupplySummaryCard.tsx`:**

```tsx
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';
import { ChatCardShell } from './ChatCardShell';
import { CardStatTile } from './CardStatTile';
import { ItemSupplyBreakdown } from './ItemSupplyBreakdown';

interface Props {
  data: ItemSupplySummaryCardData;
  onDismiss: () => void;
}

const qty = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 2 });

export const ItemSupplySummaryCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const main = data.totalsByUnit[0];
  const subtitleParts = [
    data.filters.projectName,
    data.filters.supplierName,
    data.filters.dateFrom || data.filters.dateTo
      ? `${data.filters.dateFrom ?? '…'} – ${data.filters.dateTo ?? '…'}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <ChatCardShell
      title={data.itemQuery}
      subtitle={subtitleParts.length ? subtitleParts.join(' · ') : undefined}
      Icon={Package}
      accent="primary"
      onDismiss={onDismiss}
    >
      {data.matchedLineCount === 0 ? (
        <p className="text-[13px] text-base-content/50">{t('cards.itemSupply.noResults')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CardStatTile
              label={t('cards.itemSupply.totalQuantity')}
              value={main ? qty(main.totalQuantity) : '-'}
              hint={main?.unit}
            />
            <CardStatTile label={t('cards.itemSupply.documents')} value={data.documentCount} />
            <CardStatTile
              label={t('cards.itemSupply.avgPrice')}
              value={
                data.price.avgUnitPrice != null ? formatCurrency(data.price.avgUnitPrice) : '-'
              }
              hint={
                data.price.minUnitPrice != null && data.price.maxUnitPrice != null
                  ? `${formatCurrency(data.price.minUnitPrice)}–${formatCurrency(data.price.maxUnitPrice)}`
                  : undefined
              }
            />
            <CardStatTile
              label={t('cards.itemSupply.totalSpend')}
              value={data.price.totalSpend > 0 ? formatCurrency(data.price.totalSpend) : '-'}
            />
          </div>
          {data.breakdown.length > 0 && <ItemSupplyBreakdown data={data} />}
          {data.truncated && (
            <p className="mt-2 text-[11px] text-warning/80">{t('cards.itemSupply.truncated')}</p>
          )}
        </>
      )}
    </ChatCardShell>
  );
};
```

- [ ] **Step 7.3: עדכנו את `ChatCardRenderer.tsx`** — import + case:

```ts
import { ItemSupplySummaryCard } from './ItemSupplySummaryCard';
```

```tsx
    case 'item_supply_summary':
      return <ItemSupplySummaryCard data={card.data} onDismiss={onDismiss} />;
```

- [ ] **Step 7.4: i18n.** ב-`he/chat.json` בתוך האובייקט `"cards"` הוסיפו:

```json
    "itemSupply": {
      "totalQuantity": "סה\"כ כמות",
      "documents": "מסמכים",
      "avgPrice": "מחיר ממוצע",
      "totalSpend": "סה\"כ עלות",
      "breakdownByProject": "פילוח לפי פרויקט",
      "breakdownBySupplier": "פילוח לפי ספק",
      "breakdownByMonth": "פילוח לפי חודש",
      "noResults": "לא נמצאו שורות פריט תואמות",
      "truncated": "מוצג חלק מהנתונים — צמצמו את החיפוש לתוצאה מדויקת"
    }
```

ב-`en/chat.json` בתוך `"cards"`:

```json
    "itemSupply": {
      "totalQuantity": "Total quantity",
      "documents": "Documents",
      "avgPrice": "Avg. price",
      "totalSpend": "Total spend",
      "breakdownByProject": "By project",
      "breakdownBySupplier": "By supplier",
      "breakdownByMonth": "By month",
      "noResults": "No matching item lines found",
      "truncated": "Partial data shown — narrow the search for exact totals"
    }
```

- [ ] **Step 7.5: אימות**

Run: `pnpm --filter @budapest/web run lint`
Expected: success

---

### Task 8: סרגל פילטרים (ChatScopeBar) + store

**Files:**
- Modify: `apps/web/src/stores/chat.store.ts`
- Create: `apps/web/src/components/chat/ChatScopeBar.tsx`
- Modify: `apps/web/src/components/chat/ChatModal.tsx`
- Modify: `apps/web/src/i18n/locales/he/chat.json`, `apps/web/src/i18n/locales/en/chat.json`

- [ ] **Step 8.1: עדכנו את `chat.store.ts`:**

הוסיפו ל-imports:

```ts
import { format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatScope,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  streamMessage,
  uploadAttachment,
} from '../services/chat.service';
```

הוסיפו טיפוס מעל המחלקה:

```ts
export type ChatScopePeriod = 'all' | 'thisMonth' | 'last3Months' | 'thisYear';
```

הוסיפו שדות אחרי `uploadingAttachment`:

```ts
  scopeProjectId: string | null = null;
  scopeSupplierId: string | null = null;
  scopePeriod: ChatScopePeriod = 'all';
```

הוסיפו מתודות (למשל אחרי `setInput`):

```ts
  setScopeProject(id: string | null) {
    this.scopeProjectId = id;
  }

  setScopeSupplier(id: string | null) {
    this.scopeSupplierId = id;
  }

  setScopePeriod(period: ChatScopePeriod) {
    this.scopePeriod = period;
  }

  clearScope() {
    this.scopeProjectId = null;
    this.scopeSupplierId = null;
    this.scopePeriod = 'all';
  }

  get hasScope(): boolean {
    return !!(this.scopeProjectId || this.scopeSupplierId || this.scopePeriod !== 'all');
  }

  private buildScope(): ChatScope | undefined {
    if (!this.hasScope) return undefined;
    const now = new Date();
    const dateFrom =
      this.scopePeriod === 'thisMonth'
        ? format(startOfMonth(now), 'yyyy-MM-dd')
        : this.scopePeriod === 'last3Months'
          ? format(subMonths(now, 3), 'yyyy-MM-dd')
          : this.scopePeriod === 'thisYear'
            ? format(startOfYear(now), 'yyyy-MM-dd')
            : undefined;
    return {
      ...(this.scopeProjectId ? { projectId: this.scopeProjectId } : {}),
      ...(this.scopeSupplierId ? { supplierId: this.scopeSupplierId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
    };
  }
```

ובתוך `sendMessage` החליפו את ה-`undefined` הזמני מ-Task 6:

```ts
      await streamMessage(
        conversationId,
        trimmed,
        attachmentIds,
        this.buildScope(),
        (event) => {
```

- [ ] **Step 8.2: צרו את `apps/web/src/components/chat/ChatScopeBar.tsx`:**

```tsx
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { ChatScopePeriod } from '../../stores/chat.store';
import { Project, projectsService } from '../../services/projects.service';
import { Supplier, suppliersService } from '../../services/suppliers.service';

const PERIODS: ChatScopePeriod[] = ['all', 'thisMonth', 'last3Months', 'thisYear'];
const PERIOD_KEY: Record<ChatScopePeriod, string> = {
  all: 'scope.periodAll',
  thisMonth: 'scope.thisMonth',
  last3Months: 'scope.last3Months',
  thisYear: 'scope.thisYear',
};

const selectClass =
  'select select-bordered select-xs h-7 min-h-0 rounded-full bg-base-100/80 text-[12px] font-medium max-w-[180px]';

export const ChatScopeBar = observer(() => {
  const { chatStore } = useStores();
  const { t } = useTranslation('chat');
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    void projectsService.getAll().then(setProjects).catch(() => {});
    void suppliersService.getAll().then(setSuppliers).catch(() => {});
  }, []);

  return (
    <div className="w-full max-w-[800px] mx-auto flex flex-wrap items-center gap-2 mb-2 px-1">
      <select
        className={selectClass}
        value={chatStore.scopeProjectId ?? ''}
        onChange={(e) => chatStore.setScopeProject(e.target.value || null)}
      >
        <option value="">{t('scope.allProjects')}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={chatStore.scopeSupplierId ?? ''}
        onChange={(e) => chatStore.setScopeSupplier(e.target.value || null)}
      >
        <option value="">{t('scope.allSuppliers')}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={chatStore.scopePeriod}
        onChange={(e) => chatStore.setScopePeriod(e.target.value as ChatScopePeriod)}
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {t(PERIOD_KEY[p])}
          </option>
        ))}
      </select>
      {chatStore.hasScope && (
        <button
          onClick={() => chatStore.clearScope()}
          className="btn btn-ghost btn-xs rounded-full text-base-content/50 gap-1"
        >
          <X className="w-3 h-3" />
          {t('scope.clear')}
        </button>
      )}
    </div>
  );
});
```

הערה: ודאו שהטיפוס `Project` ב-`projects.service.ts` והטיפוס `Supplier` ב-`suppliers.service.ts` מיוצאים (שניהם קיימים ומיוצאים היום).

- [ ] **Step 8.3: הרכיבו ב-`ChatModal.tsx`** — הוסיפו import:

```ts
import { ChatScopeBar } from './ChatScopeBar';
```

ובתוך ה-div של סרגל הקלט (זה עם `ref={inputBarRef}`), לפני `<ChatInput />`:

```tsx
              <ChatScopeBar />
              <ChatInput />
```

(ה-ResizeObserver הקיים כבר מפצה על הגובה הנוסף של הסרגל.)

- [ ] **Step 8.4: i18n.** ב-`he/chat.json` הוסיפו ברמה העליונה:

```json
  "scope": {
    "allProjects": "כל הפרויקטים",
    "allSuppliers": "כל הספקים",
    "periodAll": "כל הזמן",
    "thisMonth": "החודש",
    "last3Months": "3 חודשים אחרונים",
    "thisYear": "השנה",
    "clear": "נקה סינון"
  }
```

ב-`en/chat.json`:

```json
  "scope": {
    "allProjects": "All projects",
    "allSuppliers": "All suppliers",
    "periodAll": "All time",
    "thisMonth": "This month",
    "last3Months": "Last 3 months",
    "thisYear": "This year",
    "clear": "Clear filters"
  }
```

- [ ] **Step 8.5: אימות**

Run: `pnpm --filter @budapest/web run lint`
Expected: success

---

### Task 9: צ'יפים של שאלות לדוגמה במסך הפתיחה

**Files:**
- Create: `apps/web/src/components/chat/ChatSuggestionChips.tsx`
- Modify: `apps/web/src/components/chat/ChatWelcomeScreen.tsx`
- Modify: שני קבצי ה-i18n

- [ ] **Step 9.1: צרו את `ChatSuggestionChips.tsx`:**

```tsx
import { useTranslation } from 'react-i18next';

interface Props {
  onPick: (prompt: string) => void;
}

const SUGGESTION_KEYS = ['itemTotal', 'itemByProject', 'itemBySupplier'] as const;

export const ChatSuggestionChips = ({ onPick }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      {SUGGESTION_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onPick(t(`suggestions.${key}`))}
          className="btn btn-sm h-auto py-1.5 rounded-full bg-base-200/60 border-base-300 hover:bg-base-200 text-base-content/70 font-medium text-[12.5px]"
        >
          {t(`suggestions.${key}`)}
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 9.2: ב-`ChatWelcomeScreen.tsx`** הוסיפו import ושורה אחרי ה-grid של ה-action cards (לפני סגירת ה-`motion.div`):

```ts
import { ChatSuggestionChips } from './ChatSuggestionChips';
```

```tsx
      <ChatSuggestionChips onPick={onPickAction} />
```

- [ ] **Step 9.3: i18n.** ב-`he/chat.json` ברמה העליונה:

```json
  "suggestions": {
    "itemTotal": "כמה שקי מלט שחור 25 ק\"ג סופקו סה\"כ בכל הפרויקטים?",
    "itemByProject": "כמה שקי מלט סופקו בפרויקט אולם ספורט רעננה בין ינואר למאי 2026?",
    "itemBySupplier": "כמה שקי מלט סיפק ש. דוגמה ובאיזה מחיר ממוצע לשק?"
  }
```

ב-`en/chat.json`:

```json
  "suggestions": {
    "itemTotal": "How many 25kg black cement bags were supplied across all projects?",
    "itemByProject": "How many cement bags were supplied in a given project between January and May 2026?",
    "itemBySupplier": "How many cement bags did a given supplier deliver, and at what average price?"
  }
```

- [ ] **Step 9.4: אימות**

Run: `pnpm --filter @budapest/web run lint`
Expected: success

---

### Task 10: אימות סופי end-to-end

- [ ] **Step 10.1:** `cd apps/api && npm run lint && npm run test && npm run build` — הכל עובר
- [ ] **Step 10.2:** `pnpm --filter @budapest/web run lint && pnpm --filter @budapest/web run build` — הכל עובר
- [ ] **Step 10.3:** ודאו שהשרת רץ עם הקוד החדש (Task 5.3 — הפעלה מחדש אחרי ה-build האחרון)
- [ ] **Step 10.4: בדיקה ידנית ב-UI** (דרך הדפדפן, `pnpm --filter @budapest/web dev`):
  1. פתחו את הצ'אט — מסך הפתיחה מציג את צ'יפי השאלות החדשים.
  2. ודאו שסוכן ברירת המחדל הוא Gemini עם `hasTools=true` (מסך ה-super-admin → Chat Agents); אחרת הכלים לא ייקראו.
  3. שאלו: "כמה שקי מלט שחור 25 ק"ג סופקו סה"כ בכל הפרויקטים?" — מצופה כרטיס `item_supply_summary` + תשובת Markdown עם המספר מודגש.
  4. שאלו עם טווח תאריכים ופרויקט — מצופה שהכרטיס יציג את הפילטרים בכותרת המשנה.
  5. שאלו על ספק + מחיר ("ובאיזה מחיר?") — מצופה מחיר ממוצע/טווח בכרטיס (מבוסס invoice).
  6. בחרו פרויקט בסרגל ה-scope ושאלו "כמה מלט סופק?" — מצופה שהתשובה תסונן לפרויקט הנבחר.
  7. ודאו שטבלת Markdown בתשובה מוצגת מעוצבת ולא כטקסט גולמי.
  8. שיחות ישנות נטענות ונראות תקין (טקסט רגיל דרך ה-Markdown renderer).
- [ ] **Step 10.5:** אם אין עדיין נתוני פריטים ב-DB — הריצו קודם את תוכנית `2026-06-12-demo-rounds-generator.md` ושלחו את המסמכים למערכת, או בדקו על נתונים קיימים.

---

## Self-Review Checklist (למבצע)

- [ ] כל שאלות הדמו של המשתמש נענות: סה"כ בכל הפרויקטים ✓ (aggregate ללא פילטרים), פרויקט+חודשים ✓ (projectName/dateFrom/dateTo), ספק+מחיר ✓ (supplierName + docType=invoice)
- [ ] שום מזהה פנימי (cuid) לא מוצג בכרטיס (filters מכיל שמות בלבד)
- [ ] אין hardcoded strings בקומפוננטות — הכל דרך i18n
- [ ] אין צבעי מותג קשיחים — רק מחלקות theme
- [ ] לא בוצעו commits ללא אישור המשתמש
