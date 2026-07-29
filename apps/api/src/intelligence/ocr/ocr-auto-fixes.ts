import type { ValidationResult } from './ocr-validators';

/**
 * Auto-fix: recover missing quantities from totalPrice / unitPrice.
 */
export function validateAndFixMissingQuantity(parsed: {
  lineItems?: Array<{
    quantity?: number;
    unitPrice?: number | null;
    totalPrice?: number | null;
    description?: string;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    if (item.quantity != null && item.quantity > 0) continue;
    if (!item.totalPrice || item.totalPrice <= 0) continue;
    if (!item.unitPrice || item.unitPrice <= 0) continue;

    const recovered =
      Math.round((item.totalPrice / item.unitPrice) * 1000) / 1000;
    if (recovered > 0) {
      warnings.push(
        `Line ${i + 1}: missing qty recovered as ${recovered}`,
      );
      item.quantity = recovered;
      confidencePenalty += 0.1;
    }
  }

  return { warnings, confidencePenalty };
}

/**
 * Auto-fix: recover decimal quantities dropped by OCR.
 * When OCR returns an integer qty but totalPrice/unitPrice implies a decimal,
 * replace with the mathematically derived value.
 */
export function validateAndFixDecimalQuantity(parsed: {
  lineItems?: Array<{
    quantity?: number;
    unitPrice?: number | null;
    totalPrice?: number | null;
    description?: string;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    const qty = item.quantity;
    const up = Number(item.unitPrice) || 0;
    const tp = Number(item.totalPrice) || 0;
    if (qty == null || qty <= 0 || up <= 0 || tp <= 0) continue;

    const derived = Math.round((tp / up) * 1000) / 1000;
    const ocrIsInt = qty === Math.floor(qty);
    const derivedHasDecimals = derived !== Math.floor(derived);
    const derivedMathChecks = Math.abs(derived * up - tp) / tp <= 0.01;

    if (ocrIsInt && derivedHasDecimals && derivedMathChecks) {
      warnings.push(`Line ${i + 1}: qty ${qty} → ${derived} (decimal recovered from math)`);
      item.quantity = derived;
    }
  }

  return { warnings, confidencePenalty };
}

/**
 * Validates that qty × unitPrice ≈ totalPrice for line items.
 * If most lines fail this check, applies a heavy confidence penalty
 * to trigger retry extraction.
 */
export function validateLineItemMathConsistency(parsed: {
  lineItems?: Array<{
    quantity?: number;
    unitPrice?: number | null;
    totalPrice?: number | null;
    description?: string;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const items = parsed.lineItems || [];
  if (items.length < 2) return { warnings, confidencePenalty };

  let checkable = 0;
  let failed = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const up = Number(item.unitPrice) || 0;
    const tp = Number(item.totalPrice) || 0;
    if (qty <= 0 || up <= 0 || tp <= 0) continue;
    checkable++;
    const expected = qty * up;
    if (Math.abs(expected - tp) / tp > 0.05) {
      failed++;
    }
  }

  if (checkable >= 2 && failed / checkable > 0.4) {
    confidencePenalty = 0.3;
    warnings.push(
      `${failed}/${checkable} line items fail qty×unitPrice≈totalPrice check — likely misread table`,
    );
  }

  return { warnings, confidencePenalty };
}

/**
 * Detects and AUTO-FIXES when quantity is a sub-column
 * instead of the total from quantityBreakdown.
 */
export function validateAndFixQuantityBreakdown(parsed: {
  lineItems?: Array<{
    quantity?: number;
    unit?: string | null;
    quantityBreakdown?: Array<{
      label: string; value: number; unit: string;
    }> | null;
    description?: string;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    const bd = item.quantityBreakdown;
    if (!bd || bd.length < 2) continue;

    const values = bd.map((b) => b.value);

    for (let a = 0; a < values.length; a++) {
      for (let b = a + 1; b < values.length; b++) {
        for (let c = 0; c < values.length; c++) {
          if (c === a || c === b) continue;
          const product = values[a] * values[b];
          if (
            product > 0 &&
            Math.abs(product - values[c]) / values[c] < 0.02
          ) {
            const total = values[c];
            if (
              item.quantity != null &&
              Math.abs(item.quantity - total) > 0.01
            ) {
              warnings.push(
                `Line ${i + 1}: qty=${item.quantity} but ` +
                `breakdown shows ${values[a]}×${values[b]}=${total}`,
              );
              item.quantity = total;
              item.unit = bd[c].unit;
              confidencePenalty += 0.1;
            }
            break;
          }
        }
        if (warnings.length > 0) break;
      }
      if (warnings.length > 0) break;
    }
  }

  return { warnings, confidencePenalty };
}

/** Units that represent packaging, not deliverable quantity */
const PACKAGING_UNITS = ['קרטון', 'קרטונים', 'משטח', 'משטחים', 'חבילה', 'חבילות', 'אריזה', 'אריזות', 'פלט', 'פלטות'];
const MEASUREMENT_UNITS = ['מ"ר', 'מטר', "מ'", 'מ"א', "ק\"ג", 'טון', 'ליטר', 'יחידות', "יח'"];

/**
 * Auto-fix: when quantityBreakdown has a packaging column (cartons/pallets)
 * and a measurement column, use the measurement value as quantity.
 */
export function validateAndFixCartonQuantity(parsed: {
  lineItems?: Array<{
    quantity?: number;
    unit?: string | null;
    quantityBreakdown?: Array<{
      label: string; value: number; unit: string;
    }> | null;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    const bd = item.quantityBreakdown;
    if (!bd || bd.length < 2) continue;

    const packagingEntry = bd.find((b) =>
      PACKAGING_UNITS.some((u) => (b.unit || '').includes(u) || (b.label || '').includes(u)),
    );
    const measurementEntry = bd.find((b) =>
      !PACKAGING_UNITS.some((u) => (b.unit || '').includes(u) || (b.label || '').includes(u)) &&
      (MEASUREMENT_UNITS.some((u) => (b.unit || '').includes(u)) || b.value !== packagingEntry?.value),
    );

    if (!packagingEntry || !measurementEntry) continue;

    if (
      item.quantity != null &&
      Math.abs(item.quantity - packagingEntry.value) < 0.01 &&
      Math.abs(item.quantity - measurementEntry.value) > 0.01
    ) {
      warnings.push(
        `Line ${i + 1}: qty=${item.quantity} is carton count, fixed to ${measurementEntry.value} ${measurementEntry.unit}`,
      );
      item.quantity = measurementEntry.value;
      item.unit = measurementEntry.unit;
      confidencePenalty += 0.1;
    }
  }

  return { warnings, confidencePenalty };
}
