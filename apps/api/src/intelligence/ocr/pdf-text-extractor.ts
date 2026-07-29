import { Logger } from '@nestjs/common';

const logger = new Logger('PdfTextExtractor');

/**
 * Extracts the raw text layer from a PDF buffer using mupdf.
 * This provides structured text that helps the Vision API avoid
 * common misreads (reversed columns, merged fields, RTL confusion).
 *
 * Returns null if extraction fails or yields no text (scanned-only PDF).
 */
export async function extractPdfTextLayer(buffer: Buffer): Promise<string | null> {
  try {
    const mupdf: any = await (Function('return import("mupdf")')());
    const m = mupdf.default || mupdf;
    const doc = m.Document.openDocument(buffer, 'application/pdf');
    const pageCount = doc.countPages();
    const pages: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const text: string = page.toStructuredText('preserve-whitespace').asText();
      if (text?.trim()) {
        pages.push(`--- PAGE ${i + 1} ---\n${text.trim()}`);
      }
    }

    const fullText = pages.join('\n\n');

    // If text is too short, the PDF is probably scanned (no text layer)
    if (fullText.length < 50) {
      logger.debug('PDF text layer too short — likely a scanned document');
      return null;
    }

    logger.log(`Extracted text layer: ${fullText.length} chars from ${pageCount} pages`);
    return fullText;
  } catch (err) {
    logger.debug(`PDF text extraction failed (expected for scanned PDFs): ${err}`);
    return null;
  }
}

/**
 * Attempts to parse the text layer into a structured table format.
 * Identifies the header row (הרעה, סה"כ מחיר, מחיר, כמות, תיאור, מק"ט, שורה)
 * and maps each data row into labeled columns.
 *
 * This gives the AI a much clearer signal about which text belongs to which column.
 */
export function parseTextLayerTable(textLayer: string): string | null {
  const lines = textLayer.split('\n').map((l) => l.trim()).filter(Boolean);

  // Find the header row — look for a line containing both "הרעה" and "ט"קמ" (or "תיאור" and "שורה")
  const headerIdx = lines.findIndex(
    (l) =>
      (l.includes('הרעה') && l.includes('תומכ')) ||
      (l.includes('הרעה') && l.includes('ט"קמ')) ||
      (l.includes('רצומ רואת') && l.includes('הרוש')),
  );

  if (headerIdx < 0) {
    logger.debug('Could not find table header in text layer');
    return null;
  }

  // Find data rows: lines after header that start with or contain a row number + catalog number pattern
  // In RTL text layer, data rows typically contain catalog numbers (8-10 digit sequences)
  const dataRows: string[] = [];
  const catalogPattern = /\d{7,10}/;
  const pricePattern = /[\d,]+\.\d{2}/;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at summary rows (מחיר כולל, מע"מ, סה"כ)
    if (line.includes('ללוכ ריחמ') || line.includes('מ"עמ') || line.includes('ריחמ כ"הס')) break;
    // Skip empty or very short lines
    if (line.length < 5) continue;
    // Data rows have catalog numbers and prices
    if (catalogPattern.test(line) && pricePattern.test(line)) {
      dataRows.push(line);
    }
  }

  if (dataRows.length === 0) {
    logger.debug('No data rows found in text layer table');
    return null;
  }

  logger.log(`Parsed ${dataRows.length} table rows from text layer`);

  // Format as structured hint
  const structured = dataRows
    .map((row, idx) => `Row ${idx + 1}: ${row}`)
    .join('\n');

  return structured;
}

/**
 * Extracts the project name from the PDF text layer using deterministic patterns.
 * In Israeli POs, the project name typically appears as:
 *   - "פרויקט: ביג גלילות - לובי" (normal)
 *   - "יבול - תולילג גיב :טקיורפ" (reversed RTL in text layer)
 *   - "אתר: שם הפרויקט"
 *   - "Project: ..."
 *
 * Also looks for delivery address patterns that can serve as project identifiers.
 */
