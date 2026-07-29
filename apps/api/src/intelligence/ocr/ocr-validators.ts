export interface ValidationResult {
  warnings: string[];
  confidencePenalty: number;
}

/** 2% relative tolerance or 0.02 absolute for monetary comparison */
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.02);
}

/**
 * Mathematical validation for any document with line items + totals.
 * Checks: per-line math, sum-to-subtotal, subtotal+vat=total.
 */
export function validateMathematics(parsed: {
  lineItems?: Array<{ quantity?: number; unitPrice?: number | null; totalPrice?: number | null }>;
  subtotal?: number | null;
  vatAmount?: number | null;
  totalAmount?: number | null;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const items = parsed.lineItems || [];

  // 1. Per-line: quantity × unitPrice ≈ totalPrice
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.quantity != null && item.unitPrice != null && item.totalPrice != null) {
      const expected = item.quantity * item.unitPrice;
      if (!approxEqual(expected, item.totalPrice)) {
        warnings.push(
          `Line ${i + 1}: qty(${item.quantity}) × price(${item.unitPrice}) = ${expected.toFixed(2)}, but totalPrice is ${item.totalPrice}`,
        );
        confidencePenalty += 0.1;
      }
    }
  }

  // 2. Sum of line totalPrices ≈ subtotal
  const lineTotals = items
    .map((i) => i.totalPrice)
    .filter((p): p is number => p != null);

  if (lineTotals.length > 0 && parsed.subtotal != null) {
    const computedSubtotal = lineTotals.reduce((a, b) => a + b, 0);
    if (!approxEqual(computedSubtotal, parsed.subtotal)) {
      warnings.push(
        `Sum of line totals (${computedSubtotal.toFixed(2)}) ≠ subtotal (${parsed.subtotal})`,
      );
      confidencePenalty += 0.15;
    }
  }

  // 3. subtotal + vatAmount ≈ totalAmount
  if (parsed.subtotal != null && parsed.vatAmount != null && parsed.totalAmount != null) {
    const computedTotal = parsed.subtotal + parsed.vatAmount;
    if (!approxEqual(computedTotal, parsed.totalAmount)) {
      warnings.push(
        `subtotal(${parsed.subtotal}) + VAT(${parsed.vatAmount}) = ${computedTotal.toFixed(2)}, but total is ${parsed.totalAmount}`,
      );
      confidencePenalty += 0.15;
    }
  }

  return { warnings, confidencePenalty };
}

interface DiscountLineItem {
  discountPercent?: number | null;
  discountAmount?: number | null;
  priceBeforeDiscount?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  quantity?: number;
  description?: string;
}

/** Validates discount math consistency across line items. */
export function validateDiscounts(parsed: { lineItems?: DiscountLineItem[] }): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    const hasDiscount = item.discountPercent != null || item.discountAmount != null || item.priceBeforeDiscount != null;
    if (!hasDiscount) continue;

    // Check: priceBeforeDiscount × (1 - percent/100) ≈ unitPrice
    if (item.priceBeforeDiscount != null && item.discountPercent != null && item.unitPrice != null) {
      const expected = item.priceBeforeDiscount * (1 - item.discountPercent / 100);
      if (!approxEqual(expected, item.unitPrice)) {
        warnings.push(`Line ${i + 1}: discount math mismatch — ${item.priceBeforeDiscount} × (1-${item.discountPercent}%) = ${expected.toFixed(2)}, but unitPrice is ${item.unitPrice}`);
        confidencePenalty += 0.1;
      }
    }

    // Partially filled discount fields
    if (item.discountPercent != null && item.priceBeforeDiscount == null) {
      warnings.push(`Line ${i + 1}: discount percent set but priceBeforeDiscount missing`);
      confidencePenalty += 0.05;
    }
  }

  return { warnings, confidencePenalty };
}

