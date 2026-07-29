// apps/api/src/__tests__/demo-rounds-builder.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../scripts/demo-rounds/catalog';
import { buildRounds } from '../scripts/demo-rounds/rounds-builder';
import {
  buildExpectedAnswers,
  renderExpectedAnswersMd,
} from '../scripts/demo-rounds/expected-answers';

const deliveredQty = (round: ReturnType<typeof buildRounds>[number], description: string) =>
  round.deliveryNotes.reduce(
    (sum, dn) => sum + (dn.lines.find((l) => l.description === description)?.quantity ?? 0),
    0,
  );

describe('buildRounds', () => {
  const rounds = buildRounds(DEFAULT_CONFIG);

  it('produces 12 rounds = 12 POs, 15 delivery notes, 12 invoices', () => {
    expect(rounds).toHaveLength(12);
    expect(rounds.reduce((s, r) => s + r.deliveryNotes.length, 0)).toBe(15);
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
      r.po.lines.some((l) => l.catalogNumber === 'CEM-25B'),
    );
    expect(new Set(cementRounds.map((r) => r.supplier.name)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(cementRounds.map((r) => r.project.name)).size).toBeGreaterThanOrEqual(2);
  });

  it('supplier 0 supplies cement to Raanana sports hall within Jan-May 2026', () => {
    const match = rounds.filter(
      (r) =>
        r.supplier.name.includes('דוגמה') &&
        r.project.name.includes('אולם ספורט') &&
        r.po.lines.some((l) => l.catalogNumber === 'CEM-25B'),
    );
    expect(match.length).toBeGreaterThanOrEqual(2);
  });

  it('same product surfaces under multiple supplier names, incl. שק מלט', () => {
    const cementNames = new Set(
      rounds
        .flatMap((r) => [r.po, ...r.deliveryNotes, r.invoice])
        .flatMap((d) => d.lines)
        .filter((l) => l.catalogNumber === 'CEM-25B')
        .map((l) => l.description),
    );
    expect(cementNames.size).toBeGreaterThanOrEqual(2);
    expect([...cementNames]).toContain('שק מלט 25 ק"ג');
  });

  it('a supplier always uses the SAME name for a product across its docs', () => {
    for (const r of rounds) {
      for (const doc of [r.po, ...r.deliveryNotes, r.invoice]) {
        for (const line of doc.lines) {
          const poLine = r.po.lines.find((l) => l.catalogNumber === line.catalogNumber)!;
          expect(line.description).toBe(poLine.description);
        }
      }
    }
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

  it('expected answers include cement totals and the special scenarios', () => {
    const answers = buildExpectedAnswers(rounds, DEFAULT_CONFIG.items);
    const cement = answers.find((a) => a.catalogNumber === 'CEM-25B')!;
    expect(cement.totalDelivered).toBeGreaterThan(0);
    expect(Object.keys(cement.bySupplier).length).toBeGreaterThanOrEqual(3);
    expect(cement.aliasesSeen.length).toBeGreaterThanOrEqual(2);
    const md = renderExpectedAnswersMd(answers, rounds);
    expect(md).toContain('חוסר');
    expect(md).toContain('חיוב יתר');
    expect(md).toContain('אספקה מפוצלת');
  });
});
