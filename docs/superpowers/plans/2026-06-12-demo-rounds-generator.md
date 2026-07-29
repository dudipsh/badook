# Demo Rounds Generator — תוכנית מימוש (מחולל סבבים פיקטיביים: הזמנה + תעודות משלוח + חשבונית → ZIP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** סקריפט שמייצר "סבבים" (סבב = הזמנת רכש + תעודת/ות משלוח + חשבונית) כקבצי PDF בעברית שנראים כמו מסמכי ספק אמיתיים, אורז אותם ל-ZIP, ומפיק דף "תשובות צפויות" — כדי שהמשתמש יפרק את ה-ZIP, ישלח את הקבצים במייל למערכת, ויבדוק את צינור הקליטה (OCR → matching) ואת שאלות הדמו בצ'אט.

**Architecture:** קוד עצמאי לחלוטין תחת `apps/api/src/scripts/demo-rounds/` — בלי Prisma, בלי DB, בלי BullMQ. בנאי סבבים דטרמיניסטי (seeded RNG) מפיק 10 סבבים = 10 הזמנות, 13 תעודות משלוח, 10 חשבוניות, כולל תרחישי דמו: אספקה מפוצלת (הזמנה אחת ← 3 תעודות), חוסרים (סופק פחות מהוזמן), וחיוב יתר (חשבונית יקרה מההזמנה). רנדרר PDF מבוסס pdf-lib + פונט Noto Sans Hebrew (כמו `po-pdf-generator.ts` הקיים), עם 3 תבניות עיצוב שונות לספקים שונים. ה-ZIP נארז עם פקודת `zip` של macOS — בלי תלות חדשה.

**Tech Stack:** TypeScript + tsx (קיים), pdf-lib + @pdf-lib/fontkit (קיימים ב-apps/api), vitest (קיים), `zip` CLI.

---

## ⚠️ כללי עבודה מחייבים (הנחיות המשתמש — גוברות על הכל)

1. **אין ליצור git commits** עד שהמשתמש מאשר במפורש. דלגו על צעדי commit.
2. **אין לגעת ב-DB בשום צורה** — הסקריפט מייצר קבצים בלבד. אסור `prisma generate`/`db push`/seed.
3. שם קובץ ה-ZIP חייב לכלול תאריך+שעה (כלל קבוע של המשתמש): `demo-rounds-2026-06-12_14-30.zip`.
4. אחרי כל קובץ חדש: `cd apps/api && npm run lint` חייב לעבור.
5. הערות בקוד: עד 80 תווים לשורה.
6. תוכנית זו אינה מתנגשת עם `2026-06-12-chat-item-analytics.md` (קבצים שונים לגמרי) — אפשר לרוץ במקביל.
7. **כשהמשתמש יספק רשימת מוצרים משלו** — לא משנים את `catalog.ts`; יוצרים קובץ config JSON ומריצים עם `--config` (פורמט בסוף התוכנית).

---

## File Structure

הכל חדש, תחת `apps/api/src/scripts/demo-rounds/`:

