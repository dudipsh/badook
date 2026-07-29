// apps/api/src/__tests__/demo-rounds-pdf.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../scripts/demo-rounds/catalog';
import { buildRounds } from '../scripts/demo-rounds/rounds-builder';
import { renderDemoDocPdf } from '../scripts/demo-rounds/pdf-renderer';

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
