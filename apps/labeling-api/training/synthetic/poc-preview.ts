/**
 * POC Preview — Generate one sample of each document type
 * to visually verify the synthetic document engine output.
 *
 * Usage: npx tsx poc-preview.ts
 * Output: poc-output/ directory with PNGs + JSON files
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, 'poc-output');
const FONTS_DIR = path.join(__dirname, 'assets', 'fonts');

// ─── Sample Data ────────────────────────────────────────

const sampleDeliveryNote = {
  noteNumber: '193209',
  supplierName: 'ש. דוגמה חומרי בנין בע"מ',
  supplierAddress: 'אזור תעשייה צפוני, חדרה',
  supplierPhone: '04-6323100',
  supplierBusinessId: '511234567',
  customerName: 'אלפא בנייה פרויקטים בע"מ',
  deliveryDate: '2026-03-15',
  deliveryAddress: 'רחוב הברזל 42, תל אביב',
  projectName: 'פרויקט מגדל הים',
  poReference: 'PO-2024-0891',
  orderReference: null,
  lineItems: [
    { description: 'מלט פורטלנד CEM I 52.5N (שק 25 ק"ג)', catalogNumber: 'CM-52500', quantity: 120, unit: 'שק', unitPrice: 28.50, totalPrice: 3420.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, receivedQuantity: 118, handwrittenNotes: 'חסר 2', remarks: null, quantityBreakdown: null },
    { description: 'ברזל בניין Y12 (6 מטר)', catalogNumber: 'BR-Y1206', quantity: 85, unit: 'יח\'', unitPrice: 42.00, totalPrice: 3570.00, discountPercent: 10, discountAmount: 4.20, priceBeforeDiscount: 46.67, receivedQuantity: null, handwrittenNotes: null, remarks: null, quantityBreakdown: null },
    { description: 'בלוק בטון 20×20×40', catalogNumber: 'BL-204020', quantity: 500, unit: 'יח\'', unitPrice: 6.80, totalPrice: 3400.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, receivedQuantity: 500, handwrittenNotes: null, remarks: null, quantityBreakdown: null },
    { description: 'חול בנייה דק 0-2 מ"מ', catalogNumber: null, quantity: 15, unit: 'טון', unitPrice: 95.00, totalPrice: 1425.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, receivedQuantity: null, handwrittenNotes: null, remarks: 'משלוח שני', quantityBreakdown: null },
    { description: 'יריעת ביטומן 4 מ"מ (גליל 10 מ"ר)', catalogNumber: 'WP-BIT04', quantity: 30, unit: 'גליל', unitPrice: 185.00, totalPrice: 5550.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, receivedQuantity: 30, handwrittenNotes: null, remarks: null, quantityBreakdown: null },
    { description: 'רשת פלדה מרותכת Q335', catalogNumber: 'ST-Q335M', quantity: 40, unit: 'יח\'', unitPrice: 126.50, totalPrice: 5060.00, discountPercent: 5, discountAmount: 6.33, priceBeforeDiscount: 133.16, receivedQuantity: null, handwrittenNotes: null, remarks: null, quantityBreakdown: null },
    { description: 'סיקה פלקס 300 (שק 25 ק"ג)', catalogNumber: 'SK-FLX30', quantity: 18, unit: 'שק', unitPrice: 68.00, totalPrice: 1224.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, receivedQuantity: 18, handwrittenNotes: null, remarks: null, quantityBreakdown: null },
  ],
  rejectedItems: [],
  subtotal: 23649.00,
  vatRate: 0.17,
  vatAmount: 4020.33,
  totalAmount: 27669.33,
  notes: 'מוביל: יוסי כהן',
  confidence: 1.0,
  fieldConfidence: {},
};

const sampleInvoice = {
  invoiceNumber: 'INV-78234',
  supplierName: 'מוצרי בניין הדוגמה בע"מ',
  supplierAddress: 'דרך השלום 88, ראשון לציון',
  supplierPhone: '03-9517200',
  supplierBusinessId: '513456789',
  customerName: 'קבוצת יובלים בנייה ופיתוח בע"מ',
  invoiceDate: '2026-03-20',
  dueDate: '2026-05-19',
  poReference: 'PO-2026-1142',
  quoteReference: null,
  deliveryNoteReferences: ['193205', '193209', '193211'],
  lineItems: [
    { description: 'אריחי קרמיקה 60×60 אפור מט', catalogNumber: 'TL-6060GM', quantity: 145, unit: 'מ"ר', unitPrice: 89.90, totalPrice: 13035.50, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null },
    { description: 'דבק אמנטי C2TE (שק 25 ק"ג)', catalogNumber: 'AD-C2TE25', quantity: 48, unit: 'שק', unitPrice: 52.00, totalPrice: 2496.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null },
    { description: 'פרופיל אלומיניום T-20 (2.5 מ\')', catalogNumber: 'PR-ALT20', quantity: 60, unit: 'יח\'', unitPrice: 18.50, totalPrice: 1110.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null },
    { description: 'גבס בורד 12.5 מ"מ (1.20×2.40)', catalogNumber: 'GB-1225ST', quantity: 200, unit: 'לוח', unitPrice: 38.90, totalPrice: 7780.00, discountPercent: 8, discountAmount: 3.38, priceBeforeDiscount: 42.28, remarks: null },
    { description: 'צמר סלעים 50 מ"מ (חבילה)', catalogNumber: 'IN-RW050', quantity: 35, unit: 'חבילה', unitPrice: 124.00, totalPrice: 4340.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null },
    { description: 'שפכטל גמר אקרילי 25 ק"ג', catalogNumber: null, quantity: 12, unit: 'דלי', unitPrice: 156.00, totalPrice: 1872.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null },
  ],
  subtotal: 30633.50,
  vatRate: 0.17,
  vatAmount: 5207.70,
  totalAmount: 35841.20,
  notes: null,
  confidence: 1.0,
  fieldConfidence: {},
};

const samplePurchaseOrder = {
  poNumber: 'PO-2026-0457',
  supplierName: 'טובול מוצרי בנייה בע"מ',
  supplierAddress: 'אזור תעשייה נעמן, עכו',
  supplierPhone: '04-9558800',
  supplierBusinessId: '520987654',
  customerName: 'א.מ.ב בנייה ופיתוח בע"מ',
  deliveryAddress: 'רחוב הגדוד העברי 15, ירושלים',
  projectName: 'שיפוץ בית כנסת מרכזי',
  orderDate: '2026-03-10',
  expectedDelivery: '2026-04-01',
  supplierOrderNumber: null,
  quoteReference: 'Q-2026-312',
  deliveryNoteReferences: null,
  documentSubtype: null,
  lineItems: [
    { description: 'צינור PVC ביוב 110 מ"מ (6 מ\')', catalogNumber: 'PV-110060', quantity: 25, unit: 'יח\'', unitPrice: 78.00, totalPrice: 1950.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null, expectedDeliveryDate: '2026-03-25' },
    { description: 'ברז כדורי 1/2" פליז', catalogNumber: 'VL-BV050', quantity: 40, unit: 'יח\'', unitPrice: 34.50, totalPrice: 1380.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null, expectedDeliveryDate: null },
    { description: 'דוד שמש 150 ליטר + מאסף 2 פנלים', catalogNumber: 'SH-150-2P', quantity: 3, unit: 'יח\'', unitPrice: 4250.00, totalPrice: 12750.00, discountPercent: 5, discountAmount: 223.68, priceBeforeDiscount: 4473.68, remarks: 'כולל התקנה', expectedDeliveryDate: '2026-04-01' },
    { description: 'צינור נחושת 15 מ"מ (בר 5 מ\')', catalogNumber: 'CU-15050', quantity: 20, unit: 'בר', unitPrice: 145.00, totalPrice: 2900.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null, expectedDeliveryDate: null },
    { description: 'חומר איטום סיקה טופ 107 (20 ק"ג)', catalogNumber: 'SK-T10720', quantity: 10, unit: 'דלי', unitPrice: 235.00, totalPrice: 2350.00, discountPercent: null, discountAmount: null, priceBeforeDiscount: null, remarks: null, expectedDeliveryDate: '2026-03-25' },
  ],
  subtotal: 21330.00,
  vatRate: 0.17,
  vatAmount: 3626.10,
  totalAmount: 24956.10,
  notes: 'אספקה לאתר בלבד. לתאם טלפונית יום לפני.',
  confidence: 1.0,
  fieldConfidence: {},
};

// ─── HTML Templates ─────────────────────────────────────

const fontPath = path.join(FONTS_DIR, 'NotoSansHebrew-Regular.ttf');
const fontBoldPath = path.join(FONTS_DIR, 'NotoSansHebrew-Bold.ttf');
const fontBase64 = fs.readFileSync(fontPath).toString('base64');
const fontBoldBase64 = fs.readFileSync(fontBoldPath).toString('base64');

const fontFaceCSS = `
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

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function formatNumber(n: number | null): string {
  if (n === null) return '';
  return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateDeliveryNoteHTML(data: typeof sampleDeliveryNote): string {
  const lineItemsRows = data.lineItems.map((item, i) => `
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
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><style>
${fontFaceCSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'NotoHebrew', sans-serif; font-size: 12px; padding: 30px 40px; width: 794px; min-height: 1123px; background: #fff; color: #1a1a1a; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5276; padding-bottom: 15px; margin-bottom: 20px; }
.supplier-info { flex: 1; }
.supplier-info h1 { font-size: 22px; color: #1a5276; margin-bottom: 4px; }
.supplier-info .detail { font-size: 11px; color: #555; line-height: 1.6; }
.doc-title-box { text-align: center; background: #1a5276; color: white; padding: 8px 25px; border-radius: 4px; }
.doc-title-box h2 { font-size: 18px; margin-bottom: 2px; }
.doc-title-box .doc-num { font-size: 14px; }
.meta-section { display: flex; gap: 30px; margin-bottom: 18px; }
.meta-box { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; }
.meta-box h3 { font-size: 12px; color: #1a5276; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
.meta-box .row { display: flex; justify-content: space-between; font-size: 11px; line-height: 1.8; }
.meta-box .label { color: #666; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
thead th { background: #1a5276; color: white; padding: 7px 5px; font-size: 11px; font-weight: 700; text-align: center; }
tbody td { padding: 6px 5px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
.totals-section { margin-top: 15px; display: flex; justify-content: flex-start; }
.totals-box { border: 1px solid #1a5276; border-radius: 4px; padding: 10px 20px; min-width: 250px; }
.totals-box .row { display: flex; justify-content: space-between; font-size: 12px; line-height: 2; }
.totals-box .total-row { font-weight: 700; font-size: 14px; border-top: 2px solid #1a5276; padding-top: 4px; margin-top: 4px; }
.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="header">
    <div class="supplier-info">
      <h1>${data.supplierName}</h1>
      <div class="detail">${data.supplierAddress || ''}</div>
      <div class="detail">טל: ${data.supplierPhone || ''} | ח.פ: ${data.supplierBusinessId || ''}</div>
    </div>
    <div class="doc-title-box">
      <h2>תעודת משלוח</h2>
      <div class="doc-num">מס' ${data.noteNumber}</div>
    </div>
  </div>

  <div class="meta-section">
    <div class="meta-box">
      <h3>פרטי לקוח</h3>
      <div class="row"><span class="label">לכבוד:</span> <span>${data.customerName}</span></div>
      <div class="row"><span class="label">כתובת אספקה:</span> <span>${data.deliveryAddress || ''}</span></div>
      <div class="row"><span class="label">פרויקט:</span> <span>${data.projectName || ''}</span></div>
    </div>
    <div class="meta-box">
      <h3>פרטי מסמך</h3>
      <div class="row"><span class="label">תאריך:</span> <span>${formatDate(data.deliveryDate!)}</span></div>
      <div class="row"><span class="label">הזמנת רכש:</span> <span>${data.poReference || ''}</span></div>
      <div class="row"><span class="label">מס' הזמנה:</span> <span>${data.orderReference || ''}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">שורה</th>
        <th style="width:75px">מק"ט</th>
        <th>תיאור פריט</th>
        <th style="width:55px">כמות</th>
        <th style="width:45px">יח'</th>
        <th style="width:70px">מחיר יח'</th>
        <th style="width:45px">הנחה</th>
        <th style="width:75px">סה"כ</th>
        <th style="width:70px">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="row"><span>סה"כ לפני מע"מ:</span> <span>₪${formatNumber(data.subtotal)}</span></div>
      <div class="row"><span>מע"מ (17%):</span> <span>₪${formatNumber(data.vatAmount)}</span></div>
      <div class="row total-row"><span>סה"כ לתשלום:</span> <span>₪${formatNumber(data.totalAmount)}</span></div>
    </div>
  </div>

  <div class="footer">
    <span>${data.notes || ''}</span>
    <span>חתימת מקבל: _______________</span>
  </div>
</body>
</html>`;
}

function generateInvoiceHTML(data: typeof sampleInvoice): string {
  const lineItemsRows = data.lineItems.map((item, i) => `
    <tr style="${i % 2 === 0 ? '' : 'background: #faf5f0;'}">
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center; font-size:10px; color:#555">${item.catalogNumber || ''}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center">${formatNumber(item.unitPrice)}</td>
      <td style="text-align:center">${item.discountPercent ? item.discountPercent + '%' : ''}</td>
      <td style="text-align:center; font-weight:600">${formatNumber(item.totalPrice)}</td>
    </tr>
  `).join('');

  const dnRefs = data.deliveryNoteReferences?.join(', ') || '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><style>
${fontFaceCSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'NotoHebrew', sans-serif; font-size: 12px; padding: 30px 40px; width: 794px; min-height: 1123px; background: #fff; color: #1a1a1a; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
.supplier-block { flex: 1; }
.supplier-block h1 { font-size: 20px; color: #8B4513; margin-bottom: 4px; }
.supplier-block .info { font-size: 11px; color: #555; line-height: 1.6; }
.doc-badge { text-align: center; border: 2px solid #8B4513; padding: 10px 20px; }
.doc-badge h2 { font-size: 16px; color: #8B4513; }
.doc-badge .number { font-size: 20px; font-weight: 700; color: #333; }
.divider { height: 2px; background: linear-gradient(to left, #8B4513, #d4a574, #8B4513); margin: 10px 0 18px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px; }
.info-card { border: 1px solid #ddd; padding: 10px 12px; border-radius: 3px; }
.info-card h4 { font-size: 11px; color: #8B4513; margin-bottom: 5px; }
.info-card .field { font-size: 11px; line-height: 1.8; }
.info-card .field-label { color: #777; }
table { width: 100%; border-collapse: collapse; margin-top: 5px; }
thead th { background: #8B4513; color: white; padding: 7px 5px; font-size: 11px; }
tbody td { padding: 6px 5px; border-bottom: 1px solid #e5e0db; font-size: 11px; }
.totals { margin-top: 15px; display: flex; justify-content: flex-start; }
.totals-inner { border: 2px solid #8B4513; padding: 12px 20px; min-width: 280px; }
.totals-inner .line { display: flex; justify-content: space-between; font-size: 12px; line-height: 2; }
.totals-inner .grand { font-size: 15px; font-weight: 700; border-top: 2px solid #8B4513; padding-top: 5px; margin-top: 5px; }
.dn-refs { margin-top: 14px; padding: 8px 12px; background: #faf5f0; border: 1px solid #e5d5c5; font-size: 11px; border-radius: 3px; }
.footer { margin-top: 25px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head>
<body>
  <div class="header">
    <div class="supplier-block">
      <h1>${data.supplierName}</h1>
      <div class="info">${data.supplierAddress}</div>
      <div class="info">טל: ${data.supplierPhone} | ע.מ: ${data.supplierBusinessId}</div>
    </div>
    <div class="doc-badge">
      <h2>חשבונית מס / קבלה</h2>
      <div class="number">${data.invoiceNumber}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-card">
      <h4>לכבוד</h4>
      <div class="field">${data.customerName}</div>
    </div>
    <div class="info-card">
      <h4>פרטי חשבונית</h4>
      <div class="field"><span class="field-label">תאריך:</span> ${formatDate(data.invoiceDate!)}</div>
      <div class="field"><span class="field-label">תאריך פירעון:</span> ${formatDate(data.dueDate!)}</div>
      <div class="field"><span class="field-label">הזמנת רכש:</span> ${data.poReference || '—'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th style="width:75px">מק"ט</th>
        <th>תיאור</th>
        <th style="width:50px">כמות</th>
        <th style="width:45px">יח'</th>
        <th style="width:70px">מחיר יח'</th>
        <th style="width:45px">הנחה</th>
        <th style="width:80px">סכום</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
    </tbody>
  </table>

  ${dnRefs ? `<div class="dn-refs">תעודות משלוח מצורפות: ${dnRefs}</div>` : ''}

  <div class="totals">
    <div class="totals-inner">
      <div class="line"><span>סה"כ:</span> <span>₪${formatNumber(data.subtotal)}</span></div>
      <div class="line"><span>מע"מ 17%:</span> <span>₪${formatNumber(data.vatAmount)}</span></div>
      <div class="line grand"><span>סה"כ לתשלום:</span> <span>₪${formatNumber(data.totalAmount)}</span></div>
    </div>
  </div>

  <div class="footer">מסמך זה הופק ממערכת הנהלת חשבונות — ${data.supplierName}</div>
</body>
</html>`;
}

function generatePurchaseOrderHTML(data: typeof samplePurchaseOrder): string {
  const lineItemsRows = data.lineItems.map((item, i) => `
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
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><style>
${fontFaceCSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'NotoHebrew', sans-serif; font-size: 12px; padding: 30px 40px; width: 794px; min-height: 1123px; background: #fff; color: #1a1a1a; }
.title-bar { background: #2c3e50; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h1 { font-size: 20px; }
.title-bar .po-num { font-size: 16px; background: rgba(255,255,255,0.15); padding: 4px 15px; border-radius: 3px; }
.parties { display: flex; gap: 20px; margin-bottom: 18px; }
.party-box { flex: 1; border: 1px solid #bbb; padding: 12px; }
.party-box h3 { font-size: 12px; color: #2c3e50; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
.party-box .f { font-size: 11px; line-height: 1.7; }
.party-box .lbl { color: #777; }
.order-meta { background: #ecf0f1; padding: 10px 15px; margin-bottom: 15px; display: flex; gap: 40px; font-size: 11px; border-radius: 3px; }
.order-meta .item { }
.order-meta .item .lbl { color: #666; margin-left: 5px; }
table { width: 100%; border-collapse: collapse; border: 1px solid #999; }
thead th { background: #2c3e50; color: white; padding: 6px 4px; font-size: 10px; border-left: 1px solid #4a6278; }
tbody td { padding: 5px 4px; border-bottom: 1px solid #ccc; font-size: 11px; }
tbody tr:hover { background: #f5f5f5; }
.totals-area { margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
.totals-table { border: 1px solid #2c3e50; min-width: 250px; }
.totals-table .r { display: flex; justify-content: space-between; padding: 5px 15px; font-size: 12px; }
.totals-table .r.grand { background: #2c3e50; color: white; font-weight: 700; font-size: 14px; padding: 8px 15px; }
.notes-box { flex: 1; margin-left: 30px; padding: 10px; border: 1px dashed #aaa; font-size: 11px; color: #555; min-height: 60px; }
.signatures { margin-top: 30px; display: flex; justify-content: space-around; }
.sig-line { text-align: center; font-size: 11px; color: #666; }
.sig-line .line { width: 150px; border-bottom: 1px solid #333; margin-bottom: 5px; height: 30px; }
</style></head>
<body>
  <div class="title-bar">
    <h1>הזמנת רכש</h1>
    <div class="po-num">${data.poNumber}</div>
  </div>

  <div class="parties">
    <div class="party-box">
      <h3>מזמין</h3>
      <div class="f"><span class="lbl">שם:</span> ${data.customerName}</div>
      <div class="f"><span class="lbl">כתובת אספקה:</span> ${data.deliveryAddress || ''}</div>
      <div class="f"><span class="lbl">פרויקט:</span> ${data.projectName || ''}</div>
    </div>
    <div class="party-box">
      <h3>ספק</h3>
      <div class="f"><span class="lbl">שם:</span> ${data.supplierName}</div>
      <div class="f"><span class="lbl">כתובת:</span> ${data.supplierAddress || ''}</div>
      <div class="f"><span class="lbl">טל:</span> ${data.supplierPhone || ''} | <span class="lbl">ח.פ:</span> ${data.supplierBusinessId || ''}</div>
    </div>
  </div>

  <div class="order-meta">
    <div class="item"><span class="lbl">תאריך הזמנה:</span> ${formatDate(data.orderDate!)}</div>
    <div class="item"><span class="lbl">אספקה צפויה:</span> ${formatDate(data.expectedDelivery!)}</div>
    <div class="item"><span class="lbl">הפניה להצעת מחיר:</span> ${data.quoteReference || '—'}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:25px">#</th>
        <th style="width:70px">מק"ט</th>
        <th>תיאור פריט</th>
        <th style="width:45px">כמות</th>
        <th style="width:40px">יח'</th>
        <th style="width:65px">מחיר יח'</th>
        <th style="width:40px">הנחה</th>
        <th style="width:70px">סה"כ</th>
        <th style="width:65px">אספקה</th>
        <th style="width:70px">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
    </tbody>
  </table>

  <div class="totals-area">
    <div class="notes-box">
      <strong>הערות:</strong><br>
      ${data.notes || ''}
    </div>
    <div class="totals-table">
      <div class="r"><span>סה"כ:</span> <span>₪${formatNumber(data.subtotal)}</span></div>
      <div class="r"><span>מע"מ 17%:</span> <span>₪${formatNumber(data.vatAmount)}</span></div>
      <div class="r grand"><span>סה"כ:</span> <span>₪${formatNumber(data.totalAmount)}</span></div>
    </div>
  </div>

  <div class="signatures">
    <div class="sig-line"><div class="line"></div>חתימת מזמין</div>
    <div class="sig-line"><div class="line"></div>חתימת ספק</div>
    <div class="sig-line"><div class="line"></div>אישור מנהל</div>
  </div>
</body>
</html>`;
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Launching Playwright...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 794, height: 1123 },
  });

  const documents = [
    {
      name: 'delivery-note',
      html: generateDeliveryNoteHTML(sampleDeliveryNote),
      groundTruth: sampleDeliveryNote,
    },
    {
      name: 'invoice',
      html: generateInvoiceHTML(sampleInvoice),
      groundTruth: sampleInvoice,
    },
    {
      name: 'purchase-order',
      html: generatePurchaseOrderHTML(samplePurchaseOrder),
      groundTruth: samplePurchaseOrder,
    },
  ];

  for (const doc of documents) {
    console.log(`Rendering ${doc.name}...`);
    const page = await context.newPage();
    await page.setContent(doc.html, { waitUntil: 'networkidle' });
    // Wait a bit for fonts
    await page.waitForTimeout(500);

    const imgPath = path.join(OUTPUT_DIR, `${doc.name}.png`);
    await page.screenshot({ path: imgPath, fullPage: true });
    await page.close();

    // Write ground truth JSON
    const gtPath = path.join(OUTPUT_DIR, `${doc.name}-ground-truth.json`);
    fs.writeFileSync(gtPath, JSON.stringify(doc.groundTruth, null, 2));

    // Write HTML for inspection
    const htmlPath = path.join(OUTPUT_DIR, `${doc.name}.html`);
    fs.writeFileSync(htmlPath, doc.html);

    console.log(`  -> ${imgPath}`);
    console.log(`  -> ${gtPath}`);
  }

  await browser.close();
  console.log('\nDone! Check poc-output/ directory.');
}

main().catch(console.error);
