/**
 * Split a string that may contain multiple PO references into individual refs.
 */
function splitMultipleRefs(raw: string): string[] {
  // Split on comma, semicolon, or " and " (with surrounding whitespace to avoid splitting "Anderson")
  const parts = raw
    .split(/[,;]|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length > 1) return parts;

  // Try splitting on whitespace-before-PO-prefix pattern: "PO24001915 PO24001916"
  const poPattern = raw.match(/(?:PO)?\s*\d{6,}/gi);
  if (poPattern && poPattern.length > 1) return poPattern.map((s) => s.trim());

  return parts;
}

/**
 * Extract all PO number references from invoice or DN parsed data.
 * Returns an array of reference strings (may contain multiple for multi-PO invoices).
 */
export function extractPoReferences(doc: any): string[] {
  const parsed = doc.parsedData as Record<string, any> | null;
  if (!parsed) return [];

  for (const fieldName of ['poReference', 'orderReference', 'supplierOrderNumber']) {
    const val = parsed[fieldName];
    if (!val) continue;

    // Handle array format: ["PO24001915", "PO24001916"]
    if (Array.isArray(val)) {
      const refs = val.filter((v: any) => typeof v === 'string' && v.trim().length > 0);
      if (refs.length > 0) return refs;
    }

    // Handle string format: may contain multiple refs separated by comma/semicolon/etc.
    if (typeof val === 'string' && val.trim().length > 0) {
      const refs = splitMultipleRefs(val);
      if (refs.length > 0) return refs;
    }
  }

  for (const field of ['poNumber', 'purchaseOrderNumber', 'notes']) {
    const val = parsed[field];
    if (val && typeof val === 'string') {
      // Match ALL PO patterns in the string
      const poMatches = val.match(/PO\d+/gi);
      if (poMatches && poMatches.length > 0) return poMatches;
      const hebrewMatch = val.match(/(?:הזמנה|הזמנת רכש|מס['׳]\s*הזמנה)\s*(\d{6,})/);
      if (hebrewMatch) return [hebrewMatch[1]];
    }
  }

  // Fallback: search line item descriptions for PO references
  // (common in consolidated invoices: "גמר חשבון - הזמנת רכש 25000432")
  if (Array.isArray(parsed.lineItems)) {
    for (const item of parsed.lineItems) {
      const desc = item.description;
      if (!desc || typeof desc !== 'string') continue;
      const poMatch = desc.match(/PO\s*(\d{6,})/i);
      if (poMatch) return [poMatch[0].replace(/\s+/g, '')];
      const hebrewMatch = desc.match(/(?:הזמנה|הזמנת רכש|הזמנת\s+רכש)\s*(?:מספר\s*)?(\d{5,})/);
      if (hebrewMatch) return [hebrewMatch[1]];
    }
  }

  return [];
}

/**
 * Extract PO number reference from invoice or DN parsed data.
 * Returns the first reference found (backward-compatible single-ref version).
 */
export function extractPoReference(doc: any): string | null {
  const refs = extractPoReferences(doc);
  return refs.length > 0 ? refs[0] : null;
}

/**
 * Extract delivery note number references from parsed data.
 */
export function extractDnReferences(doc: any): string[] {
  const parsed = doc.parsedData as Record<string, any> | null;
  if (!parsed) return [];

  if (Array.isArray(parsed.deliveryNoteReferences)) {
    return parsed.deliveryNoteReferences.filter(
      (ref: any) => typeof ref === 'string' && ref.length > 0,
    );
  }

  const notes = parsed.notes;
  if (notes && typeof notes === 'string') {
    const matches = notes.match(/(?:תעודת משלוח|אסמכתא)[:\s]*(\d+)/g);
    if (matches) {
      return matches
        .map((m: string) => m.match(/(\d+)/)?.[1] || '')
        .filter((s: string) => s.length > 0);
    }
  }

  return [];
}

/**
 * Normalize a reference number for comparison (remove whitespace, leading zeros, type suffixes).
 */
export function normalizeRef(ref: string): string {
  return ref
    .replace(/\s+/g, '')
    // Strip a leading doc-type token + its separator ("PO-2026-1000" → "2026-1000").
    // OCR is inconsistent: the same order is referenced as "PO-2026-1000" on one
    // document and "2026-1000" on another. Without this the prefixed ones fail to
    // match their PO, fall through to supplier-based consolidation, and collapse
    // unrelated orders into one giant 3-way match with nonsensical reconciled totals.
    .replace(/^(PO|PD|DN|SH|SO|INV)[^a-zA-Z0-9]*/i, '')
    .replace(/(PO|PD|DN|SH|SO|INV)$/i, '')
    .replace(/^0+/, '')
    .toLowerCase();
}
