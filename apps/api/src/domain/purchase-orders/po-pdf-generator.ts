import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, PDFFont, Color } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

interface POPdfData {
  poNumber: string;
  supplierName: string;
  orderDate?: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  vendorAddress?: string;
  vatNumber?: string;
  siteContact?: string;
  sitePhone?: string;
  deliveryNotes?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    catalogNumber?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
    discountPercent?: number;
  }>;
  companyName?: string;
}

const HEBREW_RE = /[\u0590-\u05FF]/;
const hasHebrew = (text: string) => HEBREW_RE.test(text);

/** Reverse Hebrew text for RTL rendering in LTR-only pdf-lib */
const rtlText = (text: string): string => {
  if (!hasHebrew(text)) return text;
  // Split into Hebrew and non-Hebrew segments, reverse Hebrew segments
  const segments = text.match(/[\u0590-\u05FF\u200F\u200E]+|[^\u0590-\u05FF\u200F\u200E]+/g) || [text];
  return segments.map((seg) => (hasHebrew(seg) ? [...seg].reverse().join('') : seg)).reverse().join('');
};

@Injectable()
export class PoPdfGenerator {
  private fontRegularBytes: Uint8Array | null = null;
  private fontBoldBytes: Uint8Array | null = null;

  private loadFonts() {
    if (!this.fontRegularBytes) {
      const fontsDir = path.join(__dirname, 'fonts');
      this.fontRegularBytes = new Uint8Array(fs.readFileSync(path.join(fontsDir, 'NotoSansHebrew-Regular.ttf')));
      this.fontBoldBytes = new Uint8Array(fs.readFileSync(path.join(fontsDir, 'NotoSansHebrew-Bold.ttf')));
    }
  }

