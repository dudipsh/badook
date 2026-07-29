// ─── Template Renderer ─────────────────────────────────────────
// Renders HTML templates to PNG images using a shared Playwright browser.

import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

import type { DocumentType } from '../../src/ocr/ocr.types';

// ─── Font Embedding ────────────────────────────────────────────

const FONTS_DIR = path.join(__dirname, 'assets', 'fonts');

const fontBase64 = fs.readFileSync(path.join(FONTS_DIR, 'NotoSansHebrew-Regular.ttf')).toString('base64');
const fontBoldBase64 = fs.readFileSync(path.join(FONTS_DIR, 'NotoSansHebrew-Bold.ttf')).toString('base64');

const FONT_FACE_CSS = `
@font-face {
  font-family: 'NotoHebrew';
  src: url(data:font/truetype;base64,${fontBase64}) format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'NotoHebrew';
  src: url(data:font/truetype;base64,${fontBoldBase64}) format('truetype');
  font-weight: 700;
}
`;

// ─── Color Palettes per Document Type ──────────────────────────

const COLOR_PALETTES: Record<DocumentType, string[]> = {
  delivery_note: [
    '#1a5276', '#1b4f72', '#154360', '#1f618d',
    '#2874a6', '#21618c', '#2e86c1', '#1a6e4e',
    '#196f3d', '#1e8449',
  ],
  invoice: [
    '#8B4513', '#7B3F00', '#6B3410', '#5C4033',
    '#8B0000', '#800020', '#722F37', '#654321',
    '#704214', '#795548',
  ],
  purchase_order: [
    '#2c3e50', '#34495e', '#1c2833', '#283747',
    '#1b2631', '#212f3d', '#2e4053', '#273746',
    '#1a252f', '#253342',
  ],
};

const BORDER_STYLES = ['solid', 'double', 'dashed'];

// ─── Browser Singleton ─────────────────────────────────────────

let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;

export async function initRenderer(): Promise<void> {
  if (browser) return;
  browser = await chromium.launch({ headless: true });
  browserContext = await browser.newContext({
    viewport: { width: 794, height: 1123 },
  });
}

export async function closeRenderer(): Promise<void> {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ─── CSS Variable Randomization ────────────────────────────────

function buildCssVariables(
  docType: DocumentType,
  random: () => number,
): string {
  const palette = COLOR_PALETTES[docType];
  const primaryColor = palette[Math.floor(random() * palette.length)];
  const fontSizeBase = 10 + Math.floor(random() * 5); // 10-14
  const borderStyle = BORDER_STYLES[Math.floor(random() * BORDER_STYLES.length)];

  return `
:root {
  --primary-color: ${primaryColor};
  --font-size-base: ${fontSizeBase}px;
  --border-style: ${borderStyle};
}
`;
}

// ─── Placeholder Replacement ───────────────────────────────────

function replacePlaceholders(
  templateHtml: string,
  data: Record<string, string>,
): string {
  let html = templateHtml;

  // Inject font-face CSS
  html = html.replace(/\{\{FONT_FACE_CSS\}\}/g, FONT_FACE_CSS);

  // Replace all data placeholders — null/undefined become empty string
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(placeholder, value ?? '');
  }

  // Sweep remaining unreplaced placeholders (for optional fields)
  html = html.replace(/\{\{[a-zA-Z_]+\}\}/g, '');

  return html;
}

// ─── Render a Single Document ──────────────────────────────────

export async function renderDocument(
  templateHtml: string,
  data: Record<string, string>,
): Promise<Buffer> {
  if (!browserContext) {
    throw new Error('Renderer not initialized — call initRenderer() first');
  }

  const html = replacePlaceholders(templateHtml, data);

  const page = await browserContext.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300); // allow fonts to render
    const buffer = await page.screenshot({ fullPage: true });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

// ─── Batch Render with Concurrency ─────────────────────────────

