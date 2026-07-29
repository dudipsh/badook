import { Logger } from '@nestjs/common';
import { unitsMatch } from '../matching/unit-utils';

const logger = new Logger('QtyConverter');

/**
 * Derive converted qty from invoice totalPrice/unitPrice.
 * Tries: 1) explicit pairing index, 2) catalog number, 3) keyword overlap.
 */
export const deriveQtyFromInvoice = (
  pairing: any,
  match: any,
  dnDescription?: string,
  dnCatalogNumber?: string,
): number | null => {
  if (!match?.invoices?.length) return null;

  // Skip settlement/consolidated invoice lines — their qty (tp/up) is meaningless
  const settlementKw = ['גמר חשבון', 'מקדמה', 'תשלום ע"ח', 'סה"כ עבודות', 'הזמנת רכש'];
  const isSettlementLine = (desc: string | undefined) =>
    desc && settlementKw.some(kw => desc.toLowerCase().includes(kw));

  // 1) Try explicit pairing — search by ID across all invoices first
  if (pairing?.inv && !isSettlementLine(pairing.inv.description)) {
    let invLi: any = null;
    if (pairing.inv.id) {
      for (const inv of match.invoices) {
        invLi = inv.lineItems?.find((li: any) => li.id === pairing.inv.id);
        if (invLi) break;
      }
    }
    if (!invLi) {
      const targetInvs = pairing.inv.invoiceIdx != null
        ? [match.invoices[pairing.inv.invoiceIdx]].filter(Boolean)
        : match.invoices;
      for (const inv of targetInvs) {
        invLi = inv.lineItems?.find((li: any) => li.sortOrder === pairing.inv.index);
        if (invLi) break;
      }
    }
    if (invLi && !isSettlementLine(invLi.description)) {
      const tp = Number(invLi.totalPrice) || 0;
      const up = Number(invLi.unitPrice) || 0;
      if (tp > 0 && up > 0) {
        return Math.round((tp / up) * 1000) / 1000;
      }
    }
  }

  // 2) Search by catalog number
  if (dnCatalogNumber) {
    const cat = dnCatalogNumber.trim();
    for (const inv of match.invoices) {
      for (const invLi of inv.lineItems || []) {
        if (isSettlementLine(invLi.description)) continue;
        if ((invLi.catalogNumber || '').trim() !== cat) continue;
        const tp = Number(invLi.totalPrice) || 0;
        const up = Number(invLi.unitPrice) || 0;
        if (tp > 0 && up > 0) {
          return Math.round((tp / up) * 1000) / 1000;
        }
      }
    }
  }

  // 3) Search by keyword overlap (>= 50% of words must match)
  const desc = (
    dnDescription || pairing?.dn?.description || ''
  ).trim().toLowerCase();
  if (!desc) return null;

  const descWords = desc
    .replace(/[()"/\-,.:;!?\n]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length >= 3);
  if (descWords.length === 0) return null;

  for (const inv of match.invoices) {
    for (const invLi of inv.lineItems || []) {
      if (isSettlementLine(invLi.description)) continue;
      const invDesc = (invLi.description || '').trim().toLowerCase();
      if (!invDesc) continue;
      const invWords = invDesc
        .replace(/[()"/\-,.:;!?\n]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3);
      const common = descWords.filter((w: string) =>
        invWords.includes(w),
      );
      const overlap =
        common.length /
        Math.max(descWords.length, invWords.length);
      if (overlap < 0.5) continue;
      const tp = Number(invLi.totalPrice) || 0;
      const up = Number(invLi.unitPrice) || 0;
      if (tp > 0 && up > 0) {
        return Math.round((tp / up) * 1000) / 1000;
      }
    }
  }

  return null;
};

/**
 * Try to convert DN qty to PO units.
 * 1) Check quantityBreakdown for matching unit
 * 2) For cross-unit: derive from invoice totalPrice/unitPrice
 * 3) Length-factor conversion from PO description
 */
export const convertQtyIfNeeded = (
  qty: number,
  unit: string | null,
  poUnit: string | null,
  li: any,
  pairing: any,
  match: any,
): { qty: number; unit: string | null } => {
  if (!poUnit) return { qty, unit };

  const sameUnit = unitsMatch(unit, poUnit);

  // Check breakdown for matching dimension
  if (!sameUnit && Array.isArray(li.quantityBreakdown)) {
    const bdMatch = li.quantityBreakdown.find(
      (c: any) => unitsMatch(c.unit, poUnit),
    );
    if (bdMatch) {
      return {
        qty: Number(bdMatch.value) || qty,
        unit: bdMatch.unit,
      };
    }
  }

  // Derive qty from invoice totalPrice/unitPrice
  const dnDesc = li.description || pairing?.dn?.description || '';
  const dnCat = li.catalogNumber || pairing?.dn?.catalogNumber || '';
  const invQty = deriveQtyFromInvoice(pairing, match, dnDesc, dnCat);

  if (invQty != null && !sameUnit) {
    const diff = Math.abs(invQty - qty) / Math.max(qty, 1);
    if (diff > 0.05) {
      logger.log(
        `[CONVERT] invoice-derived: ${qty} → ${invQty} (${unit} → ${poUnit})`,
      );
      return { qty: invQty, unit: poUnit };
    }
  }

  // Same-unit invoice-derived correction: DISABLED
  // When DN and PO use the same unit, differences in quantity are almost always
  // partial deliveries (e.g., DN=890 vs PO=2400). Overriding with invoice-derived
  // qty corrupts the actual received count. Only cross-unit conversions are valid.

  // Length-factor: PO says "אורך 3.5" → 920 pieces × 3.5 = 3220 מ"א
  if (sameUnit && pairing?.po?.quantity) {
    const poQty = Number(pairing.po.quantity) || 0;
    const poDescText: string = pairing.po?.description || '';
    const lengthMatch = poDescText.match(
      /אורך\s+(\d+(?:[.,]\d+)?)/,
    );
    if (lengthMatch && poQty > 0) {
      const lengthFactor = Number(
        lengthMatch[1].replace(',', '.'),
      );
      if (lengthFactor > 1) {
        const convertedQty =
          Math.round(qty * lengthFactor * 1000) / 1000;
        if (qty < poQty * 0.5 && convertedQty > poQty * 0.5) {
          logger.log(
            `[CONVERT] length-factor: ${qty} × ${lengthFactor} = ${convertedQty}`,
          );
          return { qty: convertedQty, unit: poUnit };
        }
      }
    }
  }

  return { qty, unit };
};
