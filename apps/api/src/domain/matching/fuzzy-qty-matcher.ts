import { Logger } from '@nestjs/common';
import { LineItemPairing } from './matching.types';
import {
  fuzzyWordMatch,
  extractKeywords,
  extractCoreWords,
  toPairingItem,
  minQtyDiff,
} from './line-item-match-utils';

/** Per-word fuzzy comparison of the first 2-3 Hebrew words in the description */
const shareCorePrefix = (descA: string, descB: string): boolean => {
  const wordsA = extractCoreWords(descA);
  const wordsB = extractCoreWords(descB);
  const minLen = Math.min(wordsA.length, wordsB.length);
  if (minLen < 1) return false;
  for (let i = 0; i < minLen; i++) {
    if (!fuzzyWordMatch(wordsA[i], wordsB[i])) return false;
  }
  return true;
};

/** Keyword overlap check with core-name bonus */
const shareKeyword = (
  a: Set<string>, b: Set<string>, descA: string, descB: string,
): { shared: boolean; overlapRatio: number } => {
  if (a.size === 0 || b.size === 0) return { shared: false, overlapRatio: 0 };
  let sharedCount = 0;
  for (const word of a) {
    if (b.has(word)) { sharedCount++; continue; }
    for (const bWord of b) {
      if (fuzzyWordMatch(word, bWord)) { sharedCount++; break; }
    }
  }
  const minWords = Math.min(a.size, b.size);
  const overlapRatio = sharedCount / minWords;
  const threshold = shareCorePrefix(descA, descB) ? 0.2 : 0.25;
  return { shared: overlapRatio >= threshold, overlapRatio };
};

/** Quantity closeness check (within 10%) */
const qtyClose = (q1: number, q2: number): boolean => {
  if (q1 === 0 || q2 === 0) return false;
  if (q1 === q2) return true;
  const diff = Math.abs(q1 - q2) / Math.max(q1, q2);
  return diff <= 0.1;
};

/** Breakdown-aware: checks if PO qty is close to any quantity in the other item */
const anyQtyClose = (poItem: any, otherItem: any): boolean => {
  const poQty = Number(poItem.quantity) || 0;
  if (poQty === 0) return false;
  if (qtyClose(poQty, Number(otherItem.quantity) || 0)) return true;
  if (Array.isArray(otherItem.quantityBreakdown)) {
    for (const c of otherItem.quantityBreakdown) {
      if (qtyClose(poQty, Number(c.value) || 0)) return true;
    }
  }
  return false;
};

/** Total amount closeness check (within 20%) */
const totalClose = (item1: any, item2: any): boolean => {
  const t1 = Number(item1.totalPrice) || (Number(item1.unitPrice || 0) * Number(item1.quantity || 0));
  const t2 = Number(item2.totalPrice) || (Number(item2.unitPrice || 0) * Number(item2.quantity || 0));
  if (t1 <= 0 || t2 <= 0) return false;
  const diff = Math.abs(t1 - t2) / Math.max(t1, t2);
  return diff <= 0.2;
};

/**
 * Phase 2.5: Fuzzy matching by quantity similarity + shared keywords.
 * Matches items across doc types when:
 * - Quantities are within 10% of each other, OR total amounts are within 20%
 * - Descriptions share at least one significant Hebrew keyword (3+ chars)
 */
