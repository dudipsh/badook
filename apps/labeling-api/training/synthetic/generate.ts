// ─── Synthetic Document Generator — CLI Entry Point ─────────────
//
// Usage:
//   npx tsx generate.ts --count 2000 --seed 42 --output ./output/synthetic-2026-04-08
//
// Flags:
//   --count N             Number of documents (default: 2000)
//   --seed N              Random seed (default: Date.now())
//   --type all|delivery_note|invoice|purchase_order (default: all)
//   --output PATH         Output directory (default: ./output/synthetic-{timestamp})
//   --zip                 Also create a ZIP archive
//   --concurrency N       Parallel render workers (default: 4)
//   --skip-augment        Skip post-processing augmentation
//   --dry-run             Generate data + JSON only, skip rendering

import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

import type { DocumentType } from '../../src/ocr/ocr.types';
import { DataGenerator, type SyntheticDocument } from './data-generator';
import {
  initRenderer,
  renderDocument,
  buildLineItemsRows,
  closeRenderer,
  prepareTemplate,
} from './template-renderer';
import { pickStyleProfile, applyPostProcessing } from './post-processor';
import { writeOutput } from './output-writer';
import { DOC_TYPE_RATIOS } from './config';

// ─── CLI Argument Parsing ───────────────────────────────────────

interface CliArgs {
  count: number;
  seed: number;
  type: 'all' | DocumentType;
  output: string;
  zip: boolean;
  concurrency: number;
  skipAugment: boolean;
  dryRun: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);

  const now = new Date();
  const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 16);
  const defaults: CliArgs = {
    count: 2000,
    seed: Date.now(),
    type: 'all',
    output: `./output/synthetic-${ts}`,
    zip: false,
    concurrency: 4,
    skipAugment: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
        defaults.count = parseInt(args[++i], 10);
        break;
      case '--seed':
        defaults.seed = parseInt(args[++i], 10);
        break;
      case '--type':
        defaults.type = args[++i] as CliArgs['type'];
        break;
      case '--output':
        defaults.output = args[++i];
        break;
      case '--zip':
        defaults.zip = true;
        break;
      case '--concurrency':
        defaults.concurrency = parseInt(args[++i], 10);
        break;
      case '--skip-augment':
        defaults.skipAugment = true;
        break;
      case '--dry-run':
        defaults.dryRun = true;
        break;
    }
  }

  return defaults;
}

// ─── Seeded PRNG (mulberry32) ───────────────────────────────────

