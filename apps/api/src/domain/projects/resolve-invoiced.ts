import { normalize } from './resolve-received';

/** Check if two descriptions are similar (word overlap >= 60%) */
const descriptionsSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  const wordsA = a.split(/\s+/).filter((w) => w.length > 2);
  const wordsB = b.split(/\s+/).filter((w) => w.length > 2);
  if (wordsA.length < 3 || wordsB.length < 3) return false;
  const common = wordsA.filter((w) => wordsB.includes(w));
  return common.length / Math.max(wordsA.length, wordsB.length) >= 0.6;
};

export const resolveInvoiced = (
  pairing: any,
  pairings: any[],
  match: any,
  override: { invoicedQty?: number } | undefined,
  receivedQty: number,
  lineItem: any,
  orderedQty?: number,
  poUnitPrice?: number,
  crossMatchExcludedInvLineIds?: Set<string>,
) => {
  let status: 'matched' | 'mismatch' | 'pending' = 'pending';
  let amount: number | null = null;
  let unitPrice: number | null = null;
  let total: number | null = null;
  let mismatchReason: string | null = null;

  if (override?.invoicedQty != null) {
    amount = override.invoicedQty;
  } else if (pairing?.inv) {
    const allInvoices = match?.invoices || [];

    // Find ALL pairings for this PO line that have invoice data
    const poId = lineItem.id;
    const poIndex = pairing?.po?.index ?? lineItem.sortOrder;
    const invPairings = pairings.filter((p: any) => {
      if (!p?.inv) return false;
      if (p?.po?.id && p.po.id === poId) return true;
      if (p?.po?.index === poIndex) return true;
      return false;
    });
    // Fallback to the primary pairing if no filtered results
    if (invPairings.length === 0) invPairings.push(pairing);

    // Aggregate invoice quantities from all matching pairings
    const seenInvLineIds = new Set<string>();
    let aggQty = 0;
    let aggTotal = 0;
    let lastUnitPrice = 0;

    for (const ip of invPairings) {
      // Find the actual invoice line item
      let invLi: any = null;
      if (ip.inv.id) {
        for (const inv of allInvoices) {
          invLi = inv.lineItems?.find((li: any) => li.id === ip.inv.id);
          if (invLi) break;
        }
      }
      if (!invLi) {
        const targetInvs = ip.inv.invoiceIdx != null
          ? [allInvoices[ip.inv.invoiceIdx]].filter(Boolean)
          : allInvoices;
        for (const inv of targetInvs) {
          invLi = inv.lineItems?.find((li: any) => li.sortOrder === ip.inv.index);
          if (invLi) break;
        }
      }

      if (invLi) {
        // Deduplicate by invoice line ID
        if (invLi.id && seenInvLineIds.has(invLi.id)) continue;
        // Skip invoice lines claimed by other PO matches (multi-PO sharing same invoices)
        // But allow the FIRST (primary) invoice line through — same logic as DN Pass 0
        if (invLi.id && crossMatchExcludedInvLineIds?.has(invLi.id) && seenInvLineIds.size > 0) continue;
        if (invLi.id) seenInvLineIds.add(invLi.id);

        const tp = Number(invLi.totalPrice) || 0;
        const up = Number(invLi.unitPrice) || 0;
        const storedQty = Number(invLi.quantity) || Number(ip.inv.quantity) || 0;
        const derivedQty = (tp > 0 && up > 0) ? Math.round((tp / up) * 1000) / 1000 : 0;
        // Prefer stored quantity; only use derived if stored is missing or significantly different
        const qty = storedQty > 0
          ? storedQty
          : (derivedQty > 0 ? derivedQty : (Number(ip.inv.quantity) || 0));
        aggQty += qty;
        aggTotal += tp;
        if (up > 0) lastUnitPrice = up;
      } else {
        aggQty += Number(ip.inv.quantity) || 0;
      }
    }

    amount = aggQty;
    if (lastUnitPrice > 0) unitPrice = lastUnitPrice;
    if (aggTotal > 0) total = aggTotal;

    // Settlement invoice line: when the invoice line is a single settlement
    // covering the entire PO (e.g. "גמר חשבון - הזמנת רכש 25000432")
    if (amount != null && pairing?.inv && pairing?.po) {
      const invDesc = (pairing.inv.description || '').toLowerCase();
      const isSettlement = ['גמר חשבון', 'מקדמה', 'תשלום ע"ח', 'סה"כ עבודות'].some(kw => invDesc.includes(kw));

      if (isSettlement) {
        // Settlement line covers entire PO line(s) — invoiced qty = ordered qty
        const thisOrd = Number(lineItem.quantity) || 0;
        amount = thisOrd;

        // Deduplicate PO items by index for proportional distribution
        const seenPoIdx = new Set<number>();
        let poTotalValue = 0;
        for (const p of pairings) {
          if (!p?.po) continue;
          const idx = p.po.index;
          if (seenPoIdx.has(idx)) continue;
          seenPoIdx.add(idx);
          poTotalValue += (Number(p.po.quantity) || 0) * (Number(p.po.unitPrice) || 0);
        }

        const thisLineValue = thisOrd * (Number(lineItem.unitPrice) || 0);

        // If settlement covers the full PO, distribute total proportionally
        if (total != null && poTotalValue > 0 && thisLineValue > 0) {
          const coversFull = Math.abs(total - poTotalValue) / poTotalValue < 0.15;
          if (coversFull && seenPoIdx.size > 1) {
            total = Math.round(total * (thisLineValue / poTotalValue) * 100) / 100;
          }
        }

        // Fix unitPrice: derive from total/qty instead of settlement's misleading unitPrice
        if (total != null && amount > 0) {
          unitPrice = Math.round((total / amount) * 100) / 100;
        }
      }
    }

    // Consolidated invoice line: when one invoice line
    // covers multiple PO lines with the same description.
    if (amount != null && pairing.po) {
      const poDesc = normalize(pairing.po.description || '');
      const poCat = (pairing.po.catalogNumber || '').trim();
      const thisOrd = Number(lineItem.quantity) || 0;

      const siblings = pairings.filter(
        (p: any) =>
          p !== pairing &&
          p?.po &&
          (normalize(p.po.description || '') === poDesc ||
           (poCat && (p.po.catalogNumber || '').trim() === poCat) ||
           descriptionsSimilar(
             poDesc, normalize(p.po.description || ''),
           )),
      );

      if (siblings.length > 0 && thisOrd > 0) {
        const totalOrdered = siblings.reduce(
          (sum: number, p: any) =>
            sum + (Number(p.po.quantity) || 0),
          thisOrd,
        );

        if (
          totalOrdered > 0 &&
          Math.abs(amount - totalOrdered) / totalOrdered < 0.05
        ) {
          const share =
            Math.round((amount * (thisOrd / totalOrdered)) * 100) / 100;
          amount = share;
          if (total != null && totalOrdered > 0) {
            total =
              Math.round((total * (thisOrd / totalOrdered)) * 100) / 100;
          }
        }
      }
    }
  }

  if (amount != null) {
    const rInv = Math.round(amount * 100) / 100;
    const rRcv = Math.round(receivedQty * 100) / 100;
    if (rInv === rRcv) {
      status = 'matched';
    } else {
      status = 'mismatch';
      const diff = rInv - rRcv;
      const rOrd =
        Math.round((orderedQty ?? (Number(lineItem.quantity) || 0)) * 100) / 100;
      mismatchReason =
        diff > 0
          ? `חויב: ${rInv} | התקבל: ${rRcv} | ` +
            `הוזמן: ${rOrd} (עודף: ${Math.abs(diff).toFixed(2)})`
          : `חויב: ${rInv} | התקבל: ${rRcv} | ` +
            `הוזמן: ${rOrd} (חוסר: ${Math.abs(diff).toFixed(2)})`;
    }
  }

  return { status, amount, unitPrice, total, mismatchReason };
};
