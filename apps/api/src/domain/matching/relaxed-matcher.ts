import { Logger } from '@nestjs/common';
import { LineItemPairing } from './matching.types';
import { fuzzyHebrewWordMatch, toPairingItem, minQtyDiff } from './line-item-match-utils';

// ─── Scoring thresholds ───
const PRICE_MATCH_PCT = 0.05;     // 5% unit price tolerance
const QTY_CLOSE_PCT = 0.15;       // 15% quantity tolerance
const QTY_EXACT_PCT = 0.02;       // 2% "exact" quantity tolerance
const TOTAL_EXACT_PCT = 0.02;     // 2% total price "exact"
const TOTAL_CLOSE_PCT = 0.2;      // 20% total price "close"
const KW_OVERLAP_HIGH = 0.7;      // 70%+ keyword overlap → strong match
const KW_OVERLAP_MED = 0.5;       // 50%+ keyword overlap → medium match

// ─── Match scores (higher = more confident) ───
const SCORE_PRICE_KW = 60;        // unit price match + keyword overlap
const SCORE_PRICE_QTY = 55;       // unit price match + exact quantity
const SCORE_BONUS_QTY = 20;       // bonus for quantity match on top of price+kw
const SCORE_BONUS_KW = 15;        // bonus for keyword overlap on top of price+qty

