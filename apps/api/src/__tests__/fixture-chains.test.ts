import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildLineItem } from '../domain/projects/build-line-item';
import { buildPO, buildDN, buildInvoice, buildMatch, resetIds } from './helpers/mock-data-builder';
import type { ParsedPurchaseOrder, ParsedDeliveryNote, ParsedInvoice } from '../intelligence/ocr/ocr.types';

const FIXTURES_ROOT = path.resolve(__dirname, '../../test-fixtures/chains');

interface TestAssertions {
  lineItems?: Array<{
    description: string;
    orderedQty: number;
    receivedQty: number;
    invoicedAmount?: number;
    deliveryStatus: 'full' | 'partial' | 'over' | 'none';
    invoicedStatus?: 'matched' | 'mismatch' | 'pending' | 'service';
  }>;
  match?: {
    hasDiscrepancies: boolean;
    documentCount: { pos: number; dns: number; invoices: number };
  };
}

const discoverCases = (): Array<{ id: string; name: string; mocksDir: string; assertionsPath: string }> => {
  if (!fs.existsSync(FIXTURES_ROOT)) return [];

  return fs
    .readdirSync(FIXTURES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const casePath = path.join(FIXTURES_ROOT, d.name);
      const metaPath = path.join(casePath, 'meta.json');
      const mocksDir = path.join(casePath, 'mocks');
      const assertionsPath = path.join(casePath, 'expected', 'assertions.json');

      if (!fs.existsSync(metaPath)) return null;
      if (!fs.existsSync(mocksDir) || !fs.existsSync(assertionsPath)) return null;

      // Check that mocks actually exist
      const mockFiles = fs.readdirSync(mocksDir).filter((f) => f.endsWith('.json'));
      if (mockFiles.length === 0) return null;

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return { id: meta.id || d.name, name: meta.name || d.name, mocksDir, assertionsPath };
    })
    .filter(Boolean) as Array<{ id: string; name: string; mocksDir: string; assertionsPath: string }>;
};

const loadMocks = (mocksDir: string) => {
  const files = fs.readdirSync(mocksDir).filter((f) => f.endsWith('.json') && f !== 'matches.json');
  const pos: ParsedPurchaseOrder[] = [];
  const dns: ParsedDeliveryNote[] = [];
  const invoices: ParsedInvoice[] = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(mocksDir, file), 'utf-8'));
    if (file.startsWith('po-')) pos.push(data);
    else if (file.startsWith('dn-')) dns.push(data);
    else if (file.startsWith('inv-')) invoices.push(data);
  }

  // Load match pairings if available
  const matchesPath = path.join(mocksDir, 'matches.json');
  const matchData = fs.existsSync(matchesPath)
    ? JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
    : null;

  return { pos, dns, invoices, matchData };
};

describe('fixture-driven chain tests', () => {
  const cases = discoverCases();

  if (cases.length === 0) {
    it.skip('no fixture cases with mocks and assertions found', () => {});
    return;
  }

  for (const tc of cases) {
    describe(tc.name, () => {
      it('line item assertions pass', () => {
        resetIds();

        const { pos: parsedPOs, dns: parsedDNs, invoices: parsedInvs, matchData } = loadMocks(tc.mocksDir);
        const expected: TestAssertions = JSON.parse(fs.readFileSync(tc.assertionsPath, 'utf-8'));

        if (!expected.lineItems || expected.lineItems.length === 0) return;
        if (parsedPOs.length === 0) return;

        const po = buildPO(parsedPOs[0]);
        const dns = parsedDNs.map((d) => buildDN(d));
        const invs = parsedInvs.map((i) => buildInvoice(i));

        // Build pairings from match data or auto-generate simple index-based pairings
        const pairings = matchData?.[0]?.lineItemPairings ||
          po.lineItems.map((_, i) => ({
            po: { index: i, description: po.lineItems[i].description },
            dn: dns[0]?.lineItems[i]
              ? { index: i, description: dns[0].lineItems[i].description, quantity: dns[0].lineItems[i].quantity }
              : undefined,
            inv: invs[0]?.lineItems[i]
              ? { index: i, description: invs[0].lineItems[i].description, quantity: invs[0].lineItems[i].quantity }
              : undefined,
          }));

        const match = {
          id: 'test-match',
          purchaseOrderId: po.id,
          deliveryNotes: dns,
          invoices: invs,
          status: 'PARTIAL',
          discrepancies: [],
          lineItemPairings: pairings,
        };

        for (const expectedItem of expected.lineItems) {
          const lineItem = po.lineItems.find((li) =>
            li.description?.includes(expectedItem.description),
          );

          if (!lineItem) {
            throw new Error(`Line item not found: "${expectedItem.description}"`);
          }

          const actual = buildLineItem(po, lineItem, match, pairings);

          expect(actual.orderedQty).toBe(expectedItem.orderedQty);
          expect(actual.receivedQty).toBe(expectedItem.receivedQty);
          expect(actual.deliveryStatus).toBe(expectedItem.deliveryStatus);

          if (expectedItem.invoicedStatus) {
            expect(actual.invoicedStatus).toBe(expectedItem.invoicedStatus);
          }
          if (expectedItem.invoicedAmount != null) {
            expect(actual.invoicedAmount).toBe(expectedItem.invoicedAmount);
          }
        }
      });
    });
  }
});