const createRng = (seed: number) => {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ─── Template Loading ───────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const TEMPLATE_DIR_MAP: Record<DocumentType, string> = {
  delivery_note: 'delivery-note',
  invoice: 'invoice',
  purchase_order: 'purchase-order',
};

function loadTemplatesForType(docType: DocumentType): string[] {
  const typeDir = TEMPLATE_DIR_MAP[docType];
  const dirPath = path.join(TEMPLATES_DIR, typeDir);
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Template directory not found: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.html'));
  if (files.length === 0) {
    throw new Error(`No HTML templates found in ${dirPath}`);
  }

  return files.map((f) => fs.readFileSync(path.join(dirPath, f), 'utf-8'));
}

// ─── Document ID Generation ─────────────────────────────────────

const DOC_TYPE_PREFIX: Record<DocumentType, string> = {
  delivery_note: 'dn',
  invoice: 'inv',
  purchase_order: 'po',
};

function generateDocId(docType: DocumentType, index: number): string {
  const prefix = DOC_TYPE_PREFIX[docType];
  const num = String(index + 1).padStart(4, '0');
  return `syn_${prefix}_${num}`;
}

// ─── Format Number (Hebrew locale) ──────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ─── Build Template Data Map ────────────────────────────────────

function buildTemplateData(doc: SyntheticDocument): Record<string, string> {
  const data: Record<string, string> = {};

  switch (doc.type) {
    case 'delivery_note': {
      const d = doc.data;
      data['noteNumber'] = d.noteNumber ?? '';
      data['supplierName'] = d.supplierName;
      data['supplierAddress'] = d.supplierAddress ?? '';
      data['supplierPhone'] = d.supplierPhone ?? '';
      data['supplierBusinessId'] = d.supplierBusinessId ?? '';
      data['customerName'] = d.customerName ?? '';
      data['deliveryDate'] = d.deliveryDate ? formatDate(d.deliveryDate) : '';
      data['deliveryAddress'] = d.deliveryAddress ?? '';
      data['projectName'] = d.projectName ?? '';
      data['poReference'] = d.poReference ?? '';
      data['orderReference'] = d.orderReference ?? '';
      data['LINE_ITEMS_ROWS'] = buildLineItemsRows('delivery_note', d.lineItems as any);
      data['subtotal'] = formatNumber(d.subtotal);
      data['vatAmount'] = formatNumber(d.vatAmount);
      data['totalAmount'] = formatNumber(d.totalAmount);
      data['notes'] = d.notes ?? '';
      break;
    }
    case 'invoice': {
      const d = doc.data;
      data['invoiceNumber'] = d.invoiceNumber ?? '';
      data['supplierName'] = d.supplierName;
      data['supplierAddress'] = d.supplierAddress ?? '';
      data['supplierPhone'] = d.supplierPhone ?? '';
      data['supplierBusinessId'] = d.supplierBusinessId ?? '';
      data['customerName'] = d.customerName ?? '';
      data['invoiceDate'] = d.invoiceDate ? formatDate(d.invoiceDate) : '';
      data['dueDate'] = d.dueDate ? formatDate(d.dueDate) : '';
      data['poReference'] = d.poReference ?? '';
      data['quoteReference'] = d.quoteReference ?? '';
      data['deliveryNoteReferences'] = d.deliveryNoteReferences?.join(', ') ?? '';
      data['LINE_ITEMS_ROWS'] = buildLineItemsRows('invoice', d.lineItems as any);
      data['subtotal'] = formatNumber(d.subtotal);
      data['vatAmount'] = formatNumber(d.vatAmount);
      data['totalAmount'] = formatNumber(d.totalAmount);
      data['notes'] = d.notes ?? '';
      break;
    }
    case 'purchase_order': {
      const d = doc.data;
      data['poNumber'] = d.poNumber ?? '';
      data['supplierName'] = d.supplierName;
      data['supplierAddress'] = d.supplierAddress ?? '';
      data['supplierPhone'] = d.supplierPhone ?? '';
      data['supplierBusinessId'] = d.supplierBusinessId ?? '';
      data['customerName'] = d.customerName ?? '';
      data['deliveryAddress'] = d.deliveryAddress ?? '';
      data['projectName'] = d.projectName ?? '';
      data['orderDate'] = d.orderDate ? formatDate(d.orderDate) : '';
      data['expectedDelivery'] = d.expectedDelivery ? formatDate(d.expectedDelivery) : '';
      data['quoteReference'] = d.quoteReference ?? '';
      data['supplierOrderNumber'] = d.supplierOrderNumber ?? '';
      data['LINE_ITEMS_ROWS'] = buildLineItemsRows('purchase_order', d.lineItems as any);
      data['subtotal'] = formatNumber(d.subtotal);
      data['vatAmount'] = formatNumber(d.vatAmount);
      data['totalAmount'] = formatNumber(d.totalAmount);
      data['notes'] = d.notes ?? '';
      break;
    }
  }

  return data;
}

// ─── ZIP Creation ───────────────────────────────────────────────

function createZip(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver.default('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// ─── Concurrent Worker Pool ─────────────────────────────────────

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIdx = 0;

  async function runWorker() {
    while (nextIdx < items.length) {
      const i = nextIdx++;
      results[i] = await worker(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);

  return results;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = parseCliArgs();
  const outputDir = path.resolve(args.output);

  console.log('=== Synthetic Document Generator ===');
  console.log(`  Count:        ${args.count}`);
  console.log(`  Seed:         ${args.seed}`);
  console.log(`  Type:         ${args.type}`);
  console.log(`  Output:       ${outputDir}`);
  console.log(`  Concurrency:  ${args.concurrency}`);
  console.log(`  Skip augment: ${args.skipAugment}`);
  console.log(`  Dry run:      ${args.dryRun}`);
  console.log(`  Create ZIP:   ${args.zip}`);
  console.log('');

  // Step 1: Init DataGenerator and load ref data from DB
  console.log('[1/7] Initializing data generator...');
  const generator = new DataGenerator();
  await generator.init();

  // Step 2: Generate all document data objects
  console.log('[2/7] Generating document data...');
  let documents: SyntheticDocument[];

  if (args.type === 'all') {
    // Generate proportionally using configured ratios, then trim/pad to args.count
    const totalRatio = Object.values(DOC_TYPE_RATIOS).reduce((a, b) => a + b, 0);
    const allDocs: SyntheticDocument[] = [];
    let seedOffset = 0;

    const docTypes: DocumentType[] = ['delivery_note', 'invoice', 'purchase_order'];
    for (const docType of docTypes) {
      const typeCount = Math.round((DOC_TYPE_RATIOS[docType] / totalRatio) * args.count);
      for (let i = 0; i < typeCount; i++) {
        allDocs.push(generator.generateOne(args.seed + seedOffset, docType));
        seedOffset++;
      }
    }

    // Adjust to exact count (rounding may cause +/- 1)
    while (allDocs.length > args.count) allDocs.pop();
    while (allDocs.length < args.count) {
      allDocs.push(generator.generateOne(args.seed + seedOffset));
      seedOffset++;
    }

    documents = allDocs;
  } else {
    documents = [];
    for (let i = 0; i < args.count; i++) {
      documents.push(generator.generateOne(args.seed + i, args.type));
    }
  }

  console.log(`  Generated ${documents.length} document data objects`);

  // Count per type for per-type indexing
  const typeCounters: Record<string, number> = {};
  const documentIds = documents.map((doc) => {
    typeCounters[doc.type] = (typeCounters[doc.type] || 0);
    const id = generateDocId(doc.type as DocumentType, typeCounters[doc.type]);
    typeCounters[doc.type]++;
    return id;
  });

  // Load templates
  console.log('[3/7] Loading templates...');
  const templateCache: Record<string, string[]> = {};
  const docTypes: DocumentType[] = ['delivery_note', 'invoice', 'purchase_order'];
  for (const dt of docTypes) {
    const dirName = TEMPLATE_DIR_MAP[dt];
    const dirPath = path.join(TEMPLATES_DIR, dirName);
    if (fs.existsSync(dirPath)) {
      templateCache[dt] = loadTemplatesForType(dt);
      console.log(`  ${dt}: ${templateCache[dt].length} templates`);
    }
  }

  if (args.dryRun) {
    // Dry run: write output with placeholder 1x1 white PNG
    console.log('[DRY RUN] Skipping rendering — writing data only...');
    const placeholderPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    );

    const outputDocs = documents.map((doc, i) => {
      const rng = createRng(args.seed + i + 100000);
      const styleProfile = pickStyleProfile(rng);
      return {
        id: documentIds[i],
        docType: doc.type,
        groundTruth: doc.data,
        imageBuffer: placeholderPng,
        styleProfile,
      };
    });

    await writeOutput(outputDir, outputDocs);
    await generator.dispose();

    console.log('\n[DRY RUN] Complete. Data written, no images rendered.');
    printSummary(documents, documentIds);
    return;
  }

  // Step 3: Init Playwright renderer
  console.log('[4/7] Initializing renderer...');
  await initRenderer();

  // Step 4: Render and post-process each document
  console.log(`[5/7] Rendering ${documents.length} documents (concurrency: ${args.concurrency})...`);

  const outputDocs = await processWithConcurrency(
    documents,
    args.concurrency,
    async (doc, i) => {
      const docId = documentIds[i];
      const rng = createRng(args.seed + i + 100000);

      // Pick a random template for this document type
      const templates = templateCache[doc.type];
      if (!templates || templates.length === 0) {
        throw new Error(`No templates loaded for type: ${doc.type}`);
      }
      const templateIdx = Math.floor(rng() * templates.length);
      const templateHtml = templates[templateIdx];

      // Build template data
      const templateData = buildTemplateData(doc);

      // Render HTML to PNG using prepareTemplate for CSS variable randomization
      const html = prepareTemplate(templateHtml, templateData, doc.type as DocumentType, rng);
      let imageBuffer = await renderDocument(html, {});

      // Pick style profile and apply post-processing
      const styleProfile = pickStyleProfile(rng);
      if (!args.skipAugment) {
        imageBuffer = await applyPostProcessing(imageBuffer, styleProfile, rng);
      }

      // Progress indicator
      if ((i + 1) % 50 === 0 || i === 0 || i === documents.length - 1) {
        process.stdout.write(`\r  Generating ${i + 1}/${documents.length}...`);
      }

      return {
        id: docId,
        docType: doc.type,
        groundTruth: doc.data,
        imageBuffer,
        styleProfile,
      };
    },
  );

  process.stdout.write('\n');

  // Step 5: Close renderer
  console.log('[6/7] Closing renderer...');
  await closeRenderer();

  // Step 6: Write output
  console.log('[7/7] Writing output...');
  await writeOutput(outputDir, outputDocs);

  // Optionally create ZIP
  if (args.zip) {
    const zipPath = `${outputDir}.zip`;
    console.log(`\nCreating ZIP: ${zipPath}`);
    await createZip(outputDir, zipPath);
    console.log('  ZIP created.');
  }

  await generator.dispose();

  // Summary
  printSummary(documents, documentIds);
}

function printSummary(
  documents: SyntheticDocument[],
  documentIds: string[],
) {
  const byType: Record<string, number> = {};
  for (const doc of documents) {
    byType[doc.type] = (byType[doc.type] || 0) + 1;
  }

  console.log('\n=== Summary ===');
  console.log(`  Total documents: ${documents.length}`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type}: ${count}`);
  }
  console.log(`  First ID: ${documentIds[0]}`);
  console.log(`  Last ID:  ${documentIds[documentIds.length - 1]}`);
  console.log('  Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