- `types.ts` — טיפוסי הדומיין (פריט, ספק, פרויקט, מסמך, סבב, config)
- `rng.ts` — RNG דטרמיניסטי (mulberry32) + עזרי הגרלה
- `catalog.ts` — קונפיגורציית ברירת מחדל: 8 פריטים (כולל מלט שחור 25 ק"ג ופלס קפרו), 5 ספקים (כולל ש. דוגמה), 4 פרויקטים (כולל אולם ספורט רעננה)
- `rounds-builder.ts` — בניית 10 הסבבים לפי תוכנית קבועה + RNG
- `rounds-builder.spec.ts` — בדיקות vitest
- `expected-answers.ts` — חישוב "תשובות צפויות" מהסבבים + רינדור Markdown
- `pdf-renderer.ts` — רינדור PDF בעברית (RTL) עם 3 תבניות ספק
- `pdf-renderer.spec.ts` — בדיקת עשן
- `generate-demo-rounds.ts` — נקודת הכניסה: בנייה → PDFים → manifest → ZIP

---

### Task 1: טיפוסים + RNG

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/types.ts`
- Create: `apps/api/src/scripts/demo-rounds/rng.ts`

- [ ] **Step 1.1: צרו את `types.ts`:**

```ts
// apps/api/src/scripts/demo-rounds/types.ts
// Self-contained demo-document generator types. No Prisma/Nest imports.

export interface DemoItem {
  description: string;
  catalogNumber: string;
  unit: string;
  priceMin: number;
  priceMax: number;
}

export interface SupplierTheme {
  headerColor: [number, number, number]; // rgb 0..1
  accentColor: [number, number, number];
  layout: 'classic' | 'banded' | 'minimal';
}

export interface DemoSupplier {
  name: string;
  businessId: string;
  address: string;
  phone: string;
  docPrefix: string;
  pricesOnDeliveryNote: boolean;
  theme: SupplierTheme;
}

export interface DemoProject {
  name: string;
  address: string;
}

export interface DocLine {
  description: string;
  catalogNumber: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

export type DemoDocType = 'purchase_order' | 'delivery_note' | 'invoice';

export interface DemoDoc {
  type: DemoDocType;
  number: string;
  date: string; // YYYY-MM-DD
  supplier: DemoSupplier;
  project: DemoProject;
  poReference: string | null; // printed on DN/INV so matching links them
  lines: DocLine[];
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  fileName: string;
}

export type RoundScenario = 'clean' | 'split-delivery' | 'shortage' | 'overcharge';

export interface DemoRound {
  index: number;
  scenario: RoundScenario;
  supplier: DemoSupplier;
  project: DemoProject;
  po: DemoDoc;
  deliveryNotes: DemoDoc[];
  invoice: DemoDoc;
}

export interface DemoConfig {
  companyName: string;
  vatRate: number;
  seed: number;
  items: DemoItem[];
  suppliers: DemoSupplier[];
  projects: DemoProject[];
}
```

- [ ] **Step 1.2: צרו את `rng.ts`:**

```ts
// apps/api/src/scripts/demo-rounds/rng.ts
// Deterministic RNG (mulberry32) so reruns with the same seed produce
// identical documents — critical for reproducible demos and tests.

export type Rng = () => number;

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/** Realistic ILS prices — half-shekel steps. */
export const priceBetween = (rng: Rng, min: number, max: number): number =>
  Math.round((min + rng() * (max - min)) * 2) / 2;

export const round2 = (n: number): number => Math.round(n * 100) / 100;
```

- [ ] **Step 1.3: אימות**

Run: `cd apps/api && npm run lint`
Expected: success

---

### Task 2: קטלוג ברירת מחדל

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/catalog.ts`

- [ ] **Step 2.1: צרו את `catalog.ts`:**

```ts
// apps/api/src/scripts/demo-rounds/catalog.ts
import { DemoConfig } from './types';

// companyName should match the company receiving the emails in the target
// environment (cosmetic — intake assigns company by mailbox, not by text).
export const DEFAULT_CONFIG: DemoConfig = {
  companyName: 'חברת בניה לדוגמה',
  vatRate: 0.18,
  seed: 20260612,
  items: [
    { description: 'מלט שחור 25 ק"ג', catalogNumber: 'CEM-25B', unit: 'שק', priceMin: 14, priceMax: 25 },
    { description: 'פלס 80 ס"מ קפרו מגנטי', catalogNumber: 'KAP-985-80', unit: "יח'", priceMin: 140, priceMax: 200 },
    { description: 'ברזל מצולע 12 מ"מ 12 מטר', catalogNumber: 'STL-12-12', unit: 'מוט', priceMin: 38, priceMax: 52 },
    { description: 'בלוק פומיס 20', catalogNumber: 'BLK-P20', unit: "יח'", priceMin: 9, priceMax: 14 },
    { description: 'דבק אריחים C2TE 25 ק"ג', catalogNumber: 'ADH-C2TE', unit: 'שק', priceMin: 28, priceMax: 42 },
    { description: 'רשת ברזל מרותכת 15/15', catalogNumber: 'MSH-1515', unit: "יח'", priceMin: 85, priceMax: 120 },
    { description: 'חול ים שטוף', catalogNumber: 'SND-1M3', unit: 'קוב', priceMin: 95, priceMax: 140 },
    { description: 'דיסק יהלום 230 מ"מ', catalogNumber: 'DSC-230', unit: "יח'", priceMin: 60, priceMax: 110 },
  ],
  suppliers: [
    {
      name: 'ש. דוגמה חומרי בניין בע"מ',
      businessId: '512345678',
      address: "רח' המסגר 12, תל אביב",
      phone: '03-5551234',
      docPrefix: 'SBN',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.13, 0.29, 0.53], accentColor: [0.91, 0.95, 1.0], layout: 'classic' },
    },
    {
      name: 'אלוני שיווק חומרי בניין',
      businessId: '514876543',
      address: 'אזה"ת פולג, נתניה',
      phone: '09-8847711',
      docPrefix: 'ALN',
      pricesOnDeliveryNote: false,
      theme: { headerColor: [0.62, 0.18, 0.16], accentColor: [1.0, 0.94, 0.92], layout: 'banded' },
    },
    {
      name: 'מ.צ. כלי עבודה ובניין',
      businessId: '513219876',
      address: "רח' התעשייה 8, ראש העין",
      phone: '03-9028855',
      docPrefix: 'MTZ',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.16, 0.42, 0.25], accentColor: [0.93, 1.0, 0.94], layout: 'minimal' },
    },
    {
      name: 'טמבור מרכז הבניין רעננה',
      businessId: '511987234',
      address: "רח' אחוזה 102, רעננה",
      phone: '09-7712233',
      docPrefix: 'TMB',
      pricesOnDeliveryNote: false,
      theme: { headerColor: [0.85, 0.49, 0.09], accentColor: [1.0, 0.97, 0.9], layout: 'classic' },
    },
    {
      name: 'בלוק יצהר תעשיות',
      businessId: '515432109',
      address: 'קיבוץ יצהר, עמק חפר',
      phone: '04-6362200',
      docPrefix: 'YTZ',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.35, 0.23, 0.6], accentColor: [0.96, 0.94, 1.0], layout: 'banded' },
    },
  ],
  projects: [
    { name: 'אולם ספורט רעננה', address: "רח' הספורט 1, רעננה" },
    { name: 'מגדלי הים התיכון נתניה', address: "שד' בן גוריון 44, נתניה" },
    { name: 'בית ספר יסודי כפר סבא', address: "רח' החינוך 7, כפר סבא" },
    { name: 'חניון תת-קרקעי הרצליה', address: "רח' סוקולוב 19, הרצליה" },
  ],
};
```

- [ ] **Step 2.2: אימות**

Run: `cd apps/api && npm run lint`
Expected: success

---

### Task 3: בנאי הסבבים (TDD)

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/rounds-builder.spec.ts`
- Create: `apps/api/src/scripts/demo-rounds/rounds-builder.ts`

- [ ] **Step 3.1: כתבו את הבדיקות קודם:**

```ts
// apps/api/src/scripts/demo-rounds/rounds-builder.spec.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './catalog';
import { buildRounds } from './rounds-builder';

const deliveredQty = (round: ReturnType<typeof buildRounds>[number], description: string) =>
  round.deliveryNotes.reduce(
    (sum, dn) => sum + (dn.lines.find((l) => l.description === description)?.quantity ?? 0),
    0,
  );

describe('buildRounds', () => {
  const rounds = buildRounds(DEFAULT_CONFIG);

  it('produces 10 rounds = 10 POs, 13 delivery notes, 10 invoices', () => {
    expect(rounds).toHaveLength(10);
    expect(rounds.reduce((s, r) => s + r.deliveryNotes.length, 0)).toBe(13);
    expect(rounds.every((r) => r.po && r.invoice)).toBe(true);
  });

  it('split-delivery round has 3 DNs whose quantities sum to the PO', () => {
    const round = rounds.find((r) => r.scenario === 'split-delivery')!;
    expect(round.deliveryNotes).toHaveLength(3);
    for (const poLine of round.po.lines) {
      expect(deliveredQty(round, poLine.description)).toBe(poLine.quantity);
    }
  });

  it('shortage round delivers less than ordered on every line', () => {
    const round = rounds.find((r) => r.scenario === 'shortage')!;
    for (const poLine of round.po.lines) {
      expect(deliveredQty(round, poLine.description)).toBeLessThan(poLine.quantity);
    }
  });

  it('overcharge round invoices a higher unit price than the PO', () => {
    const round = rounds.find((r) => r.scenario === 'overcharge')!;
    for (const invLine of round.invoice.lines) {
      const poLine = round.po.lines.find((l) => l.description === invLine.description)!;
      expect(invLine.unitPrice!).toBeGreaterThan(poLine.unitPrice!);
    }
  });

  it('DN and invoice reference the PO number', () => {
    for (const r of rounds) {
      expect(r.po.poReference).toBeNull();
      for (const dn of r.deliveryNotes) expect(dn.poReference).toBe(r.po.number);
      expect(r.invoice.poReference).toBe(r.po.number);
    }
  });

  it('cement spans >=3 suppliers and >=2 projects (demo questions)', () => {
    const cementRounds = rounds.filter((r) =>
      r.po.lines.some((l) => l.description.includes('מלט')),
    );
    expect(new Set(cementRounds.map((r) => r.supplier.name)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(cementRounds.map((r) => r.project.name)).size).toBeGreaterThanOrEqual(2);
  });

  it('Saban supplies cement to Raanana sports hall within Jan-May 2026', () => {
    const match = rounds.filter(
      (r) =>
        r.supplier.name.includes('דוגמה') &&
        r.project.name.includes('אולם ספורט') &&
        r.po.lines.some((l) => l.description.includes('מלט')),
    );
    expect(match.length).toBeGreaterThanOrEqual(2);
  });

  it('all document dates fall within Jan-May 2026', () => {
    for (const r of rounds) {
      for (const doc of [r.po, ...r.deliveryNotes, r.invoice]) {
        expect(doc.date >= '2026-01-01' && doc.date <= '2026-05-31').toBe(true);
      }
    }
  });

  it('totals are consistent (subtotal + VAT = total, lines sum to subtotal)', () => {
    for (const r of rounds) {
      for (const doc of [r.po, r.invoice]) {
        const lineSum = doc.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0);
        expect(doc.subtotal).toBeCloseTo(lineSum, 2);
        expect(doc.totalAmount).toBeCloseTo(doc.subtotal! + doc.vatAmount!, 2);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(buildRounds(DEFAULT_CONFIG))).toBe(JSON.stringify(rounds));
  });

  it('document numbers are unique across the batch', () => {
    const numbers = rounds.flatMap((r) => [
      r.po.number,
      ...r.deliveryNotes.map((d) => d.number),
      r.invoice.number,
    ]);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
```

- [ ] **Step 3.2: הריצו — חייב להיכשל** (המודול לא קיים)

Run: `cd apps/api && npx vitest run src/scripts/demo-rounds/rounds-builder.spec.ts`
Expected: FAIL — Cannot find module './rounds-builder'

- [ ] **Step 3.3: כתבו את `rounds-builder.ts`:**

```ts
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
import { Rng, createRng, intBetween, priceBetween, round2 } from './rng';

export interface RoundPlan {
  scenario: RoundScenario;
  supplierIdx: number;
  projectIdx: number;
  month: number; // 1..5 → Jan..May 2026
  dnCount: number;
  mustIncludeItemIdx?: number[];
}

// 10 rounds → 10 POs, 10 invoices, 13 delivery notes (3+1+1+2+1×6).
// Item 0 (cement) is planted across 3 suppliers and 3 projects so the demo
// questions (total / per-project+dates / per-supplier+price) have rich,
// comparable answers. Supplier 0 = H. Saban, project 0 = Raanana sports hall.
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
];

const DEMO_YEAR = 2026;

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (month: number, day: number) => `${DEMO_YEAR}-${pad2(month)}-${pad2(day)}`;

const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
      description: item.description,
      catalogNumber: item.catalogNumber,
      quantity,
      unit: item.unit,
      unitPrice,
      totalPrice: round2(quantity * unitPrice),
    };
  });

  const poDate = isoDate(plan.month, intBetween(rng, 2, 15));
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
```

- [ ] **Step 3.4: הריצו את הבדיקות — חייבות לעבור**

Run: `cd apps/api && npx vitest run src/scripts/demo-rounds/rounds-builder.spec.ts`
Expected: PASS (11 tests). אם בדיקת התאריכים נכשלת בגלל גלישה מעבר ל-31/5 — הקטינו את טווח יום ההזמנה (`intBetween(rng, 2, 15)` → `2, 12`) או את מרווחי האספקה.

- [ ] **Step 3.5: אימות טיפוסים**

Run: `cd apps/api && npm run lint`
Expected: success

---

### Task 4: תשובות צפויות (cheat-sheet לדמו)

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/expected-answers.ts`
- Modify: `apps/api/src/scripts/demo-rounds/rounds-builder.spec.ts` (בדיקה נוספת)

- [ ] **Step 4.1: צרו את `expected-answers.ts`:**

```ts
// apps/api/src/scripts/demo-rounds/expected-answers.ts
// Computes the answers the AI chat SHOULD give once these documents are
// ingested — the demo presenter's cheat sheet.
import { DemoRound } from './types';

interface SupplierStats {
  quantity: number;
  invoicedAmount: number;
  invoicedQuantity: number;
}

export interface ItemAnswer {
  description: string;
  unit: string;
  totalDelivered: number;
  byProject: Record<string, number>;
  bySupplier: Record<string, SupplierStats>;
  byMonth: Record<string, number>;
}

export const buildExpectedAnswers = (rounds: DemoRound[]): ItemAnswer[] => {
  const items = new Map<string, ItemAnswer>();
  for (const round of rounds) {
    for (const dn of round.deliveryNotes) {
      for (const line of dn.lines) {
        const entry = items.get(line.description) ?? {
          description: line.description,
          unit: line.unit,
          totalDelivered: 0,
          byProject: {},
          bySupplier: {},
          byMonth: {},
        };
        entry.totalDelivered += line.quantity;
        entry.byProject[round.project.name] =
          (entry.byProject[round.project.name] ?? 0) + line.quantity;
        const sup = entry.bySupplier[round.supplier.name] ?? {
          quantity: 0,
          invoicedAmount: 0,
          invoicedQuantity: 0,
        };
        sup.quantity += line.quantity;
        entry.bySupplier[round.supplier.name] = sup;
        const month = dn.date.slice(0, 7);
        entry.byMonth[month] = (entry.byMonth[month] ?? 0) + line.quantity;
        items.set(line.description, entry);
      }
    }
    for (const line of round.invoice.lines) {
      const entry = items.get(line.description);
      if (!entry || line.unitPrice == null) continue;
      const sup = entry.bySupplier[round.supplier.name] ?? {
        quantity: 0,
        invoicedAmount: 0,
        invoicedQuantity: 0,
      };
      sup.invoicedAmount += line.totalPrice ?? line.quantity * line.unitPrice;
      sup.invoicedQuantity += line.quantity;
      entry.bySupplier[round.supplier.name] = sup;
    }
  }
  return [...items.values()].sort((a, b) => b.totalDelivered - a.totalDelivered);
};

export const renderExpectedAnswersMd = (
  answers: ItemAnswer[],
  rounds: DemoRound[],
): string => {
  const out: string[] = ['# תשובות צפויות לדמו (לפי תעודות המשלוח שנוצרו)', ''];
  for (const item of answers) {
    out.push(`## ${item.description}`);
    out.push(`- סה"כ סופק: **${item.totalDelivered} ${item.unit}**`);
    out.push(
      `- לפי פרויקט: ${Object.entries(item.byProject)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}`,
    );
    out.push(
      `- לפי ספק: ${Object.entries(item.bySupplier)
        .map(([k, v]) => {
          const avg =
            v.invoicedQuantity > 0
              ? (v.invoicedAmount / v.invoicedQuantity).toFixed(2)
              : null;
          return `${k}: ${v.quantity}${avg ? ` (מחיר ממוצע בחשבונית: ${avg} ש"ח)` : ''}`;
        })
        .join(' | ')}`,
    );
    out.push(
      `- לפי חודש: ${Object.entries(item.byMonth)
        .sort()
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}`,
    );
    out.push('');
  }
  out.push('## תרחישים מיוחדים');
  for (const round of rounds) {
    const tag = `סבב ${round.index + 1}, ${round.supplier.name}, ${round.project.name}`;
    if (round.scenario === 'split-delivery') {
      out.push(
        `- אספקה מפוצלת (${tag}): הזמנה ${round.po.number} פוצלה ל-${round.deliveryNotes.length} תעודות משלוח`,
      );
    }
    if (round.scenario === 'shortage') {
      for (const poLine of round.po.lines) {
        const delivered = round.deliveryNotes
          .flatMap((d) => d.lines)
          .filter((l) => l.description === poLine.description)
          .reduce((s, l) => s + l.quantity, 0);
        out.push(
          `- חוסר (${tag}): ${poLine.description} — הוזמן ${poLine.quantity}, סופק ${delivered}`,
        );
      }
    }
    if (round.scenario === 'overcharge') {
      for (const invLine of round.invoice.lines) {
        const poLine = round.po.lines.find((l) => l.description === invLine.description);
        if (poLine?.unitPrice != null && invLine.unitPrice! > poLine.unitPrice) {
          out.push(
            `- חיוב יתר (${tag}): ${invLine.description} — בהזמנה ${poLine.unitPrice} ש"ח, בחשבונית ${invLine.unitPrice} ש"ח`,
          );
        }
      }
    }
  }
  return out.join('\n');
};
```

- [ ] **Step 4.2: הוסיפו בדיקה ל-`rounds-builder.spec.ts`** (בסוף ה-describe, עם import של שתי הפונקציות מ-`./expected-answers`):

```ts
  it('expected answers include cement totals and the special scenarios', () => {
    const answers = buildExpectedAnswers(rounds);
    const cement = answers.find((a) => a.description.includes('מלט'))!;
    expect(cement.totalDelivered).toBeGreaterThan(0);
    expect(Object.keys(cement.bySupplier).length).toBeGreaterThanOrEqual(3);
    const md = renderExpectedAnswersMd(answers, rounds);
    expect(md).toContain('חוסר');
    expect(md).toContain('חיוב יתר');
    expect(md).toContain('אספקה מפוצלת');
  });
```

- [ ] **Step 4.3: הריצו**

Run: `cd apps/api && npx vitest run src/scripts/demo-rounds && npm run lint`
Expected: PASS

---

### Task 5: רנדרר PDF בעברית

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/pdf-renderer.ts`
- Create: `apps/api/src/scripts/demo-rounds/pdf-renderer.spec.ts`

- [ ] **Step 5.1: צרו את `pdf-renderer.ts`** (מבוסס על דפוסי ה-RTL של `apps/api/src/domain/purchase-orders/po-pdf-generator.ts`, משתמש באותם קובצי פונט):

```ts
// apps/api/src/scripts/demo-rounds/pdf-renderer.ts
// Renders a DemoDoc as a supplier-styled Hebrew PDF. Reuses the RTL approach
// and the Noto Sans Hebrew fonts of the existing PO PDF generator.
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { DemoDoc, DemoDocType } from './types';

const A4: [number, number] = [595, 842];
const MARGIN = 50;

const HEBREW_RE = /[\u0590-\u05FF]/;
const hasHebrew = (text: string) => HEBREW_RE.test(text);

/** Reverse Hebrew segments for RTL rendering in LTR-only pdf-lib. */
const rtlText = (text: string): string => {
  if (!hasHebrew(text)) return text;
  const segments =
    text.match(/[\u0590-\u05FF\u200F\u200E]+|[^\u0590-\u05FF\u200F\u200E]+/g) || [text];
  return segments
    .map((seg) => (hasHebrew(seg) ? [...seg].reverse().join('') : seg))
    .reverse()
    .join('');
};

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
const loadFonts = () => {
  if (!fontCache) {
    const dir = path.join(__dirname, '../../domain/purchase-orders/fonts');
    fontCache = {
      regular: new Uint8Array(fs.readFileSync(path.join(dir, 'NotoSansHebrew-Regular.ttf'))),
      bold: new Uint8Array(fs.readFileSync(path.join(dir, 'NotoSansHebrew-Bold.ttf'))),
    };
  }
  return fontCache;
};

const DOC_TITLES: Record<DemoDocType, string> = {
  purchase_order: 'הזמנת רכש',
  delivery_note: 'תעודת משלוח',
  invoice: 'חשבונית מס',
};

const formatHebDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const renderDemoDocPdf = async (
  doc: DemoDoc,
  config: { companyName: string; vatRate: number },
): Promise<Buffer> => {
  const fonts = loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fonts.regular);
  const bold = await pdf.embedFont(fonts.bold);

  let page = pdf.addPage(A4);
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  const ink = rgb(0.15, 0.15, 0.15);
  const faded = rgb(0.55, 0.55, 0.55);
  const brand = rgb(...doc.supplier.theme.headerColor);
  const accent = rgb(...doc.supplier.theme.accentColor);

  const rightText = (
    text: string,
    yPos: number,
    size: number,
    f: PDFFont,
    color = ink,
    xRight = width - MARGIN,
  ) => {
    const processed = rtlText(text);
    const w = f.widthOfTextAtSize(processed, size);
    page.drawText(processed, { x: xRight - w, y: yPos, size, font: f, color });
  };
  const leftText = (text: string, x: number, yPos: number, size: number, f: PDFFont, color = ink) => {
    page.drawText(rtlText(text), { x, y: yPos, size, font: f, color });
  };
  const hr = (yPos: number, color = rgb(0.85, 0.85, 0.85), thickness = 0.5) => {
    page.drawLine({
      start: { x: MARGIN, y: yPos },
      end: { x: width - MARGIN, y: yPos },
      thickness,
      color,
    });
  };
  const ensureSpace = (needed: number) => {
    if (y < MARGIN + needed) {
      page = pdf.addPage(A4);
      y = height - MARGIN;
    }
  };

  // ── Supplier header (3 visual variants so suppliers look distinct) ──
  const s = doc.supplier;
  if (s.theme.layout === 'banded') {
    page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: brand });
    const white = rgb(1, 1, 1);
    rightText(s.name, height - 44, 18, bold, white);
    rightText(`ח.פ ${s.businessId} | ${s.address} | טל' ${s.phone}`, height - 66, 9, font, white);
    y = height - 116;
  } else if (s.theme.layout === 'minimal') {
    rightText(s.name, y - 6, 16, bold, brand);
    rightText(`ח.פ ${s.businessId} · ${s.address} · ${s.phone}`, y - 24, 9, font, faded);
    hr(y - 36, brand, 1.2);
    y -= 58;
  } else {
    rightText(s.name, y - 8, 20, bold, brand);
    rightText(s.address, y - 28, 9.5, font, faded);
    rightText(`ח.פ ${s.businessId} | טל' ${s.phone}`, y - 42, 9.5, font, faded);
    y -= 66;
  }

  // ── Title + number + date ──
  rightText(`${DOC_TITLES[doc.type]} מס' ${doc.number}`, y, 14, bold, ink);
  leftText(`תאריך: ${formatHebDate(doc.date)}`, MARGIN, y, 10, font, faded);
  y -= 28;

  // ── Customer + project block ──
  const refLine = doc.poReference != null;
  const boxHeight = refLine ? 58 : 44;
  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight + 12,
    width: width - MARGIN * 2,
    height: boxHeight,
    color: accent,
  });
  rightText(`לכבוד: ${config.companyName}`, y - 2, 10.5, bold, ink, width - MARGIN - 10);
  rightText(
    `אתר: ${doc.project.name} — ${doc.project.address}`,
    y - 17,
    10,
    font,
    ink,
    width - MARGIN - 10,
  );
  if (refLine) {
    rightText(
      `אסמכתא להזמנת רכש: ${doc.poReference}`,
      y - 32,
      10,
      bold,
      ink,
      width - MARGIN - 10,
    );
  }
  y -= boxHeight + 10;

  // ── Items table ──
  const col = { total: MARGIN, price: 125, unit: 195, qty: 250, catalog: 305, descRight: width - MARGIN - 22 };
  rightText('#', y, 8, bold, faded, width - MARGIN);
  rightText('תיאור', y, 8, bold, faded, col.descRight);
  leftText('מק"ט', col.catalog, y, 8, bold, faded);
  leftText('כמות', col.qty, y, 8, bold, faded);
  leftText('יחידה', col.unit, y, 8, bold, faded);
  leftText('מחיר', col.price, y, 8, bold, faded);
  leftText('סה"כ', col.total, y, 8, bold, faded);
  y -= 6;
  hr(y);
  y -= 16;

  for (let i = 0; i < doc.lines.length; i++) {
    ensureSpace(110);
    const line = doc.lines[i];
    rightText(String(i + 1), y, 9, font, ink, width - MARGIN);
    const desc =
      line.description.length > 38 ? `${line.description.slice(0, 38)}…` : line.description;
    rightText(desc, y, 9, font, ink, col.descRight);
    leftText(line.catalogNumber, col.catalog, y, 8.5, font, faded);
    leftText(String(line.quantity), col.qty, y, 9, font, ink);
    leftText(line.unit, col.unit, y, 9, font, ink);
    leftText(line.unitPrice != null ? line.unitPrice.toFixed(2) : '-', col.price, y, 9, font, ink);
    leftText(line.totalPrice != null ? line.totalPrice.toFixed(2) : '-', col.total, y, 9, font, ink);
    y -= 17;
  }

  y -= 4;
  hr(y);
  y -= 18;

  // ── Totals ──
  if (doc.subtotal != null) {
    rightText(`סה"כ לפני מע"מ: ${doc.subtotal.toFixed(2)} ש"ח`, y, 10, font, ink);
    y -= 16;
    if (doc.vatAmount != null) {
      const vatPct = Math.round(config.vatRate * 100);
      rightText(`מע"מ ${vatPct}%: ${doc.vatAmount.toFixed(2)} ש"ח`, y, 10, font, ink);
      y -= 16;
      rightText(`סה"כ לתשלום: ${(doc.totalAmount ?? 0).toFixed(2)} ש"ח`, y, 12, bold, brand);
      y -= 22;
    }
  }

  // ── Delivery-note signature block ──
  if (doc.type === 'delivery_note') {
    ensureSpace(60);
    y -= 10;
    rightText('נתקבל ע"י: ________________', y, 10, font, ink);
    leftText('חתימה: ________________', MARGIN, y, 10, font, ink);
    y -= 18;
  }

  rightText('תודה שקניתם אצלנו', 36, 8, font, faded);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
};
```

- [ ] **Step 5.2: צרו את `pdf-renderer.spec.ts`:**

```ts
// apps/api/src/scripts/demo-rounds/pdf-renderer.spec.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './catalog';
import { buildRounds } from './rounds-builder';
import { renderDemoDocPdf } from './pdf-renderer';

