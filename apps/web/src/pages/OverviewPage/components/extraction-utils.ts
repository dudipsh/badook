import { suppliersService, type Supplier } from '../../../services/suppliers.service';
import type { ExtractedQuoteData } from '../../../services/purchase-orders.service';
import { type LineItem, matchUomFromExtracted } from './po-utils';

export const normalizeSupplierName = (name: string): string =>
  name.trim().toLowerCase()
    .replace(/[\u05F3\u05F4]/g, "'")
    .replace(/[.\-,'"]/g, '')
    .replace(/\s*(בעמ|ltd|inc|llc)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

export const findMatchingSupplier = (
  extractedName: string,
  suppliers: Supplier[],
): Supplier | null => {
  const norm = normalizeSupplierName(extractedName);
  if (norm.length < 2) return null;

  const exact = suppliers.find(
    (s) => normalizeSupplierName(s.name) === norm,
  );
  if (exact) return exact;

  if (norm.length >= 4) {
    const substring = suppliers.find((s) => {
      const sn = normalizeSupplierName(s.name);
      return sn.length >= 4 && (sn.includes(norm) || norm.includes(sn));
    });
    if (substring) return substring;
  }

  for (const s of suppliers) {
    const sn = normalizeSupplierName(s.name);
    const w1 = norm.split(/\s+/).filter((w) => w.length > 2);
    const w2 = sn.split(/\s+/).filter((w) => w.length > 2);
    if (w1.length === 0 || w2.length === 0) continue;
    const common = w1.filter((w) => w2.includes(w));
    if (common.length / Math.min(w1.length, w2.length) >= 0.6) return s;
  }

  return null;
};

export const mapExtractedLineItems = (
  items: ExtractedQuoteData['lineItems'],
): LineItem[] => {
  if (!items || items.length === 0) return [];
  return items.map((li) => {
    let qty = li.quantity;
    const up = li.unitPrice ?? 0;
    const tp = li.totalPrice ?? 0;

    if (qty == null && tp > 0 && up > 0) {
      // Recover missing qty from math
      qty = Math.round((tp / up) * 1000) / 1000;
    } else if (qty != null && tp > 0 && up > 0) {
      const derived = Math.round((tp / up) * 1000) / 1000;
      // If OCR returned an integer but math gives a decimal → OCR dropped the decimal part
      // e.g., OCR: 60, derived: 60.48 (from 8769.60/145)
      const ocrIsInt = qty === Math.floor(qty);
      const derivedHasDecimals = derived !== Math.floor(derived);
      const derivedMathChecks = Math.abs(derived * up - tp) / tp <= 0.01;
      if (ocrIsInt && derivedHasDecimals && derivedMathChecks) {
        qty = derived;
      } else if (Math.abs((qty * up) - tp) / tp > 0.05 && derivedMathChecks) {
        // OCR qty is way off but derived checks out → use derived
        qty = derived;
      }
    }

    return {
      description: li.description || '',
      catalogNumber: li.catalogNumber || '',
      unit: matchUomFromExtracted(li.unit || ''),
      quantity: qty != null ? String(qty) : '',
      unitPrice: li.unitPrice != null ? String(li.unitPrice) : '',
      discountPercent: li.discountPercent != null ? String(li.discountPercent) : '',
    };
  });
};

export const autoMatchSupplier = async (
  extractedName: string,
): Promise<Supplier | null> => {
  try {
    const suppliers = await suppliersService.getAll();
    return findMatchingSupplier(extractedName, suppliers);
  } catch {
    return null;
  }
};