export async function renderBatch(
  items: Array<{ templateHtml: string; data: Record<string, string> }>,
  concurrency = 4,
): Promise<Buffer[]> {
  const results: Buffer[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await renderDocument(items[i].templateHtml, items[i].data);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

// ─── Line Items Row Builders ───────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface BaseLineItem {
  description: string;
  catalogNumber?: string | null;
  quantity: number;
  unit: string;
  unitPrice?: number | null;
  totalPrice: number;
  discountPercent?: number | null;
  remarks?: string | null;
}

interface DeliveryNoteLineItem extends BaseLineItem {
  handwrittenNotes?: string | null;
}

interface PurchaseOrderLineItem extends BaseLineItem {
  expectedDeliveryDate?: string | null;
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function buildDeliveryNoteRows(items: DeliveryNoteLineItem[]): string {
  return items
    .map(
      (item, i) => `
    <tr style="${i % 2 === 0 ? '' : 'background: #f7f9fc;'}">
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center; font-size:11px; color:#555">${item.catalogNumber || ''}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center">${formatNumber(item.unitPrice)}</td>
      <td style="text-align:center">${item.discountPercent ? item.discountPercent + '%' : ''}</td>
      <td style="text-align:center">${formatNumber(item.totalPrice)}</td>
      <td style="font-size:10px; color:#666">${item.handwrittenNotes || item.remarks || ''}</td>
    </tr>`,
    )
    .join('');
}

export function buildInvoiceRows(items: BaseLineItem[]): string {
  return items
    .map(
      (item, i) => `
    <tr style="${i % 2 === 0 ? '' : 'background: #faf5f0;'}">
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center; font-size:10px; color:#555">${item.catalogNumber || ''}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center">${formatNumber(item.unitPrice)}</td>
      <td style="text-align:center">${item.discountPercent ? item.discountPercent + '%' : ''}</td>
      <td style="text-align:center; font-weight:600">${formatNumber(item.totalPrice)}</td>
    </tr>`,
    )
    .join('');
}

export function buildPurchaseOrderRows(items: PurchaseOrderLineItem[]): string {
  return items
    .map(
      (item, i) => `
    <tr>
      <td style="text-align:center; border-left: 1px solid #999">${i + 1}</td>
      <td style="text-align:center; font-size:10px; border-left: 1px solid #999">${item.catalogNumber || ''}</td>
      <td style="border-left: 1px solid #999">${item.description}</td>
      <td style="text-align:center; border-left: 1px solid #999">${item.quantity}</td>
      <td style="text-align:center; border-left: 1px solid #999">${item.unit}</td>
      <td style="text-align:center; border-left: 1px solid #999">${formatNumber(item.unitPrice)}</td>
      <td style="text-align:center; border-left: 1px solid #999">${item.discountPercent ? item.discountPercent + '%' : ''}</td>
      <td style="text-align:center; border-left: 1px solid #999">${formatNumber(item.totalPrice)}</td>
      <td style="text-align:center; font-size:10px; border-left: 1px solid #999">${item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : ''}</td>
      <td style="font-size:10px">${item.remarks || ''}</td>
    </tr>`,
    )
    .join('');
}

/** Build LINE_ITEMS_ROWS HTML for the given document type and items array. */
export function buildLineItemsRows(
  docType: DocumentType,
  items: Array<Record<string, unknown>>,
): string {
  switch (docType) {
    case 'delivery_note':
      return buildDeliveryNoteRows(items as unknown as DeliveryNoteLineItem[]);
    case 'invoice':
      return buildInvoiceRows(items as unknown as BaseLineItem[]);
    case 'purchase_order':
      return buildPurchaseOrderRows(items as unknown as PurchaseOrderLineItem[]);
    default:
      return '';
  }
}

// ─── Full Template Preparation (placeholder fill + CSS vars) ───

/**
 * Prepare a complete HTML string ready for rendering:
 * 1. Inject font-face CSS
 * 2. Inject randomized CSS variables
 * 3. Replace all data placeholders
 */
export function prepareTemplate(
  templateHtml: string,
  data: Record<string, string>,
  docType: DocumentType,
  random: () => number,
): string {
  const cssVars = buildCssVariables(docType, random);
  let html = templateHtml;

  // Inject CSS vars right after FONT_FACE_CSS or at start of first <style>
  html = html.replace('{{FONT_FACE_CSS}}', FONT_FACE_CSS + '\n' + cssVars);

  // Replace remaining FONT_FACE_CSS occurrences (if any)
  html = html.replace(/\{\{FONT_FACE_CSS\}\}/g, FONT_FACE_CSS);

  // Replace data placeholders
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(placeholder, value ?? '');
  }

  // Clear unreplaced placeholders
  html = html.replace(/\{\{[a-zA-Z_]+\}\}/g, '');

  return html;
}

/**
 * Convenience: prepare template + render to PNG in one call.
 * Uses prepareTemplate internally for CSS variable randomization.
 */
export async function renderPreparedDocument(
  templateHtml: string,
  data: Record<string, string>,
  docType: DocumentType,
  random: () => number,
): Promise<Buffer> {
  const html = prepareTemplate(templateHtml, data, docType, random);

  if (!browserContext) {
    throw new Error('Renderer not initialized — call initRenderer() first');
  }

  const page = await browserContext.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const buffer = await page.screenshot({ fullPage: true });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}
