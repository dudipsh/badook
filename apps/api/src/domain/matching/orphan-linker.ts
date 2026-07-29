import { Logger } from '@nestjs/common';
import {
  LineItemPairing,
  MatchingLineItem,
  ItemMapEntry,
  IndexedLineItem,
} from './matching.types';
import {
  normalizeDesc,
  toPairingItem,
  extractKeywords,
  fuzzyHebrewWordMatch,
} from './line-item-match-utils';

/** Add orphan entries for all unmatched items */
export const addOrphans = (
  unmatchedPo: IndexedLineItem[],
  unmatchedDn: IndexedLineItem[],
  unmatchedInv: IndexedLineItem[],
  itemMap: Map<string, ItemMapEntry>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  matchedDn: Set<number>,
  matchedInv: Set<number>,
) => {
  for (const { item, i } of unmatchedPo) {
    if (matchedPo.has(i)) continue;
    itemMap.set(`orphan:po:${i}:${item.description?.trim() || ''}`, { po: item });
    pairings.push({ matchSource: 'description', po: toPairingItem(item, i) });
  }
  for (const { item, i } of unmatchedDn) {
    if (matchedDn.has(i)) continue;
    itemMap.set(`orphan:dn:${i}:${item.description?.trim() || ''}`, { dn: item });
    pairings.push({ matchSource: 'description', dn: toPairingItem(item, i) });
  }
  for (const { item, i } of unmatchedInv) {
    if (matchedInv.has(i)) continue;
    itemMap.set(`orphan:inv:${i}:${item.description?.trim() || ''}`, { inv: item });
    pairings.push({ matchSource: 'description', inv: toPairingItem(item, i) });
  }
};

/**
 * Link orphan DN pairings to matching PO items for partial deliveries.
 * When multiple DNs deliver parts of the same PO line, the matcher creates
 * one matched pairing (PO+DN) and one orphan (DN-only). This step adds the
 * PO reference to orphans by matching catalog number or description keywords,
 * and aggregates their DN/INV quantities into the main itemMap entry so the
 * discrepancy service sees the total delivered amount rather than per-split parts.
 */
export const linkOrphanDnsToPo = (
  pairings: LineItemPairing[],
  poItems: MatchingLineItem[],
  itemMap: Map<string, ItemMapEntry>,
  logger: Logger,
) => {
  if (poItems.length === 0) return;

  const matchedPairings = pairings.filter(p => p.po && p.dn);
  if (matchedPairings.length === 0) return;

  let linked = 0;
  for (const p of pairings) {
    if (p.po || !p.dn) continue; // skip non-orphan-DN pairings

    const orphanDesc = normalizeDesc(p.dn.description || '');
    const orphanCat = (p.dn.catalogNumber || '').trim();

    for (const matched of matchedPairings) {
      const matchedDnDesc = normalizeDesc(matched.dn!.description || '');
      const matchedDnCat = (matched.dn!.catalogNumber || '').trim();

      const sameByCatalog = orphanCat && matchedDnCat && orphanCat === matchedDnCat;
      const sameByDesc = orphanDesc && matchedDnDesc && orphanDesc === matchedDnDesc;

      if (sameByCatalog || sameByDesc) {
        p.po = { ...matched.po! };
        mergeOrphanIntoMainEntry(itemMap, matched, p);
        linked++;
        break;
      }
    }
  }

  if (linked > 0) {
    logger.log(`[PARTIAL-DELIVERY] Linked ${linked} orphan DN pairing(s) to PO items`);
  }
};

/**
 * Aggregate the orphan pairing's DN/INV quantities into the main matched
 * pairing's itemMap entry. The main entry's dn/inv are cloned so we don't
 * mutate the original Prisma-sourced MatchingLineItem objects.
 */
