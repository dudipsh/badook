import { Logger } from '@nestjs/common';
import {
  LineItemPairing,
  MatchingLineItem,
  ItemMapEntry,
} from './matching.types';
import { normalizeDesc, toPairingItem } from './line-item-match-utils';

/**
 * Phase 0: Match line items based on user feedback (previous corrections).
 * Builds equivalence sets from feedback records and uses them to pair items.
 */
export const matchByFeedback = (
  poItems: MatchingLineItem[],
  dnItems: MatchingLineItem[],
  invItems: MatchingLineItem[],
  feedbackRecords: { descriptionA: string; descriptionB: string }[],
  itemMap: Map<string, ItemMapEntry>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  matchedDn: Set<number>,
  matchedInv: Set<number>,
  logger: Logger,
) => {
  if (feedbackRecords.length === 0) return;

  const equivalences = new Map<string, Set<string>>();
  for (const fb of feedbackRecords) {
    const a = normalizeDesc(fb.descriptionA).toLowerCase();
    const b = normalizeDesc(fb.descriptionB).toLowerCase();
    if (!equivalences.has(a)) equivalences.set(a, new Set([a]));
    if (!equivalences.has(b)) equivalences.set(b, new Set([b]));
    const merged = new Set([...equivalences.get(a)!, ...equivalences.get(b)!]);
    for (const desc of merged) equivalences.set(desc, merged);
  }

  const startCount = pairings.length;

  // PO -> DN/INV
  for (let pi = 0; pi < poItems.length; pi++) {
    if (matchedPo.has(pi)) continue;
    const poDesc = normalizeDesc(poItems[pi].description).toLowerCase();
    const equivSet = equivalences.get(poDesc);
    if (!equivSet) continue;

    const entry: ItemMapEntry = { po: poItems[pi] };
    const pairing: LineItemPairing = { matchSource: 'feedback', po: toPairingItem(poItems[pi], pi) };

    for (let di = 0; di < dnItems.length; di++) {
      if (matchedDn.has(di)) continue;
      if (equivSet.has(normalizeDesc(dnItems[di].description).toLowerCase())) {
        entry.dn = dnItems[di];
        pairing.dn = toPairingItem(dnItems[di], di);
        matchedDn.add(di);
        break;
      }
    }
    for (let ii = 0; ii < invItems.length; ii++) {
      if (matchedInv.has(ii)) continue;
      if (equivSet.has(normalizeDesc(invItems[ii].description).toLowerCase())) {
        entry.inv = invItems[ii];
        pairing.inv = toPairingItem(invItems[ii], ii);
        matchedInv.add(ii);
        break;
      }
    }

    if (entry.dn || entry.inv) {
      matchedPo.add(pi);
      itemMap.set(`fb:${pi}:${poDesc}`, entry);
      pairings.push(pairing);
    }
  }

  // INV -> DN (not covered by PO)
  for (let ii = 0; ii < invItems.length; ii++) {
    if (matchedInv.has(ii)) continue;
    const invDesc = normalizeDesc(invItems[ii].description).toLowerCase();
    const equivSet = equivalences.get(invDesc);
    if (!equivSet) continue;

    for (let di = 0; di < dnItems.length; di++) {
      if (matchedDn.has(di)) continue;
      if (equivSet.has(normalizeDesc(dnItems[di].description).toLowerCase())) {
        itemMap.set(`fb:inv:${ii}:${invDesc}`, { dn: dnItems[di], inv: invItems[ii] });
        pairings.push({
          matchSource: 'feedback',
          dn: toPairingItem(dnItems[di], di),
          inv: toPairingItem(invItems[ii], ii),
        });
        matchedDn.add(di);
        matchedInv.add(ii);
        break;
      }
    }
  }

  const matched = pairings.length - startCount;
  if (matched > 0) {
    logger.log(`Phase 0 (feedback): matched ${matched} item groups`);
  }
};