  async generate(data: POPdfData): Promise<Buffer> {
    this.loadFonts();

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const font = await doc.embedFont(this.fontRegularBytes!);
    const fontBold = await doc.embedFont(this.fontBoldBytes!);

    let page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - margin * 2;
    let y = height - margin;
    const lineHeight = 18;
    const darkGray = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const headerBlue = rgb(0.2, 0.35, 0.65);

    const drawText = (text: string, x: number, yPos: number, size = 10, f: PDFFont = font, color: Color = darkGray) => {
      const processed = rtlText(text);
      if (hasHebrew(text)) {
        // Right-align Hebrew text
        const textWidth = f.widthOfTextAtSize(processed, size);
        page.drawText(processed, { x: width - margin - textWidth, y: yPos, size, font: f, color });
      } else {
        page.drawText(processed, { x, y: yPos, size, font: f, color });
      }
    };

    const drawLabelValue = (label: string, value: string, x: number, yPos: number, labelSize = 9, valueSize = 10) => {
      if (hasHebrew(value)) {
        // RTL: value on right, label on left
        const processedVal = rtlText(value);
        const valWidth = font.widthOfTextAtSize(processedVal, valueSize);
        page.drawText(processedVal, { x: width - margin - valWidth, y: yPos, size: valueSize, font, color: darkGray });
        const processedLabel = rtlText(label);
        const labelWidth = font.widthOfTextAtSize(processedLabel, labelSize);
        page.drawText(processedLabel, { x: width - margin - valWidth - labelWidth - 8, y: yPos, size: labelSize, font, color: lightGray });
      } else {
        page.drawText(`${label}:`, { x, y: yPos, size: labelSize, font, color: lightGray });
        page.drawText(value, { x: x + 120, y: yPos, size: valueSize, font, color: darkGray });
      }
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
    };

    const ensureSpace = (needed: number) => {
      if (y < margin + needed) {
        page = doc.addPage([595, 842]);
        y = height - margin;
      }
    };

    // Detect if content is primarily Hebrew
    const isHebrew = hasHebrew(data.supplierName);
    const title = isHebrew ? 'הזמנת רכש' : 'Purchase Order';

    // ── Header ──
    const titleText = rtlText(title);
    if (isHebrew) {
      const titleWidth = fontBold.widthOfTextAtSize(titleText, 20);
      page.drawText(titleText, { x: width - margin - titleWidth, y, size: 20, font: fontBold, color: headerBlue });
      y -= 8;
      const poWidth = font.widthOfTextAtSize(data.poNumber, 12);
      page.drawText(data.poNumber, { x: width - margin - poWidth, y, size: 12, font, color: lightGray });
    } else {
      page.drawText(titleText, { x: margin, y, size: 20, font: fontBold, color: headerBlue });
      y -= 8;
      page.drawText(data.poNumber, { x: margin, y, size: 12, font, color: lightGray });
    }
    y -= lineHeight * 2;

    // ── Company & Supplier info ──
    const fromLabel = isHebrew ? 'מאת' : 'From';
    const toLabel = isHebrew ? 'אל' : 'To';

    if (data.companyName) {
      drawLabelValue(`${fromLabel}:`, data.companyName, margin, y, 8, 10);
      y -= lineHeight;
    }

    drawLabelValue(`${toLabel}:`, data.supplierName, margin, y, 8, 10);
    y -= lineHeight;

    if (data.vendorAddress) {
      drawText(data.vendorAddress, margin + 35, y, 9, font, lightGray);
      y -= lineHeight;
    }
    if (data.vatNumber) {
      const vatLabel = isHebrew ? `ע.מ: ${data.vatNumber}` : `VAT: ${data.vatNumber}`;
      drawText(vatLabel, margin + 35, y, 9, font, lightGray);
      y -= lineHeight;
    }

    y -= 8;
    drawLine(y);
    y -= lineHeight;

    // ── Order details ──
    const details: [string, string][] = [];
    if (data.orderDate) details.push([isHebrew ? 'תאריך' : 'Date', data.orderDate]);
    if (data.expectedDelivery) details.push([isHebrew ? 'תאריך אספקה' : 'Expected Delivery', data.expectedDelivery]);
    if (data.paymentTerms) details.push([isHebrew ? 'תנאי תשלום' : 'Payment Terms', data.paymentTerms]);

    for (const [label, value] of details) {
      drawLabelValue(label, value, margin, y);
      y -= lineHeight;
    }

    if (details.length > 0) {
      y -= 8;
      drawLine(y);
      y -= lineHeight;
    }

    // ── Line items table ──
    if (data.lineItems && data.lineItems.length > 0) {
      const headers = isHebrew
        ? { num: '#', desc: 'תיאור', qty: 'כמות', unit: 'יחידה', price: 'מחיר', total: 'סה"כ' }
        : { num: '#', desc: 'Description', qty: 'Qty', unit: 'Unit', price: 'Price', total: 'Total' };

      const colX = { num: margin, desc: margin + 30, qty: 320, unit: 370, price: 410, total: 480 };

      // Table headers
      page.drawText(headers.num, { x: colX.num, y, size: 8, font: fontBold, color: lightGray });
      const descHeader = rtlText(headers.desc);
      page.drawText(descHeader, { x: colX.desc, y, size: 8, font: fontBold, color: lightGray });
      page.drawText(rtlText(headers.qty), { x: colX.qty, y, size: 8, font: fontBold, color: lightGray });
      page.drawText(rtlText(headers.unit), { x: colX.unit, y, size: 8, font: fontBold, color: lightGray });
      page.drawText(rtlText(headers.price), { x: colX.price, y, size: 8, font: fontBold, color: lightGray });
      page.drawText(rtlText(headers.total), { x: colX.total, y, size: 8, font: fontBold, color: lightGray });
      y -= 6;
      drawLine(y);
      y -= lineHeight;

      for (let i = 0; i < data.lineItems.length; i++) {
        ensureSpace(60);

        const item = data.lineItems[i];
        const lineTotal = item.totalPrice ?? (item.quantity * (item.unitPrice ?? 0));

        page.drawText(String(i + 1), { x: colX.num, y, size: 9, font, color: darkGray });

        const desc = item.description.length > 35 ? item.description.slice(0, 35) + '...' : item.description;
        const processedDesc = rtlText(desc);
        page.drawText(processedDesc, { x: colX.desc, y, size: 9, font, color: darkGray });

        page.drawText(String(item.quantity), { x: colX.qty, y, size: 9, font, color: darkGray });
        page.drawText(rtlText(item.unit || '-'), { x: colX.unit, y, size: 9, font, color: darkGray });
        page.drawText(item.unitPrice != null ? item.unitPrice.toFixed(2) : '-', { x: colX.price, y, size: 9, font, color: darkGray });
        page.drawText(lineTotal > 0 ? lineTotal.toFixed(2) : '-', { x: colX.total, y, size: 9, font, color: darkGray });

        if (item.discountPercent && item.discountPercent > 0) {
          y -= 12;
          const discountLabel = isHebrew ? `הנחה: ${item.discountPercent}%` : `Discount: ${item.discountPercent}%`;
          page.drawText(rtlText(discountLabel), { x: colX.desc, y, size: 7, font, color: lightGray });
        }

        y -= lineHeight;
      }

      y -= 8;
      drawLine(y);
      y -= lineHeight;

      if (data.totalAmount != null) {
        const currency = data.currency || 'ILS';
        const totalLabel = isHebrew ? ':סה"כ' : 'Total:';
        page.drawText(rtlText(totalLabel), { x: colX.price, y, size: 11, font: fontBold, color: darkGray });
        page.drawText(`${currency} ${data.totalAmount.toFixed(2)}`, { x: colX.total, y, size: 11, font: fontBold, color: headerBlue });
        y -= lineHeight * 2;
      }
    }

    // ── Delivery info ──
    const deliveryDetails: [string, string][] = [];
    if (data.siteContact) deliveryDetails.push([isHebrew ? 'איש קשר באתר' : 'Site Contact', data.siteContact]);
    if (data.sitePhone) deliveryDetails.push([isHebrew ? 'טלפון' : 'Phone', data.sitePhone]);
    if (data.deliveryNotes) deliveryDetails.push([isHebrew ? 'הערות' : 'Notes', data.deliveryNotes]);

    if (deliveryDetails.length > 0) {
      ensureSpace(80);
      const deliveryTitle = isHebrew ? 'פרטי משלוח' : 'Delivery Details';
      drawText(deliveryTitle, margin, y, 10, fontBold, headerBlue);
      y -= lineHeight;
      for (const [label, value] of deliveryDetails) {
        drawLabelValue(label, value, margin, y);
        y -= lineHeight;
      }
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }
}