const mergeOrphanIntoMainEntry = (
  itemMap: Map<string, ItemMapEntry>,
  matched: LineItemPairing,
  orphan: LineItemPairing,
) => {
  const mainEntry = findEntryByDnId(itemMap, matched.dn?.id) ?? findEntryByDnIdx(itemMap, matched.dn?.index);
  const orphanKey = findKeyByDnId(itemMap, orphan.dn?.id) ?? findKeyByDnIdx(itemMap, orphan.dn?.index);
  if (!mainEntry || !orphanKey) return;
  const orphanEntry = itemMap.get(orphanKey);
  if (!orphanEntry || orphanEntry === mainEntry) return;

  if (mainEntry.dn && orphanEntry.dn) {
    mainEntry.dn = {
      ...mainEntry.dn,
      quantity: Number(mainEntry.dn.quantity) + Number(orphanEntry.dn.quantity),
      totalPrice: sumNumeric(mainEntry.dn.totalPrice, orphanEntry.dn.totalPrice),
    };
  }
  if (orphanEntry.inv) {
    if (mainEntry.inv) {
      mainEntry.inv = {
        ...mainEntry.inv,
        quantity: Number(mainEntry.inv.quantity) + Number(orphanEntry.inv.quantity),
        totalPrice: sumNumeric(mainEntry.inv.totalPrice, orphanEntry.inv.totalPrice),
      };
    } else {
      mainEntry.inv = orphanEntry.inv;
    }
  }

  itemMap.delete(orphanKey);
};

const findEntryByDnId = (itemMap: Map<string, ItemMapEntry>, id: string | undefined) => {
  if (!id) return undefined;
  for (const entry of itemMap.values()) if (entry.dn?.id === id) return entry;
  return undefined;
};

const findEntryByDnIdx = (itemMap: Map<string, ItemMapEntry>, idx: number | undefined) => {
  if (idx === undefined) return undefined;
  for (const [key, entry] of itemMap) if (key.includes(`:${idx}:`) && entry.dn) return entry;
  return undefined;
};

const findKeyByDnId = (itemMap: Map<string, ItemMapEntry>, id: string | undefined) => {
  if (!id) return undefined;
  for (const [key, entry] of itemMap) if (entry.dn?.id === id) return key;
  return undefined;
};

const findKeyByDnIdx = (itemMap: Map<string, ItemMapEntry>, idx: number | undefined) => {
  if (idx === undefined) return undefined;
  for (const [key, entry] of itemMap) if (key.includes(`:${idx}:`) && entry.dn) return key;
  return undefined;
};

const sumNumeric = (a: unknown, b: unknown): number | null => {
  const an = a == null ? null : Number(a);
  const bn = b == null ? null : Number(b);
  if (an == null && bn == null) return null;
  return (an ?? 0) + (bn ?? 0);
};

/**
 * Link orphan DN items to existing PO+INV pairings that have no DN.
 * This handles the case where PO was catalog-matched to INV (same catalog number)
 * but the DN has a different catalog number (buyer vs supplier catalog).
 * Uses keyword overlap + quantity similarity to find the best match.
 */
export const linkOrphanDnsToPoInvPairs = (
  pairings: LineItemPairing[],
  matchedDn: Set<number>,
  logger: Logger,
) => {
  const poInvNoDn = pairings.filter(p => p.po && p.inv && !p.dn);
  if (poInvNoDn.length === 0) return;

  const orphanDnPairings = pairings.filter(p => p.dn && !p.po && !p.inv);
  if (orphanDnPairings.length === 0) return;

  let linked = 0;
  const usedOrphans = new Set<LineItemPairing>();

  for (const target of poInvNoDn) {
    const poKw = extractKeywords(target.po!.description || '');
    const poQty = target.po!.quantity || 0;

    let bestOrphan: LineItemPairing | undefined;
    let bestScore = 0;

    for (const orphan of orphanDnPairings) {
      if (usedOrphans.has(orphan)) continue;
      const dnKw = extractKeywords(orphan.dn!.description || '');
      const dnQty = orphan.dn!.quantity || 0;

      // Count shared keywords
      let shared = 0;
      for (const pw of poKw) {
        if (/^\d+$/.test(pw)) continue; // skip pure numbers
        for (const dw of dnKw) {
          if (fuzzyHebrewWordMatch(pw, dw)) { shared++; break; }
        }
      }

      if (shared === 0) continue;

      // Score: keyword overlap + quantity bonus
      let score = shared;
      if (poQty > 0 && dnQty > 0) {
        const qtyRatio = Math.min(poQty, dnQty) / Math.max(poQty, dnQty);
        if (qtyRatio >= 0.99) score += 5; // exact qty match
        else if (qtyRatio >= 0.85) score += 2; // close qty
      }

      if (score > bestScore) {
        bestScore = score;
        bestOrphan = orphan;
      }
    }

    if (bestOrphan && bestScore >= 2) {
      target.dn = bestOrphan.dn;
      matchedDn.add(bestOrphan.dn!.index);
      usedOrphans.add(bestOrphan);

      // Remove the orphan pairing (DN is now in the target pairing)
      const orphanIdx = pairings.indexOf(bestOrphan);
      if (orphanIdx >= 0) pairings.splice(orphanIdx, 1);

      linked++;
      logger.log(
        `[PO-INV-DN-LINK] Linked orphan DN[${target.dn!.index}] "${target.dn!.description?.slice(0, 40)}" ` +
        `to PO[${target.po!.index}]+INV pair (score=${bestScore})`,
      );
    }
  }

  if (linked > 0) {
    logger.log(`[PO-INV-DN-LINK] Linked ${linked} orphan DN(s) to PO+INV pairings`);
  }
};

