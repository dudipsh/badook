import type { ParsedDeliveryNote, ParsedInvoice, ParsedPurchaseOrder } from './ocr.types';
import type { ValidationResult } from './ocr-validators';

/**
 * Delivery-note specific heuristics (migrated from OcrService.validateDeliveryNote).
 */
export function validateDeliveryNoteHeuristics(parsed: ParsedDeliveryNote): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!parsed.lineItems?.length) return { warnings, confidencePenalty };

  // 1. Flag suspiciously large quantities (likely "יתרה למשלוח" column confusion)
  for (const item of parsed.lineItems) {
    if (item.quantity > 10000) {
      warnings.push(`qty ${item.quantity} for "${item.description?.slice(0, 30)}" is very large — possible יתרה column confusion`);
      confidencePenalty += 0.2;
    }
  }

  // 2. Flag warehouse column confusion (all items have same small quantity)
  if (parsed.lineItems.length >= 2) {
    const quantities = parsed.lineItems.map((i) => i.quantity).filter((q) => q != null && q > 0);
    const allSame = quantities.length >= 2 && quantities.every((q) => q === quantities[0]);
    if (allSame && quantities[0] < 200) {
      warnings.push(
        `All ${quantities.length} items have the same qty=${quantities[0]} — likely reading "מחסן" (warehouse) column instead of "כמות" (quantity)`,
      );
      confidencePenalty += 0.4;
    }
  }

  // 3. Flag 9-digit catalog numbers that look like tax IDs (start with 5)
  // Note: Many product catalog codes are also 9 digits (e.g., 115000709 from Tubol) — only flag those starting with 5 (typical Israeli business IDs)
  for (const item of parsed.lineItems) {
    if (item.catalogNumber && /^5\d{8}$/.test(item.catalogNumber)) {
      warnings.push(`catalogNumber "${item.catalogNumber}" looks like a tax ID (9 digits starting with 5)`);
      confidencePenalty += 0.15;
    }
  }

  // 3. Flag descriptions that look like metadata, not products
  const metadataPattern = /^(עוסק מורשה|מספר חברה|ח\.?פ\.?|ע\.?מ\.?|טלפון|פקס|כתובת|מס['׳]\s*לקוח)/;
  for (const item of parsed.lineItems) {
    if (item.description && metadataPattern.test(item.description)) {
      warnings.push(`"${item.description?.slice(0, 30)}" looks like metadata, not a product`);
      confidencePenalty += 0.3;
    }
  }

  // 4. Flag qty=1 when other items have decimal quantities (likely misread)
  const quantities = parsed.lineItems.map((i) => i.quantity).filter((q) => q != null);
  const hasDecimalQty = quantities.some((q) => q !== Math.floor(q));
  const hasQtyOne = quantities.some((q) => q === 1);
  if (hasDecimalQty && hasQtyOne && parsed.lineItems.length === 1) {
    warnings.push('Single item has qty=1 while unit suggests decimal quantities — possible misread');
    confidencePenalty += 0.15;
  }

  return { warnings, confidencePenalty };
}

// Note: Destructive auto-fix functions (swap, length-as-price) have been removed.
// The AI extraction is trusted. Only warning-based validators remain here.

/**
 * Invoice-specific heuristics.
 */
export function validateInvoiceHeuristics(parsed: ParsedInvoice): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!parsed.invoiceNumber) {
    warnings.push('Missing invoice number');
    confidencePenalty += 0.1;
  }

  if (!parsed.lineItems?.length) {
    warnings.push('No line items extracted');
    confidencePenalty += 0.2;
  }

  // Duplicate line items (same description + same amount)
  const seen = new Set<string>();
  for (const item of parsed.lineItems || []) {
    const key = `${item.description}|${item.totalPrice}`;
    if (seen.has(key)) {
      warnings.push(`Duplicate line item: "${item.description?.slice(0, 30)}"`);
      confidencePenalty += 0.1;
    }
    seen.add(key);
  }

  return { warnings, confidencePenalty };
}

/**
 * Purchase order specific heuristics.
 */
export function validatePurchaseOrderHeuristics(parsed: ParsedPurchaseOrder): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!parsed.poNumber) {
    warnings.push('Missing PO number');
    confidencePenalty += 0.1;
  }

  if (!parsed.lineItems?.length) {
    warnings.push('No line items extracted');
    confidencePenalty += 0.2;
  }

  return { warnings, confidencePenalty };
}

/** Detects possible row-split errors: consecutive items with null quantity/price likely means wrapped description. */
export function validateRowSplits(parsed: {
  lineItems?: Array<{ quantity?: number; unitPrice?: number | null; totalPrice?: number | null; description?: string }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const items = parsed.lineItems || [];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    // If current item has no quantity and no prices, it's likely a wrapped description
    if (
      (curr.quantity == null || curr.quantity === 0) &&
      curr.unitPrice == null &&
      curr.totalPrice == null &&
      prev.quantity != null &&
      prev.quantity > 0
    ) {
      warnings.push(
        `Line ${i + 1}: "${curr.description?.slice(0, 30)}" has no qty/price — may be continuation of line ${i} ("${prev.description?.slice(0, 30)}")`,
      );
      confidencePenalty += 0.15;
    }
  }

  return { warnings, confidencePenalty };
}

/** Warns when line items are missing unit of measure. */
export function validateUnitPresence(parsed: {
  lineItems?: Array<{ unit?: string | null; description?: string }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    if (!item.unit) {
      warnings.push(`Line ${i + 1}: missing unit of measure for "${item.description?.slice(0, 30)}"`);
      confidencePenalty += 0.05;
    }
  }

  return { warnings, confidencePenalty };
}

/** Detects discount leaking into quantity. */
export function validateDiscountQuantityConfusion(parsed: {
  lineItems?: Array<{
    quantity?: number;
    discountPercent?: number | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    priceBeforeDiscount?: number | null;
    description?: string;
  }>;
}): ValidationResult {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  for (let i = 0; i < (parsed.lineItems?.length ?? 0); i++) {
    const item = parsed.lineItems![i];
    if (item.discountPercent == null || item.discountPercent <= 0) continue;
    if (item.quantity == null || item.quantity <= 0) continue;

    // Check if quantity ≈ (1 - discount/100) — the most common confusion pattern
    const suspiciousQty = 1 - item.discountPercent / 100;
    if (suspiciousQty > 0 && Math.abs(item.quantity - suspiciousQty) < 0.02) {
      warnings.push(
        `Line ${i + 1}: quantity=${item.quantity} looks like (1 - ${item.discountPercent}%) = ${suspiciousQty.toFixed(4)} — likely discount/quantity confusion. Quantity should be the physical item count, not a discount factor.`,
      );
      confidencePenalty += 0.25;
    }

    // Check for other multiples: quantity ≈ N * (1 - discount/100) for small N
    if (item.priceBeforeDiscount != null && item.totalPrice != null && item.priceBeforeDiscount > 0) {
      const expectedQtyFromDiscount = item.totalPrice / (item.priceBeforeDiscount * (1 - item.discountPercent / 100));
      const roundedExpected = Math.round(expectedQtyFromDiscount);
      if (
        roundedExpected > 0 &&
        roundedExpected !== item.quantity &&
        Math.abs(expectedQtyFromDiscount - roundedExpected) < 0.05
      ) {
        warnings.push(
          `Line ${i + 1}: quantity=${item.quantity} may have discount baked in; expected ~${roundedExpected} based on totalPrice/discountedUnitPrice`,
        );
        confidencePenalty += 0.2;
      }
    }
  }

  return { warnings, confidencePenalty };
}