export function extractProjectNameFromTextLayer(textLayer: string): string | null {
  const lines = textLayer.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Normal Hebrew: "פרויקט: ביג גלילות - לובי"
    const normalMatch = line.match(/פרויקט\s*[:：]\s*(.+)/u);
    if (normalMatch) {
      const name = normalMatch[1].trim();
      if (name.length >= 2) {
        logger.log(`[project-name] Found (normal): "${name}"`);
        return name;
      }
    }

    // Reversed RTL text layer: ":טקיורפ" is "פרויקט:" reversed
    // The text after it (to the left in the reversed string) is the project name, also reversed
    const reversedMatch = line.match(/(.+?)\s*:טקיורפ/u);
    if (reversedMatch) {
      // The captured group is the reversed project name — reverse it back
      const reversed = reversedMatch[1].trim();
      const name = [...reversed].reverse().join('');
      if (name.length >= 2) {
        logger.log(`[project-name] Found (reversed): "${name}" (raw: "${reversed}")`);
        return name;
      }
    }

    // Normal Hebrew: "אתר: שם הפרויקט"
    const siteMatch = line.match(/אתר\s*[:：]\s*(.+)/u);
    if (siteMatch) {
      const name = siteMatch[1].trim();
      if (name.length >= 2) {
        logger.log(`[project-name] Found (site): "${name}"`);
        return name;
      }
    }

    // Reversed: ":רתא" is "אתר:" reversed
    const reversedSiteMatch = line.match(/(.+?)\s*:רתא/u);
    if (reversedSiteMatch) {
      const reversed = reversedSiteMatch[1].trim();
      const name = [...reversed].reverse().join('');
      if (name.length >= 2) {
        logger.log(`[project-name] Found (reversed site): "${name}"`);
        return name;
      }
    }

    // English: "Project: ..."
    const engMatch = line.match(/Project\s*[:：]\s*(.+)/i);
    if (engMatch) {
      const name = engMatch[1].trim();
      if (name.length >= 2) {
        logger.log(`[project-name] Found (english): "${name}"`);
        return name;
      }
    }
  }

  logger.debug('[project-name] No project name found in text layer');
  return null;
}

/**
 * Extracts the delivery address from the PDF text layer using deterministic patterns.
 * Common labels: "כתובת למשלוח", "כתובת אספקה", "מקום אספקה", "יעד הספקה"
 */
export function extractDeliveryAddressFromTextLayer(textLayer: string): string | null {
  const lines = textLayer.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Normal: "כתובת למשלוח: ..."
    const addressPatterns = [
      /כתובת\s+למשלוח\s*[:：]\s*(.+)/u,
      /כתובת\s+אספקה\s*[:：]\s*(.+)/u,
      /מקום\s+אספקה\s*[:：]\s*(.+)/u,
      /יעד\s+הספקה\s*[:：]\s*(.+)/u,
      /יעד\s+האספקה\s*[:：]\s*(.+)/u,
      /יעד\s+למשלוח\s*[:：]\s*(.+)/u,
      /לאתר\s*[:：]\s*(.+)/u,
    ];

    for (const pattern of addressPatterns) {
      const match = line.match(pattern);
      if (match) {
        const addr = match[1].trim();
        if (addr.length >= 3) {
          logger.log(`[delivery-address] Found: "${addr}"`);
          return addr;
        }
      }
    }

    // Reversed RTL patterns
    const reversedPatterns = [
      /(.+?)\s*:חולשמל\s+תבותכ/u,   // "כתובת למשלוח:" reversed
      /(.+?)\s*:הקפסא\s+תבותכ/u,    // "כתובת אספקה:" reversed
    ];

    for (const pattern of reversedPatterns) {
      const match = line.match(pattern);
      if (match) {
        const reversed = match[1].trim();
        const addr = [...reversed].reverse().join('');
        if (addr.length >= 3) {
          logger.log(`[delivery-address] Found (reversed): "${addr}"`);
          return addr;
        }
      }
    }
  }

  return null;
}

/**
 * Builds a prompt suffix that includes the extracted text layer.
 * This gives the Vision API a "cheat sheet" to cross-reference against
 * the visual layout, dramatically reducing column-swap and RTL errors.
 */
export function buildTextLayerHint(textLayer: string, docType?: string): string {
  // Truncate if too long to avoid token waste
  const maxChars = 4000;
  const truncated = textLayer.length > maxChars
    ? textLayer.slice(0, maxChars) + '\n... [truncated]'
    : textLayer;

  let hint =
    '\n\nTEXT LAYER REFERENCE (extracted from PDF metadata — use to cross-check your visual reading):\n' +
    '```\n' + truncated + '\n```\n' +
    'CRITICAL INSTRUCTIONS FOR USING THE TEXT LAYER:\n' +
    '1. The text layer may be in REVERSED Hebrew (RTL stored as LTR). Read it right-to-left.\n' +
    '2. DO NOT assume a fixed column order from this text layer. Different suppliers use different column layouts. You MUST identify columns from the ACTUAL TABLE HEADERS in the document image, NOT from the text layer order.\n' +
    '3. For EACH line item, the "description" field should contain ONLY the product name from the תיאור column.\n' +
    '4. Text like "אספקה בתיאום...", "הצעת מחיר XXX", "יש לשים לב...", "קודח", "שח XX / אמ XX" belongs in "remarks", NOT in "description".\n' +
    '5. If a description cell in the PDF contains multiple lines (product name + delivery note), split them: product name → description, everything else → remarks.\n' +
    '6. LOOK FOR PROJECT NAME: Search the text layer for "טקיורפ" (reversed "פרויקט") or "פרויקט:" — this is the project name. Extract it into the "projectName" field.\n' +
    '7. LOOK FOR DELIVERY ADDRESS: Search for "חולשמל תבותכ" (reversed "כתובת למשלוח") or "כתובת למשלוח:" — extract into "deliveryAddress".\n';

  return hint;
}