const extractKw = (desc: string): string[] => {
  return (desc || '').replace(/[()"/\-,.:;!?*]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 || (w.length === 2 && /^\d+$/.test(w)))
    .map((w) => w.toLowerCase());
};

const hasAnyOverlap = (kwA: string[], kwB: string[]): boolean => {
  for (const a of kwA) {
    for (const b of kwB) {
      if (fuzzyHebrewWordMatch(a, b)) return true;
    }
  }
  return false;
};

const getQty = (item: any) => Number(item.quantity) || 0;

const getTotal = (item: any) => {
  const t = Number(item.totalPrice);
  if (t > 0) return t;
  return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
};

/** Remove a solo-orphan pairing entry from the pairings array */
const removeOrphanPairing = (
  pairings: LineItemPairing[], idx: number, docType: 'po' | 'dn' | 'inv',
) => {
  for (let pi = pairings.length - 1; pi >= 0; pi--) {
    const p = pairings[pi];
    const docCount = [p.po, p.dn, p.inv].filter(Boolean).length;
    if (docCount > 1) continue;
    if (p[docType] && p[docType]!.index === idx) {
      pairings.splice(pi, 1);
      break;
    }
  }
};

/** PO → INV matching by unit price + keywords (handles cross-vendor catalog mismatches) */
const matchPoInvByPrice = (
  orphanPo: { item: any; i: number }[],
  orphanInv: { item: any; i: number }[],
  orphanDn: { item: any; i: number }[],
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
): number => {
  let matched = 0;

  for (const po of orphanPo) {
    if (matchedPo.has(po.i)) continue;
    const poUP = Number(po.item.unitPrice) || 0;
    const poQty = getQty(po.item);
    const poKw = extractKw(po.item.description);
    if (poUP <= 0) continue;

    let bestII = -1;
    let bestScore = -Infinity;

    for (let ii = 0; ii < orphanInv.length; ii++) {
      if (matchedInv.has(orphanInv[ii].i)) continue;
      const invItem = orphanInv[ii].item;
      const invUP = Number(invItem.unitPrice) || 0;
      const invQty = getQty(invItem);
      const invKw = extractKw(invItem.description);

      if (invUP <= 0) continue;

      const priceMatch = Math.abs(poUP - invUP) / Math.max(poUP, invUP) <= PRICE_MATCH_PCT;
      if (!priceMatch) continue;

      const overlap = hasAnyOverlap(poKw, invKw);
      const qtyMatch = poQty > 0 && invQty > 0 && Math.abs(poQty - invQty) / Math.max(poQty, invQty) <= QTY_CLOSE_PCT;

      if (overlap) {
        const score = SCORE_PRICE_KW + (qtyMatch ? SCORE_BONUS_QTY : 0);
        if (score > bestScore) { bestScore = score; bestII = ii; }
      }

      if (poQty > 0 && invQty > 0 && Math.abs(poQty - invQty) / Math.max(poQty, invQty) <= QTY_EXACT_PCT) {
        const score = SCORE_PRICE_QTY + (overlap ? SCORE_BONUS_KW : 0);
        if (score > bestScore) { bestScore = score; bestII = ii; }
      }
    }

    if (bestII >= 0) {
      const invRef = orphanInv[bestII];
      removeOrphanPairing(pairings, po.i, 'po');
      removeOrphanPairing(pairings, invRef.i, 'inv');

      const entry: { po?: any; dn?: any; inv?: any } = { po: po.item, inv: invRef.item };
      const pairing: LineItemPairing = {
        matchSource: 'relaxed',
        po: toPairingItem(po.item, po.i),
        inv: toPairingItem(invRef.item, invRef.i),
      };

      // Try to also find matching DN
      for (const dn of orphanDn) {
        if (matchedDn.has(dn.i)) continue;
        const dnQty = getQty(dn.item);
        const dnKw = extractKw(dn.item.description);
        if (hasAnyOverlap(poKw, dnKw) && (Math.abs(poQty - dnQty) / Math.max(poQty, dnQty) <= 0.15 || poQty === 0)) {
          entry.dn = dn.item;
          pairing.dn = toPairingItem(dn.item, dn.i);
          removeOrphanPairing(pairings, dn.i, 'dn');
          matchedDn.add(dn.i);
          break;
        }
      }

      matchedPo.add(po.i);
      matchedInv.add(invRef.i);
      itemMap.set(`price:${po.i}:${po.item.description?.slice(0, 30) || ''}`, entry);
      pairings.push(pairing);
      matched++;
    }
  }

  return matched;
};

/** PO → DN relaxed matching loop with multiple scoring strategies */
const matchPoDn = (
  orphanPo: { item: any; i: number }[],
  orphanDn: { item: any; i: number }[],
  orphanInv: { item: any; i: number }[],
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
): number => {
  let matched = 0;

  for (const po of orphanPo) {
    if (matchedPo.has(po.i)) continue;
    const poQty = getQty(po.item);
    const poTotal = getTotal(po.item);
    const poKw = extractKw(po.item.description);

    let bestDi = -1;
    let bestScore = -Infinity;

    for (let di = 0; di < orphanDn.length; di++) {
      if (matchedDn.has(orphanDn[di].i)) continue;
      const dnItem = orphanDn[di].item;
      const dnQty = getQty(dnItem);
      const dnTotal = getTotal(dnItem);
      const dnKw = extractKw(dnItem.description);

      const qtyExact = poQty > 0 && dnQty > 0 && (poQty === dnQty || minQtyDiff(dnItem, poQty) === 0);
      const qtyClose = qtyExact || (poQty > 0 && dnQty > 0 && Math.abs(poQty - dnQty) / Math.max(poQty, dnQty) <= QTY_CLOSE_PCT);

      // Strategy 1: Exact qty + exact total
      const totalExact = poTotal > 0 && dnTotal > 0 && Math.abs(poTotal - dnTotal) / Math.max(poTotal, dnTotal) <= TOTAL_EXACT_PCT;
      if (qtyExact && totalExact) {
        bestDi = di;
        bestScore = 100;
        break;
      }

      // Strategy 2: Close qty + at least 1 shared keyword
      const overlap = hasAnyOverlap(poKw, dnKw);
      if (qtyClose && overlap) {
        const score = (qtyExact ? 10 : 0) + (totalExact ? 5 : 0);
        if (score > bestScore) { bestScore = score; bestDi = di; }
      }

      // Strategy 3: Exact qty + close total
      const totalCloseVal = poTotal > 0 && dnTotal > 0 && Math.abs(poTotal - dnTotal) / Math.max(poTotal, dnTotal) <= TOTAL_CLOSE_PCT;
      if (qtyExact && totalCloseVal && bestScore < 5) {
        bestScore = 5;
        bestDi = di;
      }

      // Count shared keywords (used by strategies 4, 6, 7)
      let kwShared = 0;
      if (poKw.length >= 2 && dnKw.length >= 2) {
        for (const a of poKw) {
          for (const b of dnKw) {
            if (a === b || fuzzyHebrewWordMatch(a, b)) { kwShared++; break; }
          }
        }
      }

      // Strategy 4: Keyword overlap (70%+ or 50%+ with close qty)
      if (poKw.length >= 2 && dnKw.length >= 2) {
        const minKw = Math.min(poKw.length, dnKw.length);
        const kwOverlapRatio = kwShared / minKw;
        if (kwOverlapRatio >= KW_OVERLAP_HIGH) {
          const score = 50 + kwOverlapRatio * 10 + (qtyClose ? 5 : 0);
          if (score > bestScore) { bestScore = score; bestDi = di; }
        } else if (kwOverlapRatio >= KW_OVERLAP_MED && qtyClose) {
          const score = 35 + kwOverlapRatio * 10 + (qtyExact ? 5 : 0) + (totalCloseVal ? 3 : 0);
          if (score > bestScore) { bestScore = score; bestDi = di; }
        }
      }

      // Strategy 5: Shared dimension numbers + at least 1 Hebrew keyword match
      const poNums = (po.item.description || '').match(/\d+[/x×]\d+/g) || [];
      const dnNums = (dnItem.description || '').match(/\d+[/x×]\d+/g) || [];
      if (poNums.length > 0 && dnNums.length > 0) {
        const sharedDim = poNums.some((pn: string) => dnNums.some((dn: string) => pn === dn));
        if (sharedDim && overlap) {
          const score = 40 + (qtyClose ? 10 : 0) + (totalCloseVal ? 5 : 0);
          if (score > bestScore) { bestScore = score; bestDi = di; }
        }
      }

      // Strategy 6: Close qty (15%) + at least 2 fuzzy keyword matches
      if (qtyClose && kwShared >= 2) {
        const score = 30 + kwShared * 3 + (totalCloseVal ? 5 : 0);
        if (score > bestScore) { bestScore = score; bestDi = di; }
      }

      // Strategy 7: Proportional word matching — relaxed matching based on
      // word count ratio + quantity/price signals.
      // If product has 4+ words and 3+ match + same qty → match.
      // If product has 5+ words and 3+ match + qty close + price/total close → match.
      const maxKwCount = Math.max(poKw.length, dnKw.length);
      const poUP = Number(po.item.unitPrice) || 0;
      const dnUP = Number(dnItem.unitPrice) || 0;
      const priceClose = poUP > 0 && dnUP > 0 && Math.abs(poUP - dnUP) / Math.max(poUP, dnUP) <= QTY_CLOSE_PCT;

      if (kwShared >= 3 && maxKwCount >= 4 && qtyExact) {
        const score = 45 + kwShared * 2 + (priceClose ? 5 : 0) + (totalCloseVal ? 3 : 0);
        if (score > bestScore) { bestScore = score; bestDi = di; }
      }
      if (kwShared >= 3 && maxKwCount >= 5 && qtyClose && (priceClose || totalCloseVal)) {
        const score = 42 + kwShared * 2 + (qtyExact ? 5 : 0);
        if (score > bestScore) { bestScore = score; bestDi = di; }
      }
      // Even 2 matching words + exact qty + close price → match (for short descriptions)
      if (kwShared >= 2 && maxKwCount >= 3 && qtyExact && priceClose) {
        const score = 38 + kwShared * 2;
        if (score > bestScore) { bestScore = score; bestDi = di; }
      }
    }

    if (bestDi >= 0) {
      const dnRef = orphanDn[bestDi];
      removeOrphanPairing(pairings, po.i, 'po');
      removeOrphanPairing(pairings, dnRef.i, 'dn');

      const entry: { po?: any; dn?: any; inv?: any } = { po: po.item, dn: dnRef.item };
      const pairing: LineItemPairing = {
        matchSource: 'relaxed',
        po: toPairingItem(po.item, po.i),
        dn: toPairingItem(dnRef.item, dnRef.i),
      };

      // Try to also match an invoice orphan
      for (const inv of orphanInv) {
        if (matchedInv.has(inv.i)) continue;
        const invQty = getQty(inv.item);
        const invKw = extractKw(inv.item.description);
        if (invQty === getQty(po.item) && hasAnyOverlap(poKw, invKw)) {
          entry.inv = inv.item;
          pairing.inv = toPairingItem(inv.item, inv.i);
          removeOrphanPairing(pairings, inv.i, 'inv');
          matchedInv.add(inv.i);
          break;
        }
      }

      matchedPo.add(po.i);
      matchedDn.add(dnRef.i);
      itemMap.set(`relaxed:${po.i}:${po.item.description?.slice(0, 30) || ''}`, entry);
      pairings.push(pairing);
      matched++;
    }
  }

  return matched;
};

/** Process of elimination: if exactly 1 PO orphan and 1 DN orphan remain, match them */
const matchByElimination = (
  poItems: any[], dnItems: any[],
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>, matchedDn: Set<number>,
  logger: Logger,
): number => {
  const finalPo = poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i));
  const finalDn = dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i));

  if (finalPo.length !== 1 || finalDn.length !== 1) return 0;

  const po = finalPo[0];
  const dn = finalDn[0];
  removeOrphanPairing(pairings, po.i, 'po');
  removeOrphanPairing(pairings, dn.i, 'dn');

  const entry: { po?: any; dn?: any; inv?: any } = { po: po.item, dn: dn.item };
  const pairing: LineItemPairing = {
    matchSource: 'relaxed',
    po: toPairingItem(po.item, po.i),
    dn: toPairingItem(dn.item, dn.i),
  };

  matchedPo.add(po.i);
  matchedDn.add(dn.i);
  itemMap.set(`elimination:${po.i}`, entry);
  pairings.push(pairing);
  logger.log(`Relaxed pass: process of elimination matched last PO↔DN orphan pair`);
  return 1;
};

