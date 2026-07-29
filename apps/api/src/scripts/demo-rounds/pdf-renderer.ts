// apps/api/src/scripts/demo-rounds/pdf-renderer.ts
// Renders a DemoDoc as a supplier-styled Hebrew (RTL) PDF using pdf-lib.
// The rasterizer that turns the page into an image applies bidi itself, so we
// keep Hebrew in logical order and only pre-reverse number/Latin runs inside
// Hebrew lines (see fixForBidi) — this matches how real supplier PDFs render.
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { DemoDoc, DemoDocType } from './types';

const A4: [number, number] = [595, 842];
const MARGIN = 50;

// The image rasterizer (poppler/Quartz) applies the Unicode bidi algorithm
// when it renders the page: Hebrew is reordered right-to-left, and number/
// Latin runs sitting inside Hebrew get flipped too. So for a line that
// contains Hebrew we keep the Hebrew LOGICAL (bidi orders it correctly) and
// PRE-reverse each number/Latin run (bidi then flips it back to LTR). Pure
// non-Hebrew lines (e.g. table cells) keep an LTR base and are left untouched.
const HEB_RE = /[֐-׿]/;
const isHebrew = (ch: string): boolean => HEB_RE.test(ch);
const hasHebrew = (text: string): boolean => HEB_RE.test(text);

const fixForBidi = (text: string): string => {
  if (!hasHebrew(text)) return text;
  let out = '';
  let cur = '';
  let curHeb: boolean | null = null;
  const flush = () => {
    if (!cur) return;
    out += curHeb ? cur : [...cur].reverse().join('');
    cur = '';
  };
  for (const ch of text) {
    const h = isHebrew(ch);
    if (curHeb === null || h === curHeb) {
      cur += ch;
      curHeb = h;
    } else {
      flush();
      cur = ch;
      curHeb = h;
    }
  }
  flush();
  return out;
};

// Known font-file magic numbers — used to skip the corrupted (HTML) Noto
// files committed in the repo and fall through to a usable font.
const FONT_MAGICS = [
  [0x00, 0x01, 0x00, 0x00], // TrueType
  [0x4f, 0x54, 0x54, 0x4f], // 'OTTO' (CFF/OpenType)
  [0x74, 0x72, 0x75, 0x65], // 'true'
  [0x74, 0x74, 0x63, 0x66], // 'ttcf' (collection)
];
const looksLikeFont = (buf: Buffer): boolean =>
  FONT_MAGICS.some((m) => m.every((b, i) => buf[i] === b));

// First readable font with valid magic wins. Arial Unicode (macOS) carries
// Hebrew + Latin + digits in one file; set DEMO_FONT_PATH to override.
const FONT_CANDIDATES = [
  process.env.DEMO_FONT_PATH,
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  path.join(__dirname, '../../domain/purchase-orders/fonts/NotoSansHebrew-Regular.ttf'),
].filter((p): p is string => !!p);

let fontCache: Uint8Array | null = null;
const loadFontBytes = (): Uint8Array => {
  if (fontCache) return fontCache;
  for (const candidate of FONT_CANDIDATES) {
    try {
      const buf = fs.readFileSync(candidate);
      if (looksLikeFont(buf)) {
        fontCache = new Uint8Array(buf);
        return fontCache;
      }
    } catch {
      // unreadable candidate — try the next one
    }
  }
  throw new Error(
    'No usable Hebrew font found. Set DEMO_FONT_PATH to a TTF/OTF with ' +
      'Hebrew + Latin glyphs (e.g. Arial Unicode).',
  );
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
  const fontBytes = loadFontBytes();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // subset:true keeps output small even when the source font is large (e.g.
  // the 23MB Arial Unicode). One weight is reused for regular and bold.
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const bold = font;

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
    const t = fixForBidi(text);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: xRight - w, y: yPos, size, font: f, color });
  };
  const leftText = (text: string, x: number, yPos: number, size: number, f: PDFFont, color = ink) => {
    page.drawText(fixForBidi(text), { x, y: yPos, size, font: f, color });
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