/** Flags suspiciously round prices when totals have decimals. */
export function validateNoRounding(parsed: {
  lineItems?: Array<{ unitPrice?: number | null; totalPrice?: number | null }>;
  subtotal?: number | null;
  totalAmount?: number | null;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const items = parsed.lineItems || [];
  if (items.length === 0) return { warnings, confidencePenalty };

  const unitPrices = items.map((i) => i.unitPrice).filter((p): p is number => p != null);
  if (unitPrices.length === 0) return { warnings, confidencePenalty };

  const allRound = unitPrices.every((p) => p === Math.round(p));
  const totalHasDecimals = (parsed.subtotal != null && parsed.subtotal !== Math.round(parsed.subtotal))
    || (parsed.totalAmount != null && parsed.totalAmount !== Math.round(parsed.totalAmount));

  if (allRound && totalHasDecimals && unitPrices.length >= 3) {
    warnings.push('All unit prices are round numbers but subtotal/total has decimals — prices may have been rounded');
    confidencePenalty += 0.1;
  }

  return { warnings, confidencePenalty };
}

/**
 * Detects signs of template confusion or hallucination:
 * - Many null prices (>50% of line items)
 * - Duplicate descriptions across multiple line items
 * - Supplier name appearing in line item descriptions
 * - Very short descriptions (<3 chars) for multiple items
 * - All quantities exactly 1 when many line items exist
 */
export function validateStructuralConsistency(parsed: {
  supplierName?: string;
  lineItems?: Array<{
    description?: string;
    unitPrice?: number | null;
    totalPrice?: number | null;
    quantity?: number;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const items = parsed.lineItems || [];
  if (items.length < 2) return { warnings, confidencePenalty };

  // 1. Many null unitPrice/totalPrice fields (>50% of line items)
  const nullPriceCount = items.filter(
    (i) => i.unitPrice == null && i.totalPrice == null,
  ).length;
  if (nullPriceCount > items.length * 0.5 && items.length >= 3) {
    warnings.push(
      `${nullPriceCount}/${items.length} line items have no prices — possible template confusion`,
    );
    confidencePenalty += 0.2;
  }

  // 2. Duplicate descriptions across multiple line items
  const descCounts = new Map<string, number>();
  for (const item of items) {
    const desc = (item.description || '').trim().toLowerCase();
    if (desc.length > 0) {
      descCounts.set(desc, (descCounts.get(desc) || 0) + 1);
    }
  }
  const duplicateDescCount = Array.from(descCounts.values()).filter((c) => c > 1).length;
  if (duplicateDescCount >= 2 || (duplicateDescCount >= 1 && items.length <= 5)) {
    warnings.push(
      `${duplicateDescCount} duplicate description(s) across line items — possible hallucination`,
    );
    confidencePenalty += 0.25;
  }

  // 3. Supplier name appears in line item descriptions
  const supplierName = (parsed.supplierName || '').trim().toLowerCase();
  if (supplierName.length >= 3) {
    const supplierInDesc = items.filter((i) =>
      (i.description || '').toLowerCase().includes(supplierName),
    ).length;
    if (supplierInDesc >= 2) {
      warnings.push(
        `Supplier name "${parsed.supplierName}" appears in ${supplierInDesc} line item descriptions — possible metadata confusion`,
      );
      confidencePenalty += 0.3;
    }
  }

  // 4. Very short descriptions (<3 chars) for multiple items
  const shortDescCount = items.filter(
    (i) => (i.description || '').trim().length < 3,
  ).length;
  if (shortDescCount >= 2) {
    warnings.push(
      `${shortDescCount} line items have very short descriptions (<3 chars) — possible extraction failure`,
    );
    confidencePenalty += 0.2;
  }

  // 5. All quantities being exactly 1 (suspicious if >= 5 line items)
  if (items.length >= 5) {
    const allQtyOne = items.every((i) => i.quantity === 1);
    if (allQtyOne) {
      warnings.push(
        `All ${items.length} line items have quantity=1 — possibly defaulted rather than extracted`,
      );
      confidencePenalty += 0.15;
    }
  }

  return { warnings, confidencePenalty };
}