export function matchByQuantityAndKeywords(
  poItems: any[], dnItems: any[], invItems: any[],
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
  logger: Logger,
): void {
  let matched = 0;

  // PO → DN matching
  for (let pi = 0; pi < poItems.length; pi++) {
    if (matchedPo.has(pi)) continue;
    const poKw = extractKeywords(poItems[pi].description);
    const poQty = Number(poItems[pi].quantity) || 0;

    let bestDi = -1;
    let bestScore = -Infinity;

    for (let di = 0; di < dnItems.length; di++) {
      if (matchedDn.has(di)) continue;
      const dnKw = extractKeywords(dnItems[di].description);

      const kwResult = shareKeyword(poKw, dnKw, poItems[pi].description, dnItems[di].description);
      if (!kwResult.shared) continue;
      // If keyword overlap is below 50%, require qty or total closeness as confirmation
      if (kwResult.overlapRatio < 0.5) {
        if (!anyQtyClose(poItems[pi], dnItems[di]) && !totalClose(poItems[pi], dnItems[di])) continue;
      }

      const qtyDiff = minQtyDiff(dnItems[di], poQty);
      const normalizedQtyDiff = poQty > 0 ? qtyDiff / poQty : qtyDiff;
      const score = kwResult.overlapRatio * 3 - Math.min(normalizedQtyDiff, 2);
      if (score > bestScore) {
        bestScore = score;
        bestDi = di;
      }
    }

    if (bestDi < 0) continue;

    const entry: { po?: any; dn?: any; inv?: any } = { po: poItems[pi], dn: dnItems[bestDi] };
    const pairing: LineItemPairing = {
      matchSource: 'ai',
      po: toPairingItem(poItems[pi], pi),
      dn: toPairingItem(dnItems[bestDi], bestDi),
    };

    // Also try to find matching invoice item
    for (let ii = 0; ii < invItems.length; ii++) {
      if (matchedInv.has(ii)) continue;
      const invKw = extractKeywords(invItems[ii].description);
      const invQty = Number(invItems[ii].quantity) || 0;
      const invKwResult = shareKeyword(poKw, invKw, poItems[pi].description, invItems[ii].description);
      if (invKwResult.shared && (invKwResult.overlapRatio >= 0.5 || qtyClose(poQty, invQty) || totalClose(poItems[pi], invItems[ii]))) {
        entry.inv = invItems[ii];
        pairing.inv = toPairingItem(invItems[ii], ii);
        matchedInv.add(ii);
        break;
      }
    }

    matchedPo.add(pi);
    matchedDn.add(bestDi);
    itemMap.set(`fuzzy:${pi}:${poItems[pi].description?.trim() || ''}`, entry);
    pairings.push(pairing);
    matched++;
  }

  // PO → INV direct matching (critical when catalog numbers differ between PO and INV)
  for (let pi = 0; pi < poItems.length; pi++) {
    if (matchedPo.has(pi)) continue;
    const poKw = extractKeywords(poItems[pi].description);
    const poQty = Number(poItems[pi].quantity) || 0;

    let bestIi = -1;
    let bestScore = -Infinity;

    for (let ii = 0; ii < invItems.length; ii++) {
      if (matchedInv.has(ii)) continue;
      const invKw = extractKeywords(invItems[ii].description);

      const kwResult = shareKeyword(poKw, invKw, poItems[pi].description, invItems[ii].description);
      if (!kwResult.shared) continue;
      if (kwResult.overlapRatio < 0.5) {
        if (!anyQtyClose(poItems[pi], invItems[ii]) && !totalClose(poItems[pi], invItems[ii])) continue;
      }

      const qtyDiff = minQtyDiff(invItems[ii], poQty);
      const normalizedQtyDiff = poQty > 0 ? qtyDiff / poQty : qtyDiff;
      const score = kwResult.overlapRatio * 3 - Math.min(normalizedQtyDiff, 2);
      if (score > bestScore) {
        bestScore = score;
        bestIi = ii;
      }
    }

    if (bestIi < 0) continue;

    const entry: { po?: any; dn?: any; inv?: any } = { po: poItems[pi], inv: invItems[bestIi] };
    const pairing: LineItemPairing = {
      matchSource: 'ai',
      po: toPairingItem(poItems[pi], pi),
      inv: toPairingItem(invItems[bestIi], bestIi),
    };

    // Also try to find matching DN item
    for (let di = 0; di < dnItems.length; di++) {
      if (matchedDn.has(di)) continue;
      const dnKw = extractKeywords(dnItems[di].description);
      const dnQty = Number(dnItems[di].quantity) || 0;
      const dnKwResult = shareKeyword(poKw, dnKw, poItems[pi].description, dnItems[di].description);
      if (dnKwResult.shared && (dnKwResult.overlapRatio >= 0.5 || qtyClose(poQty, dnQty) || totalClose(poItems[pi], dnItems[di]))) {
        entry.dn = dnItems[di];
        pairing.dn = toPairingItem(dnItems[di], di);
        matchedDn.add(di);
        break;
      }
    }

    matchedPo.add(pi);
    matchedInv.add(bestIi);
    itemMap.set(`fuzzy:po-inv:${pi}:${poItems[pi].description?.trim() || ''}`, entry);
    pairings.push(pairing);
    matched++;
  }

  // INV → DN matching (items not covered by PO matching above)
  for (let ii = 0; ii < invItems.length; ii++) {
    if (matchedInv.has(ii)) continue;
    const invKw = extractKeywords(invItems[ii].description);

    for (let di = 0; di < dnItems.length; di++) {
      if (matchedDn.has(di)) continue;
      const dnKw = extractKeywords(dnItems[di].description);

      const invDnResult = shareKeyword(invKw, dnKw, invItems[ii].description, dnItems[di].description);
      if (!invDnResult.shared) continue;
      if (invDnResult.overlapRatio < 0.5) {
        if (!anyQtyClose(invItems[ii], dnItems[di]) && !totalClose(invItems[ii], dnItems[di])) continue;
      }

      itemMap.set(`fuzzy:inv:${ii}:${dnItems[di].description?.trim() || ''}`, { dn: dnItems[di], inv: invItems[ii] });
      pairings.push({
        matchSource: 'ai',
        dn: toPairingItem(dnItems[di], di),
        inv: toPairingItem(invItems[ii], ii),
      });
      matchedDn.add(di);
      matchedInv.add(ii);
      matched++;
      break;
    }
  }

  if (matched > 0) {
    logger.log(`Phase 2.5 (fuzzy qty+keywords): matched ${matched} item groups`);
  }
}
