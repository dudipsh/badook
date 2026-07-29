import {
  LineItemPairing,
  MatchingLineItem,
  ItemMapEntry,
  IndexedLineItemRef,
} from './matching.types';
import { toPairingItem, minQtyDiff } from './line-item-match-utils';

/**
 * Greedy matching of items across document types by closest quantity.
 * Returns an array of matched triples (po, dn, inv) — any side may be undefined.
 */
const greedyMatchByQuantity = (
  poRefs: IndexedLineItemRef[],
  dnRefs: IndexedLineItemRef[],
  invRefs: IndexedLineItemRef[],
): { po?: IndexedLineItemRef; dn?: IndexedLineItemRef; inv?: IndexedLineItemRef }[] => {
  const results: { po?: IndexedLineItemRef; dn?: IndexedLineItemRef; inv?: IndexedLineItemRef }[] = [];
  const usedDn = new Set<number>();
  const usedInv = new Set<number>();

  const getQty = (ref: IndexedLineItemRef) => Number(ref.item.quantity) || 0;

  const findClosest = (
    targetQty: number,
    refs: IndexedLineItemRef[],
    usedSet: Set<number>,
  ): IndexedLineItemRef | undefined => {
    let best: IndexedLineItemRef | undefined;
    let bestDiff = Infinity;
    let bestLocalIdx = -1;
    for (let i = 0; i < refs.length; i++) {
      if (usedSet.has(i)) continue;
      const diff = minQtyDiff(refs[i].item, targetQty);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = refs[i];
        bestLocalIdx = i;
        if (diff === 0) break;
      }
    }
    if (best && bestLocalIdx >= 0) usedSet.add(bestLocalIdx);
    return best;
  };

  for (const poRef of poRefs) {
    const poQty = getQty(poRef);
    const dnRef = dnRefs.length > 0 ? findClosest(poQty, dnRefs, usedDn) : undefined;
    const invRef = invRefs.length > 0 ? findClosest(poQty, invRefs, usedInv) : undefined;
    results.push({ po: poRef, dn: dnRef, inv: invRef });
  }

  for (let i = 0; i < dnRefs.length; i++) {
    if (usedDn.has(i)) continue;
    usedDn.add(i);
    const dnQty = getQty(dnRefs[i]);
    const invRef = invRefs.length > 0 ? findClosest(dnQty, invRefs, usedInv) : undefined;
    results.push({ dn: dnRefs[i], inv: invRef });
  }

  for (let i = 0; i < invRefs.length; i++) {
    if (usedInv.has(i)) continue;
    usedInv.add(i);
    results.push({ inv: invRefs[i] });
  }

  return results;
};

/**
 * Phase 1: Match line items by exact catalog number.
 * Groups items by catalog number, then uses greedy quantity matching within each group.
 */
export const matchByCatalog = (
  poItems: MatchingLineItem[],
  dnItems: MatchingLineItem[],
  invItems: MatchingLineItem[],
  itemMap: Map<string, ItemMapEntry>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  matchedDn: Set<number>,
  matchedInv: Set<number>,
) => {
  const catalogMap = new Map<string, { po: IndexedLineItemRef[]; dn: IndexedLineItemRef[]; inv: IndexedLineItemRef[] }>();

  for (let i = 0; i < poItems.length; i++) {
    if (matchedPo.has(i)) continue;
    const cat = poItems[i].catalogNumber?.trim();
    if (!cat) continue;
    if (!catalogMap.has(cat)) catalogMap.set(cat, { po: [], dn: [], inv: [] });
    catalogMap.get(cat)!.po.push({ item: poItems[i], idx: i });
  }
  for (let i = 0; i < dnItems.length; i++) {
    if (matchedDn.has(i)) continue;
    const cat = dnItems[i].catalogNumber?.trim();
    if (!cat) continue;
    if (!catalogMap.has(cat)) catalogMap.set(cat, { po: [], dn: [], inv: [] });
    catalogMap.get(cat)!.dn.push({ item: dnItems[i], idx: i });
  }
  for (let i = 0; i < invItems.length; i++) {
    if (matchedInv.has(i)) continue;
    const cat = invItems[i].catalogNumber?.trim();
    if (!cat) continue;
    if (!catalogMap.has(cat)) catalogMap.set(cat, { po: [], dn: [], inv: [] });
    catalogMap.get(cat)!.inv.push({ item: invItems[i], idx: i });
  }

  for (const [cat, entries] of catalogMap) {
    const sourceCount = [entries.po.length > 0, entries.dn.length > 0, entries.inv.length > 0].filter(Boolean).length;
    if (sourceCount < 2) continue;

    const matchedPairs = greedyMatchByQuantity(entries.po, entries.dn, entries.inv);

    for (let i = 0; i < matchedPairs.length; i++) {
      const { po: poRef, dn: dnRef, inv: invRef } = matchedPairs[i];
      const entry: ItemMapEntry = {};
      const pairing: LineItemPairing = { matchSource: 'catalog' };

      if (poRef) { entry.po = poRef.item; matchedPo.add(poRef.idx); pairing.po = toPairingItem(poRef.item, poRef.idx); }
      if (dnRef) { entry.dn = dnRef.item; matchedDn.add(dnRef.idx); pairing.dn = toPairingItem(dnRef.item, dnRef.idx); }
      if (invRef) { entry.inv = invRef.item; matchedInv.add(invRef.idx); pairing.inv = toPairingItem(invRef.item, invRef.idx); }

      itemMap.set(`cat:${cat}:${i}`, entry);
      pairings.push(pairing);
    }
  }
};
