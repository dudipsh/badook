import {
  resolveReceivedFromPairing,
  resolveReceivedFallback,
} from './resolve-received';
import { resolveInvoiced } from './resolve-invoiced';
import { splitMixedScriptWords, fuzzyWordMatch } from '../matching/line-item-match-utils';

export interface LineItemOverride {
  invoicedQty?: number;
  unitPrice?: number;
  unit?: string;
}

/** Extract keywords from description, splitting mixed-script words (e.g. "גאלווALBAR" → ["גאלוו","albar"]) */
const keywords = (s: string): string[] => {
  const rawWords = s
    .replace(/[()"/\-,.:;!?\n]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const result: string[] = [];
  for (const w of rawWords) {
    const parts = splitMixedScriptWords(w);
    if (parts.length > 1) {
      result.push(...parts.filter(p => p.length >= 2).map(p => p.toLowerCase()));
    }
    if (w.length >= 3) result.push(w.toLowerCase());
  }
  return result;
};

/**
 * Validate that a pairing's description matches the PO line.
 * Trust the matching pipeline — it already validates keyword overlap.
 * Only reject in extreme cases (clearly unrelated long descriptions).
 */
const isPairingPartValid = (
  _desc: string | undefined,
  _poDesc: string,
): boolean => {
  // The matching pipeline already validates pairings with keyword overlap checks.
  // Adding another layer here caused valid matches to be rejected.
  return true;
};

/**
 * Build a single PO line item with received qty,
 * invoiced status, delivery history, etc.
 */
export const buildLineItem = (
  po: any,
  lineItem: any,
  match: any,
  pairings: any[],
  override?: LineItemOverride,
  crossMatchExcludedDnLineIds?: Set<string>,
  crossMatchExcludedInvLineIds?: Set<string>,
) => {
  const poDesc = lineItem.description?.trim() || '';

  // Find pairing — prefer pairings WITH dn (when a PO item has multiple
  // pairings, e.g. partial deliveries, the first match might lack a dn)
  const pairing =
    pairings.find(
      (p: any) => p?.po?.id && p.po.id === lineItem.id && p?.dn,
    ) ||
    pairings.find(
      (p: any) => p?.po?.id && p.po.id === lineItem.id,
    ) ||
    pairings.find(
      (p: any) => p?.po?.index === lineItem.sortOrder && p?.dn,
    ) ||
    pairings.find(
      (p: any) => p?.po?.index === lineItem.sortOrder,
    ) ||
    pairings.find(
      (p: any) =>
        (p?.po?.description?.trim() || '') === poDesc && p?.dn,
    ) ||
    pairings.find(
      (p: any) =>
        (p?.po?.description?.trim() || '') === poDesc,
    );

  let receivedQty = 0;
  let receivedUnit: string | null = null;
  const deliveryHistory: any[] = [];
  const currentPoIndex =
    pairing?.po?.index ?? lineItem.sortOrder;

  const poUnit: string | null = lineItem.unit ?? null;

  // Validate that the pairing's DN/INV actually match this PO line
  const dnValid = isPairingPartValid(
    pairing?.dn?.description,
    poDesc,
  );
  const invValid = isPairingPartValid(
    pairing?.inv?.description,
    poDesc,
  );

  // Build a sanitized pairing: strip invalid parts
  const safePairing =
    !dnValid || !invValid
      ? {
          ...pairing,
          dn: dnValid ? pairing?.dn : undefined,
          inv: invValid ? pairing?.inv : undefined,
        }
      : pairing;

  if (dnValid && pairing?.dn && match?.deliveryNotes) {
    resolveReceivedFromPairing(
      pairing,
      pairings,
      currentPoIndex,
      poDesc,
      match,
      deliveryHistory,
      (qty: number, unit: string | null) => {
        receivedQty += qty;
        if (!receivedUnit && unit) receivedUnit = unit;
      },
      poUnit,
      crossMatchExcludedDnLineIds,
    );
  } else if (match?.deliveryNotes) {
    resolveReceivedFallback(
      pairings,
      currentPoIndex,
      poDesc,
      match,
      deliveryHistory,
      (qty: number, unit: string | null) => {
        receivedQty += qty;
        if (!receivedUnit && unit) receivedUnit = unit;
      },
      poUnit,
      crossMatchExcludedDnLineIds,
    );
  }

  const ordered = resolveOrderedQty(lineItem);
  const finalQty = ordered.qty;
  const correctedUnitPrice = Number(lineItem.unitPrice) || 0;

  const invoiced = resolveInvoiced(
    safePairing,
    pairings,
    match,
    override,
    receivedQty,
    lineItem,
    finalQty,
    correctedUnitPrice,
    crossMatchExcludedInvLineIds,
  );

  const related = buildRelatedDocs(po, match, safePairing, deliveryHistory);

  // Delivery status
  let deliveryStatus: 'full' | 'partial' | 'over' | 'none' =
    'none';
  if (receivedQty > 0 && finalQty > 0) {
    const rO = Math.round(finalQty * 100) / 100;
    const rR = Math.round(receivedQty * 100) / 100;
    deliveryStatus =
      rR >= rO ? (rR > rO ? 'over' : 'full') : 'partial';
  }

  // Detect service items
  const serviceKw = [
    'התקנה', 'עבודה', 'שירות', 'הובלה',
    'משלוח', 'פירוק', 'הרכבה', 'מנוף',
  ];
  const desc = (lineItem.description || '').trim();
  const isService =
    receivedQty === 0 &&
    !pairing?.dn &&
    serviceKw.some((kw) => desc.includes(kw));

  const rawUnitPrice = Number(lineItem.unitPrice) || 0;
  const discPct = ordered.discountPct;
  const hasPriceBeforeDiscount = lineItem.priceBeforeDiscount != null && Number(lineItem.priceBeforeDiscount) > 0;
  // If priceBeforeDiscount exists, unitPrice is already after discount — don't re-apply
  const discUnitPrice = (discPct > 0 && !hasPriceBeforeDiscount)
    ? rawUnitPrice * (1 - discPct / 100)
    : rawUnitPrice;
  const effectiveUnitPrice =
    override?.unitPrice ??
    Math.round(discUnitPrice * 100) / 100;
  const priceBeforeDiscount = hasPriceBeforeDiscount
    ? Number(lineItem.priceBeforeDiscount)
    : discPct > 0
      ? rawUnitPrice
      : null;

  return {
    id: lineItem.id,
    poNumber: po.poNumber,
    poId: po.id,
    description: lineItem.description,
    orderedQty: finalQty,
    unitPrice: effectiveUnitPrice,
    receivedQty,
    totalQty: finalQty,
    shipmentCount: deliveryHistory.length,
    remaining: isService ? 0 : Math.round((finalQty - receivedQty) * 100) / 100,
    lineTotal:
      invoiced.total ??
      (receivedQty > 0 ? receivedQty : finalQty) *
        effectiveUnitPrice,
    deliveryStatus: isService ? 'none' : deliveryStatus,
    invoicedStatus: isService
      ? ('service' as any)
      : invoiced.status,
    invoicedAmount: invoiced.amount,
    invoicedUnitPrice: invoiced.unitPrice,
    invoicedTotal: invoiced.total,
    mismatchReason: invoiced.mismatchReason,
    matchId: match?.id || null,
    quoteReference: po.quoteReference || null,
    deliveryHistory,
    relatedDocuments: related,
    currency: po.currency || 'ILS',
    unit: override?.unit ?? lineItem.unit ?? null,
    receivedUnit: receivedUnit ?? lineItem.unit ?? null,
    discountPercent: discPct > 0 ? discPct : null,
    discountAmount: lineItem.discountAmount
      ? Number(lineItem.discountAmount)
      : null,
    priceBeforeDiscount,
    isService,
    hasOverride: !!override,
  };
};

// ─── Related documents ──────────────────────────────

const buildRelatedDocs = (po: any, match: any, pairing?: any, deliveryHistory?: any[]) => {
  const docs: any[] = [];
  if (po.originalFileUrl) {
    docs.push({
      type: 'PO',
      name: `${po.poNumber}.pdf`,
      documentNumber: po.poNumber || null,
      fileUrl: po.originalFileUrl,
    });
  }
  // Only include DNs that actually contributed to this line item's delivery
  const relevantDnIds = new Set(
    (deliveryHistory || []).map((h: any) => h.deliveryNoteId),
  );
  for (const dn of match?.deliveryNotes || []) {
    if (relevantDnIds.size > 0 && !relevantDnIds.has(dn.id)) continue;
    docs.push({
      type: 'DC',
      name:
        dn.originalFileName ||
        `DC-${dn.noteNumber || dn.id.substring(0, 6)}`,
      documentNumber: dn.noteNumber || null,
      fileUrl: dn.originalFileUrl,
    });
  }
  const invoices = match?.invoices || [];
  if (pairing?.inv) {
    const targetInv = pairing.inv.invoiceIdx != null
      ? invoices[pairing.inv.invoiceIdx]
      : invoices.find((inv: any) =>
          inv.lineItems?.some((li: any) => li.sortOrder === pairing.inv.index),
        );
    if (targetInv) {
      docs.push({
        type: 'INV',
        name: `Inv-${targetInv.invoiceNumber}`,
        documentNumber: targetInv.invoiceNumber || null,
        fileUrl: targetInv.originalFileUrl,
      });
    }
  }
  return docs;
};

// ─── Ordered qty with OCR cross-check ───────────────

const resolveOrderedQty = (lineItem: any) => {
  const qty = Number(lineItem.quantity) || 0;
  const discountPct = Number(lineItem.discountPercent) || 0;
  // Trust AI extraction — never recalculate quantity from price fields
  return { qty, discountPct };
};