/**
 * Final relaxed matching pass for remaining orphans.
 * After all other phases (catalog, fuzzy, AI, AI second-round) failed,
 * this pass uses very relaxed criteria:
 * 1. Exact qty + exact price → match
 * 2. Exact qty + at least 1 shared keyword → match
 * 3. Process of elimination: if only 1 PO orphan and 1 DN orphan remain → match
 */
export function relaxedOrphanMatching(
  poItems: any[], dnItems: any[], invItems: any[],
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
  logger: Logger,
): void {
  const orphanPo = poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i));
  const orphanDn = dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i));
  const orphanInv = invItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedInv.has(i));

  if (orphanPo.length === 0 || (orphanDn.length === 0 && orphanInv.length === 0)) return;

  // First try PO→INV matching by unit price (handles cross-vendor catalog mismatches)
  let matched = matchPoInvByPrice(
    orphanPo, orphanInv, orphanDn,
    itemMap, pairings, matchedPo, matchedDn, matchedInv,
  );

  // Rebuild orphan lists after price-based matching
  const remainingOrphanPo = poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i));
  const remainingOrphanDn = dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i));
  const remainingOrphanInv = invItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedInv.has(i));

  matched += matchPoDn(
    remainingOrphanPo, remainingOrphanDn, remainingOrphanInv,
    itemMap, pairings, matchedPo, matchedDn, matchedInv,
  );

  matched += matchByElimination(
    poItems, dnItems, itemMap, pairings, matchedPo, matchedDn, logger,
  );

  if (matched > 0) {
    logger.log(`Relaxed pass: matched ${matched} orphan pairs by qty/price/elimination`);
  }
}