/**
 * Pair unmatched settlement/consolidated invoice lines with the first PO item.
 * Settlement lines (גמר חשבון, מקדמה, etc.) cover the entire order, not individual items.
 */
export const pairSettlementInvoiceLines = (
  poItems: MatchingLineItem[],
  invItems: MatchingLineItem[],
  itemMap: Map<string, ItemMapEntry>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  matchedInv: Set<number>,
  logger: Logger,
) => {
  const settlementKeywords = ['גמר חשבון', 'מקדמה', 'תשלום ע"ח', 'סה"כ עבודות', 'הזמנת רכש'];

  for (let ii = 0; ii < invItems.length; ii++) {
    if (matchedInv.has(ii)) continue;
    const desc = (invItems[ii].description || '').toLowerCase();
    const isSettlement = settlementKeywords.some(kw => desc.includes(kw));
    if (!isSettlement) continue;

    const invTotal = Number(invItems[ii].totalPrice) || 0;

    // Find best PO item by total amount closeness, preferring items without INV pairing
    let bestPi = -1;
    let bestDiff = Infinity;
    for (let pi = 0; pi < poItems.length; pi++) {
      const poTotal = (Number(poItems[pi].quantity) || 0) * (Number(poItems[pi].unitPrice) || 0);
      if (poTotal <= 0) continue;
      const diff = Math.abs(invTotal - poTotal) / poTotal;
      const hasInvPairing = pairings.some(p => p.po?.index === pi && p.inv);
      const adjustedDiff = hasInvPairing ? diff + 10 : diff;
      if (adjustedDiff < bestDiff) {
        bestDiff = adjustedDiff;
        bestPi = pi;
      }
    }
    if (bestPi < 0) continue;

    // Attach to existing pairing without INV, or create new pairing
    const existingPairing = pairings.find(
      p => p.po && p.po.index === bestPi && !p.inv,
    );
    if (existingPairing) {
      existingPairing.inv = toPairingItem(invItems[ii], ii);
      const mapEntry = [...itemMap.values()].find(e => e.po === poItems[bestPi]);
      if (mapEntry) mapEntry.inv = invItems[ii];
    } else {
      itemMap.set(`settlement:${ii}:${invItems[ii].description?.trim() || ''}`, { po: poItems[bestPi], inv: invItems[ii] });
      pairings.push({
        matchSource: 'description',
        po: toPairingItem(poItems[bestPi], bestPi),
        inv: toPairingItem(invItems[ii], ii),
      });
    }
    matchedPo.add(bestPi);
    matchedInv.add(ii);
    logger.log(`[SETTLEMENT] Paired settlement INV[${ii}] "${desc.slice(0, 40)}" with PO[${bestPi}] (diff=${(bestDiff * 100).toFixed(1)}%)`);

    // Remove orphan entry if exists
    for (const [key] of itemMap) {
      if (key.startsWith(`orphan:inv:${ii}:`)) {
        itemMap.delete(key);
        break;
      }
    }
    // Remove orphan pairing
    const orphanIdx = pairings.findIndex(p => !p.po && !p.dn && p.inv?.index === ii);
    if (orphanIdx >= 0) pairings.splice(orphanIdx, 1);
  }
};
