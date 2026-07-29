import { Logger } from '@nestjs/common';

const logger = new Logger('RemarksSeparator');

/**
 * Patterns that indicate a remark/note was concatenated into a product description.
 * These should be extracted into the "remarks" field instead.
 *
 * Each pattern has:
 *  - regex: matches the remark portion within the description
 *  - keepInDescription: if true, the match is ambiguous and should stay (default: false)
 */
const REMARK_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // Delivery coordination: "אספקה בתיאום דנה 053-0000000"
  { regex: /\s*אספקה\s+בתיאום\s+.+$/u, label: 'delivery-coordination' },

  // Phone numbers at end of description (053-XXXXXXX, 052-XXXXXXX, etc.)
  { regex: /\s*0[0-9]{1,2}-?\d{7}\s*$/u, label: 'trailing-phone' },

  // Price quote references: "הצעת מחיר 759", "הצמ"ח 123"
  { regex: /\s*הצעת\s+מחיר\s+\d+\s*$/u, label: 'quote-reference' },

  // Attention notes: "יש לשים לב עובי 1.8", "יש לשים לב ..."
  { regex: /\s*יש\s+לשים\s+לב\s+.+$/u, label: 'attention-note' },

  // Single-word tool/method notes at end: "קודח", "מנעול", "חתוך"
  // Only if the description has a proper product name before it
  { regex: /\s+(קודח|קדוח|חתוך|כולל\s+.+)$/u, label: 'trailing-method' },

  // Delivery date embedded: "25/12/24" at end without context
  { regex: /\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/u, label: 'trailing-date' },

  // "שח XX / אמ XX אמ" — pricing/measurement notes
  { regex: /\s*שח\s+\d+\s*\/\s*אמ\s+\d+\s*אמ\s*$/u, label: 'pricing-note' },
  { regex: /\s*\d+\s*שח\s*\/\s*\d+\s*אמ\s*$/u, label: 'pricing-note-alt' },

  // Thickness/cut notes that are clearly remarks: "עובי 1.8 . חתוך 4.5"
  { regex: /\s*עובי\s+[\d.]+\s*\.?\s*חתוך\s+[\d.]+\s*אמ?\s*$/u, label: 'cut-spec-note' },

  // Generic: text after a newline-like separator within a description
  // Catches cases where PDF cell had multiple lines that got joined
  { regex: /\s{3,}(?:אספקה|הערה|שים\s+לב|הצעת|בתיאום).+$/u, label: 'multi-space-remark' },
];

/**
 * Post-processes extracted line items to separate remarks that got
 * concatenated into descriptions.
 *
 * This handles the case where the PDF has multi-line cells with both
 * the product name and delivery/coordination notes in the same cell.
 *
 * Returns a new array with cleaned descriptions and populated remarks.
 */
export function separateRemarksFromDescriptions<
  T extends { description: string; remarks?: string | null },
>(lineItems: T[]): T[] {
  let fixCount = 0;

  const result = lineItems.map((item) => {
    if (!item.description) return item;

    // If remarks already populated, don't override
    if (item.remarks && item.remarks.trim().length > 0) return item;

    let description = item.description;
    const extractedRemarks: string[] = [];

    // Try each pattern
    for (const { regex, label } of REMARK_PATTERNS) {
      const match = description.match(regex);
      if (match) {
        const remarkText = match[0].trim();
        // Only extract if we'd leave a meaningful description behind
        const remaining = description.replace(regex, '').trim();
        if (remaining.length >= 3) {
          extractedRemarks.push(remarkText);
          description = remaining;
          logger.debug(`[${label}] Separated remark "${remarkText}" from "${item.description}"`);
        }
      }
    }

    if (extractedRemarks.length > 0) {
      fixCount++;
      return {
        ...item,
        description: description.trim(),
        remarks: extractedRemarks.join('; '),
      };
    }

    return item;
  });

  if (fixCount > 0) {
    logger.log(`Separated remarks from descriptions in ${fixCount}/${lineItems.length} line items`);
  }

  return result;
}

/**
 * Detects if two line items with the same catalog number have their
 * descriptions or remarks mixed up (one got the other's data).
 * This is a safety net for column misreads.
 */
export function detectDescriptionSwaps<
  T extends { description: string; catalogNumber?: string | null; remarks?: string | null },
>(lineItems: T[]): T[] {
  // Group by catalog number
  const groups = new Map<string, number[]>();
  lineItems.forEach((item, idx) => {
    if (item.catalogNumber) {
      const existing = groups.get(item.catalogNumber) || [];
      existing.push(idx);
      groups.set(item.catalogNumber, existing);
    }
  });

  // For groups with same catalog number, check if descriptions are suspiciously different
  for (const [catNum, indices] of groups) {
    if (indices.length !== 2) continue;
    const [a, b] = indices;
    const descA = lineItems[a].description;
    const descB = lineItems[b].description;

    // If one description is much longer than the other, the shorter one
    // might have had its description stolen by the longer one
    if (descA.length > descB.length * 3 || descB.length > descA.length * 3) {
      logger.warn(
        `[description-swap] Catalog ${catNum}: descriptions have very different lengths ` +
        `("${descA.slice(0, 50)}" vs "${descB.slice(0, 50)}")`,
      );
    }
  }

  return lineItems;
}
