import { Logger } from '@nestjs/common';
import { LineItemPairing, PairingItem } from './matching.types';
import { fuzzyHebrewWordMatch } from './line-item-match-utils';

const SETTLEMENT_KEYWORDS = ['גמר חשבון', 'מקדמה', 'תשלום ע"ח', 'סה"כ עבודות', 'הזמנת רכש'];

/** Check if two descriptions share at least 1 non-numeric keyword */
export const descriptionsOverlap = (
  a?: string,
  b?: string,
  pairingItem1?: PairingItem,
  pairingItem2?: PairingItem,
): boolean => {
  if (!a || !b) return true;
  // Consolidated invoice lines always overlap (settlement covers entire PO)
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (SETTLEMENT_KEYWORDS.some(kw => aLower.includes(kw) || bLower.includes(kw))) {
    return true;
  }
  const kw = (s: string) =>
    s.replace(/[()"\/\-,.:;!?\n]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 || (w.length === 2 && /^\d+$/.test(w)))
      .map((w) => w.toLowerCase());
  const kwA = kw(a);
  const kwB = kw(b);
  if (kwA.length === 0 || kwB.length === 0) return true;
  // Check for at least one non-numeric keyword match
  const hasKeywordMatch = kwA.some((w) => !/^\d+$/.test(w) && kwB.some((w2) => fuzzyHebrewWordMatch(w, w2)));
  if (hasKeywordMatch) return true;
  // Bypass: allow pairing if qty matches exactly or total amounts are close
  // This prevents rejecting valid matches where PO/DN describe the same product differently
  if (pairingItem1 && pairingItem2) {
    const q1 = Number(pairingItem1.quantity) || 0;
    const q2 = Number(pairingItem2.quantity) || 0;
    if (q1 > 0 && q2 > 0 && q1 === q2) return true;
    const t1 = Number(pairingItem1.totalPrice) || 0;
    const t2 = Number(pairingItem2.totalPrice) || 0;
    if (t1 > 0 && t2 > 0 && Math.abs(t1 - t2) / Math.max(t1, t2) <= 0.1) return true;
  }
  return false;
};

/**
 * Reject cross-document pairings where descriptions
 * share zero keywords. Strips the bad part (inv/dn)
 * from the pairing so orphans can be re-matched later.
 */
export const validatePairings = (
  pairings: LineItemPairing[],
  matchedPo?: Set<number>,
  matchedDn?: Set<number>,
  matchedInv?: Set<number>,
  logger?: Logger,
) => {
  let rejected = 0;

  for (const p of pairings) {
    if (p.po && p.inv) {
      if (!descriptionsOverlap(
        p.po.description, p.inv.description, p.po, p.inv,
      )) {
        logger?.warn(
          `[PAIR-REJECT] PO "${p.po.description?.slice(0, 25)}" ` +
          `↔ INV "${p.inv.description?.slice(0, 25)}" — ` +
          `zero keyword overlap`,
        );
        if (matchedInv) matchedInv.delete(p.inv.index);
        p.inv = undefined;
        rejected++;
      }
    }
    if (p.po && p.dn) {
      if (!descriptionsOverlap(
        p.po.description, p.dn.description, p.po, p.dn,
      )) {
        logger?.warn(
          `[PAIR-REJECT] PO "${p.po.description?.slice(0, 25)}" ` +
          `↔ DN "${p.dn.description?.slice(0, 25)}" — ` +
          `zero keyword overlap`,
        );
        if (matchedDn) matchedDn.delete(p.dn.index);
        p.dn = undefined;
        rejected++;
      }
    }
  }

  if (rejected > 0) {
    logger?.warn(
      `[PAIR-REJECT] Removed ${rejected} bad pairing(s)`,
    );
  }
};
