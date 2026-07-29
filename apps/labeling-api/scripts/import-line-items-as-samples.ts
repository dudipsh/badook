/**
 * Render synthetic PO images from extracted Excel line items, then upload each
 * as a LABELED sample (image + ground truth) via the /samples/import endpoint.
 *
 * Prerequisites:
 *   1. Run extract-line-items-from-xlsx.py first → produces line-items.json
 *   2. Playwright + chromium installed (already used by training/synthetic)
 *   3. Target labeling-api must have the /samples/import endpoint deployed
 *
 * Usage:
 *   TARGET=local npx tsx apps/labeling-api/scripts/import-line-items-as-samples.ts
 *   TARGET=prod  npx tsx apps/labeling-api/scripts/import-line-items-as-samples.ts
 *
 * Flags via env:
 *   LIMIT=10                  -- only upload first N (smoke test)
 *   START_AT=PO25000050       -- skip until this PO (resume)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initRenderer,
  renderDocument,
  buildLineItemsRows,
  closeRenderer,
  prepareTemplate,
} from '../training/synthetic/template-renderer';

const TARGET = (process.env.TARGET || 'prod').toLowerCase();
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const START_AT = process.env.START_AT;

const TARGETS: Record<string, { url: string; key: string }> = {
  prod: {
    url: process.env.LABELING_API_URL || '',
    key: process.env.LABELING_API_KEY || '',
  },
  local: {
    url: process.env.LABELING_API_URL || 'http://localhost:3002',
    key: process.env.LABELING_API_KEY || 'dev-key',
  },
};

const cfg = TARGETS[TARGET];
if (!cfg) {
  console.error(`Unknown TARGET=${TARGET}`);
  process.exit(1);
}
if (!cfg.url || !cfg.key) {
  console.error(`TARGET=${TARGET} requires LABELING_API_URL and LABELING_API_KEY`);
  process.exit(1);
}

interface LineItem {
  productCode: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface PoDoc {
  poNumber: string;
  supplierName: string;
  projectName: string;
  orderDate: string | null;
  lineItems: LineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'training', 'synthetic', 'templates', 'purchase-order');
const JSON_INPUT = path.resolve(__dirname, 'line-items.json');

const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '';
  return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

const createSeededRng = (seed: number) => {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildTemplateData = (doc: PoDoc): Record<string, string> => ({
  poNumber: doc.poNumber,
  supplierName: doc.supplierName,
  supplierAddress: '',
  supplierPhone: '',
  supplierBusinessId: '',
  customerName: doc.projectName,
  deliveryAddress: '',
  projectName: doc.projectName,
  orderDate: formatDate(doc.orderDate),
  expectedDelivery: '',
  quoteReference: '',
  supplierOrderNumber: '',
  LINE_ITEMS_ROWS: buildLineItemsRows(
    'purchase_order',
    doc.lineItems.map((li) => ({
      productName: li.description,
      productCode: li.productCode || '',
      quantity: li.quantity ?? 0,
      unit: li.unit || 'יח׳',
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
    })) as any,
  ),
  subtotal: formatNumber(doc.subtotal),
  vatAmount: formatNumber(doc.vatAmount),
  totalAmount: formatNumber(doc.totalAmount),
  notes: '',
});

/**
 * Convert our PoDoc into the JSON shape that Gemini is asked to extract for
 * purchase_order documents (matches src/ocr/prompts/purchase-order.md schema).
 */
const buildGroundTruth = (doc: PoDoc): Record<string, unknown> => ({
  poNumber: doc.poNumber,
  supplierName: doc.supplierName,
  customerName: doc.projectName,
  projectName: doc.projectName,
  orderDate: doc.orderDate,
  lineItems: doc.lineItems.map((li) => ({
    productCode: li.productCode,
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    unitPrice: li.unitPrice,
    totalPrice: li.totalPrice,
  })),
  subtotal: doc.subtotal,
  vatAmount: doc.vatAmount,
  totalAmount: doc.totalAmount,
});

const uploadSample = async (
  png: Buffer,
  groundTruth: Record<string, unknown>,
  fileName: string,
): Promise<{ id: string }> => {
  const form = new FormData();
  const blob = new Blob([png], { type: 'image/png' });
  form.append('file', blob, fileName);
  form.append('documentType', 'PURCHASE_ORDER');
  form.append('originalFileName', fileName);
  form.append('groundTruth', JSON.stringify(groundTruth));

  const res = await fetch(`${cfg.url}/samples/import`, {
    method: 'POST',
    headers: { 'x-api-key': cfg.key },
    body: form as any,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upload failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  return res.json() as Promise<{ id: string }>;
};

async function main() {
  if (!fs.existsSync(JSON_INPUT)) {
    console.error(`Missing ${JSON_INPUT}. Run extract-line-items-from-xlsx.py first.`);
    process.exit(1);
  }
  const docs: PoDoc[] = JSON.parse(fs.readFileSync(JSON_INPUT, 'utf8'));
  console.log(`Loaded ${docs.length} POs from ${JSON_INPUT}`);
  console.log(`Target: ${TARGET} (${cfg.url})\n`);

  const templateFiles = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8'));

  if (templateFiles.length === 0) {
    console.error(`No PO templates found in ${TEMPLATES_DIR}`);
    process.exit(1);
  }
  console.log(`Loaded ${templateFiles.length} PO templates`);

  await initRenderer();

  let started = !START_AT;
  let success = 0;
  let failed = 0;
  let processed = 0;

  for (const doc of docs) {
    if (!started) {
      if (doc.poNumber === START_AT) started = true;
      else continue;
    }
    if (processed >= LIMIT) break;
    processed++;

    try {
      const rng = createSeededRng(parseInt(doc.poNumber.replace(/\D/g, ''), 10) || Date.now());
      const tplIdx = Math.floor(rng() * templateFiles.length);
      const html = prepareTemplate(
        templateFiles[tplIdx],
        buildTemplateData(doc),
        'purchase_order',
        rng,
      );
      const png = await renderDocument(html, {});
      const fileName = `import-${doc.poNumber}.png`;
      const result = await uploadSample(png, buildGroundTruth(doc), fileName);
      success++;
      if (success % 10 === 0 || success === 1) {
        console.log(`  [${success}/${docs.length}] ${doc.poNumber} → ${result.id}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAIL ${doc.poNumber}: ${(e as Error).message}`);
    }
  }

  await closeRenderer();
  console.log(`\nDone. uploaded=${success}  failed=${failed}  processed=${processed}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