describe('renderDemoDocPdf', () => {
  it('renders every doc type of the split round as a valid PDF', async () => {
    const round = buildRounds(DEFAULT_CONFIG)[0];
    for (const doc of [round.po, ...round.deliveryNotes, round.invoice]) {
      const buffer = await renderDemoDocPdf(doc, DEFAULT_CONFIG);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(5000);
    }
  });

  it('renders all three supplier themes without throwing', async () => {
    const rounds = buildRounds(DEFAULT_CONFIG);
    const layouts = new Set(rounds.map((r) => r.supplier.theme.layout));
    expect(layouts.size).toBe(3);
    for (const r of rounds) {
      await expect(renderDemoDocPdf(r.po, DEFAULT_CONFIG)).resolves.toBeInstanceOf(Buffer);
    }
  });
});
```

- [ ] **Step 5.3: הריצו**

Run: `cd apps/api && npx vitest run src/scripts/demo-rounds && npm run lint`
Expected: PASS

---

### Task 6: סקריפט ראשי + ZIP + הרצה אמיתית

**Files:**
- Create: `apps/api/src/scripts/demo-rounds/generate-demo-rounds.ts`

- [ ] **Step 6.1: צרו את הסקריפט הראשי:**

```ts
// apps/api/src/scripts/demo-rounds/generate-demo-rounds.ts
// Generates fake procurement "rounds" (PO + delivery notes + invoice) as
// supplier-styled PDFs, writes a manifest + expected-answers cheat sheet,
// and zips ONLY the document folders (so the cheat sheet is never emailed
// by mistake).
//
// Usage (from apps/api):
//   npx tsx src/scripts/demo-rounds/generate-demo-rounds.ts \
//     [--out ../../uploads/demo-rounds] [--config ./my-items.json] [--seed 7]
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DEFAULT_CONFIG } from './catalog';
import { buildRounds } from './rounds-builder';
import { buildExpectedAnswers, renderExpectedAnswersMd } from './expected-answers';
import { renderDemoDocPdf } from './pdf-renderer';
import { DemoConfig, DemoDoc } from './types';

