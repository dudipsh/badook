// apps/api/src/scripts/demo-rounds/expected-answers.ts
// Computes the answers the AI chat SHOULD give once these documents are
// ingested — the demo presenter's cheat sheet. Grouped by catalog number so
// the same product collapses into one row even when suppliers name it
// differently (the aliasing scenario).
import { DemoItem, DemoRound } from './types';

interface SupplierStats {
  quantity: number;
  invoicedAmount: number;
  invoicedQuantity: number;
}

export interface ItemAnswer {
  catalogNumber: string;
  description: string; // canonical product name
  unit: string;
  totalDelivered: number;
  byProject: Record<string, number>;
  bySupplier: Record<string, SupplierStats>;
  byMonth: Record<string, number>;
  aliasesSeen: string[]; // distinct names suppliers actually printed
}

export const buildExpectedAnswers = (
  rounds: DemoRound[],
  catalogItems: DemoItem[] = [],
): ItemAnswer[] => {
  const canonical = new Map(catalogItems.map((i) => [i.catalogNumber, i.description]));
  const items = new Map<string, ItemAnswer>();
  const aliasSets = new Map<string, Set<string>>();

  const ensure = (catalogNumber: string, description: string, unit: string): ItemAnswer => {
    const entry =
      items.get(catalogNumber) ?? {
        catalogNumber,
        description: canonical.get(catalogNumber) ?? description,
        unit,
        totalDelivered: 0,
        byProject: {},
        bySupplier: {},
        byMonth: {},
        aliasesSeen: [],
      };
    items.set(catalogNumber, entry);
    return entry;
  };

  for (const round of rounds) {
    for (const dn of round.deliveryNotes) {
      for (const line of dn.lines) {
        const entry = ensure(line.catalogNumber, line.description, line.unit);
        const aliases = aliasSets.get(line.catalogNumber) ?? new Set<string>();
        aliases.add(line.description);
        aliasSets.set(line.catalogNumber, aliases);
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
      }
    }
    for (const line of round.invoice.lines) {
      const entry = items.get(line.catalogNumber);
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

  for (const [catalogNumber, entry] of items) {
    entry.aliasesSeen = [...(aliasSets.get(catalogNumber) ?? new Set())];
  }
  return [...items.values()].sort((a, b) => b.totalDelivered - a.totalDelivered);
};

export const renderExpectedAnswersMd = (
  answers: ItemAnswer[],
  rounds: DemoRound[],
): string => {
  const out: string[] = ['# תשובות צפויות לדמו (לפי תעודות המשלוח שנוצרו)', ''];
  for (const item of answers) {
    out.push(`## ${item.description} (מק"ט ${item.catalogNumber})`);
    out.push(`- סה"כ סופק: **${item.totalDelivered} ${item.unit}**`);
    if (item.aliasesSeen.length > 1) {
      out.push(`- שמות אצל ספקים (זיהוי כפול צפוי): ${item.aliasesSeen.join(' | ')}`);
    }
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