const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const loadConfig = (): DemoConfig => {
  let config = DEFAULT_CONFIG;
  const configPath = argValue('--config');
  if (configPath) {
    const overrides = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<DemoConfig>;
    config = { ...DEFAULT_CONFIG, ...overrides };
  }
  const seedArg = argValue('--seed');
  if (seedArg) config = { ...config, seed: Number(seedArg) };
  return config;
};

// User convention: export archives are named by date+time, never random ids.
const timestamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
};

const main = async () => {
  const config = loadConfig();
  const outBase = path.resolve(
    argValue('--out') ?? path.join(__dirname, '../../../../../uploads/demo-rounds'),
  );
  const stamp = timestamp();
  const runDir = path.join(outBase, `demo-rounds-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });

  const rounds = buildRounds(config);

  for (const round of rounds) {
    const dirName = `round-${String(round.index + 1).padStart(2, '0')}-${round.scenario}`;
    const roundDir = path.join(runDir, dirName);
    fs.mkdirSync(roundDir, { recursive: true });
    const docs: DemoDoc[] = [round.po, ...round.deliveryNotes, round.invoice];
    for (const doc of docs) {
      const pdfBuffer = await renderDemoDocPdf(doc, config);
      fs.writeFileSync(path.join(roundDir, doc.fileName), pdfBuffer);
    }
    console.log(
      `✓ ${dirName} — ${docs.length} PDFs (${round.supplier.name} → ${round.project.name})`,
    );
  }

  const answers = buildExpectedAnswers(rounds);
  fs.writeFileSync(
    path.join(runDir, 'manifest.json'),
    JSON.stringify({ seed: config.seed, generatedAt: stamp, rounds }, null, 2),
  );
  fs.writeFileSync(
    path.join(runDir, 'expected-answers.md'),
    renderExpectedAnswersMd(answers, rounds),
  );

  const zipPath = path.join(outBase, `demo-rounds-${stamp}.zip`);
  execSync(`zip -r ${JSON.stringify(zipPath)} round-*`, { cwd: runDir, stdio: 'inherit' });

  console.log(`\nZIP (לשליחה במייל): ${zipPath}`);
  console.log(`Cheat sheet (לא לשלוח!): ${path.join(runDir, 'expected-answers.md')}`);
};

void main();
```

- [ ] **Step 6.2: אימות טיפוסים**

Run: `cd apps/api && npm run lint`
Expected: success

- [ ] **Step 6.3: הריצו את הגנרטור באמת:**

Run: `cd apps/api && npx tsx src/scripts/demo-rounds/generate-demo-rounds.ts`
Expected: 10 שורות `✓ round-XX-...`, נתיב ZIP ונתיב cheat-sheet בסוף.

- [ ] **Step 6.4: בדקו את הפלט:**

```bash
ls ../../uploads/demo-rounds/
unzip -l ../../uploads/demo-rounds/demo-rounds-*.zip | head -25
```

Expected: ה-ZIP מכיל 10 תיקיות `round-*` עם 33 PDFים בסך הכל (10 PO + 13 DN + 10 INV); `manifest.json` ו-`expected-answers.md` **לא** בתוך ה-ZIP.

- [ ] **Step 6.5: בדיקה ויזואלית** — פתחו לפחות 3 קבצים (אחד מכל תבנית עיצוב) וודאו: עברית קריאה ולא הפוכה, טבלת פריטים מיושרת, סכומים ומע"מ נכונים, מספר הזמנה מודפס על תעודות המשלוח והחשבוניות:

```bash
open ../../uploads/demo-rounds/demo-rounds-*/round-01-split-delivery/PO-2026-1000.pdf
open ../../uploads/demo-rounds/demo-rounds-*/round-02-shortage/*.pdf
open ../../uploads/demo-rounds/demo-rounds-*/round-03-overcharge/*.pdf
```

אם העברית יוצאת הפוכה/שבורה — ודאו שהטקסט עובר דרך `rtlText` ושכל ציור טקסט עברי משתמש ב-`rightText`. השוו ל-`po-pdf-generator.ts` שעובד.

- [ ] **Step 6.6: קראו את `expected-answers.md`** וודאו שהוא כולל: סיכום מלט שחור לפי פרויקט/ספק/חודש עם מחיר ממוצע, סיכום פלס קפרו, ושלושת התרחישים (מפוצל/חוסר/חיוב יתר) עם המספרים.

---

### Task 7: סיכום והנחיות שימוש (להעביר למשתמש)

- [ ] **Step 7.1: ודאו אימות סופי:**

Run: `cd apps/api && npm run lint && npm run test`
Expected: הכל עובר (כולל הבדיקות הקיימות בפרויקט)

- [ ] **Step 7.2: כללו בהודעת הסיכום למשתמש את ההנחיות הבאות:**

**איך מריצים:**
```bash
cd apps/api
npx tsx src/scripts/demo-rounds/generate-demo-rounds.ts
```
הפלט: `uploads/demo-rounds/demo-rounds-<תאריך>_<שעה>.zip` + תיקייה עם `expected-answers.md` (דף התשובות למציג — לא לשלוח במייל!).

**לפני שליחת המיילים:** מומלץ לוודא שבמערכת קיימים הפרויקטים בשמות: אולם ספורט רעננה, מגדלי הים התיכון נתניה, בית ספר יסודי כפר סבא, חניון תת-קרקעי הרצליה (או להריץ project backfill אחרי הסריקה) — כדי שהמסמכים ישויכו לפרויקטים ושאלות הצ'אט לפי פרויקט יעבדו.

**סדר שליחה מומלץ:** קודם את ה-PO של כל סבב, אחר כך תעודות המשלוח, ובסוף החשבונית — כך ה-matching מוצא את ההזמנה כשתעודות מגיעות.

**כשתביא רשימת מוצרים משלך:** צור קובץ JSON (למשל `my-items.json`) במבנה הבא והרץ עם `--config`:

```json
{
  "companyName": "שם החברה שלך במערכת",
  "items": [
    {
      "description": "מלט שחור 25 ק\"ג",
      "catalogNumber": "CEM-25B",
      "unit": "שק",
      "priceMin": 14,
      "priceMax": 25
    }
  ]
}
```
כל שדה שלא מופיע ב-JSON נלקח מברירת המחדל (ספקים, פרויקטים, מע"מ). שינוי `--seed` מייצר וריאציה חדשה של כמויות ומחירים.

---

## Self-Review Checklist (למבצע)

- [ ] בדיוק 10 הזמנות, 13 תעודות משלוח, 10 חשבוניות
- [ ] סבב אחד עם הזמנה אחת ← 3 תעודות משלוח ← חשבונית אחת
- [ ] סבב חוסרים: סופק פחות מהוזמן (והחשבונית מחייבת את מה שסופק)
- [ ] סבב חיוב יתר: מחיר יחידה בחשבונית גבוה מההזמנה
- [ ] מלט שחור 25 ק"ג מופיע אצל כמה ספקים, כולל ש. דוגמה באולם ספורט רעננה בין ינואר למאי 2026, במחירי 14–25 ש"ח לשק
- [ ] פלס קפרו מגנטי מופיע ב-2+ סבבים במחירי 140–200 ש"ח
- [ ] על כל תעודת משלוח וחשבונית מודפסת אסמכתת ההזמנה (קריטי ל-matching)
- [ ] שם ה-ZIP בפורמט תאריך+שעה; manifest ו-cheat-sheet מחוץ ל-ZIP
- [ ] לא נגענו ב-DB ולא נוצרו commits
