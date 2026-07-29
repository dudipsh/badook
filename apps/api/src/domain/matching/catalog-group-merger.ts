import { Logger } from '@nestjs/common';
import { LineItemPairing } from './matching.types';
import { fuzzyHebrewWordMatch, normalizeDesc, minQtyDiff, toPairingItem } from './line-item-match-utils';

/**
 * After catalog matching takes DN+INV items and AI handles PO items separately,
 * PO items often end up as orphans because the AI can't see the catalog-matched DN/INV.
 * This step merges PO-only groups with DN+INV-only groups when quantities match.
 */
export function mergePOOrphansWithCatalogGroups(
  itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  logger: Logger,
): void {
  const poOnlyKeys: string[] = [];
  const dnInvOnlyKeys: string[] = [];

  for (const [key, entry] of itemMap) {
    if (entry.po && !entry.dn && !entry.inv) poOnlyKeys.push(key);
    if (!entry.po && (entry.dn || entry.inv)) dnInvOnlyKeys.push(key);
  }

  if (poOnlyKeys.length === 0 || dnInvOnlyKeys.length === 0) return;

  let merged = 0;
  const usedDnInvKeys = new Set<string>();

  for (const poKey of poOnlyKeys) {
    const poEntry = itemMap.get(poKey)!;
    const poQty = Number(poEntry.po?.quantity) || 0;
    if (poQty <= 0) continue;

    let bestKey: string | null = null;
    let bestScore = Infinity;

    const poTotal = Number(poEntry.po?.totalPrice) || (Number(poEntry.po?.unitPrice || 0) * poQty);
    const poDesc = (poEntry.po?.description || '').replace(/[()"/\-,.:;!?]/g, ' ');
    const poKeywords: Set<string> = new Set(
      poDesc.split(/\s+/)
        .filter((w: string) => w.length >= 3 || (w.length === 2 && /^\d+$/.test(w)))
        .map((w: string) => w.toLowerCase()),
    );
    const poNumbers = (poEntry.po?.description || '').match(/\d{4,}/g) || [];
    const poAllWords = poDesc.split(/\s+/).filter((w: string) => w.length >= 1).map((w: string) => w.toLowerCase());
    const poUnitPrice = String(Number(poEntry.po?.unitPrice) || '');
    const poQtyStr = String(poQty);
    if (poUnitPrice && poUnitPrice !== '0') poAllWords.push(poUnitPrice);
    if (poQtyStr && poQtyStr !== '0') poAllWords.push(poQtyStr);

    for (const diKey of dnInvOnlyKeys) {
      if (usedDnInvKeys.has(diKey)) continue;
      const diEntry = itemMap.get(diKey)!;
      const diDn = diEntry.dn;
      const diInv = diEntry.inv;
      if (!diDn && !diInv) continue;

      let minDiff = Infinity;
      if (diDn) minDiff = Math.min(minDiff, minQtyDiff(diDn, poQty));
      if (diInv) minDiff = Math.min(minDiff, minQtyDiff(diInv, poQty));
      const diQty = Math.max(Number(diDn?.quantity) || 0, Number(diInv?.quantity) || 0);
      if (diQty <= 0) continue;

      const qtyDiff = poQty > 0 ? minDiff / Math.max(poQty, diQty) : 1;

      const dnTotal = Number(diDn?.totalPrice) || (Number(diDn?.unitPrice || 0) * (Number(diDn?.quantity) || 0));
      const invTotal = Number(diInv?.totalPrice) || (Number(diInv?.unitPrice || 0) * (Number(diInv?.quantity) || 0));
      const bestDiTotal = [dnTotal, invTotal].filter(t => t > 0).reduce((best, t) =>
        Math.abs(t - poTotal) < Math.abs(best - poTotal) ? t : best, dnTotal || invTotal);
      const totalDiff = (poTotal > 0 && bestDiTotal > 0) ? Math.abs(poTotal - bestDiTotal) / Math.max(poTotal, bestDiTotal) : 1;

      const dnDesc = (diDn?.description || '').replace(/[()"/\-,.:;!?]/g, ' ');
      const invDesc = (diInv?.description || '').replace(/[()"/\-,.:;!?]/g, ' ');
      const diKeywords: Set<string> = new Set(
        `${dnDesc} ${invDesc}`.split(/\s+/)
          .filter((w: string) => w.length >= 3 || (w.length === 2 && /^\d+$/.test(w)))
          .map((w: string) => w.toLowerCase()),
      );
      let sharedKeywords = 0;
      for (const w of poKeywords) {
        if (diKeywords.has(w)) { sharedKeywords++; continue; }
        for (const dw of diKeywords) {
          if (fuzzyHebrewWordMatch(w, dw)) { sharedKeywords++; break; }
        }
      }

      const diNumbers = [
        ...((diDn?.description || '').match(/\d{4,}/g) || []),
        ...((diInv?.description || '').match(/\d{4,}/g) || []),
      ];
      const hasSharedNumber = poNumbers.some((n: string) => diNumbers.some((dn: string) => dn.includes(n) || n.includes(dn)));

      const diAllWords = `${dnDesc} ${invDesc}`.split(/\s+/).filter((w: string) => w.length >= 1).map((w: string) => w.toLowerCase());
      const diUnitPrice = String(Math.max(Number(diDn?.unitPrice) || 0, Number(diInv?.unitPrice) || 0));
      if (diUnitPrice && diUnitPrice !== '0') diAllWords.push(diUnitPrice);
      if (diQty) diAllWords.push(String(diQty));
      let sharedWords = 0;
      for (const w of poAllWords) {
        if (diAllWords.some(dw => fuzzyHebrewWordMatch(w, dw))) sharedWords++;
      }
      const wordOverlapRatio = poAllWords.length > 0 ? sharedWords / poAllWords.length : 0;

      const isQtyMatch = qtyDiff <= 0.3;
      const isTotalMatch = totalDiff <= 0.2;
      const isKeywordMatch = sharedKeywords >= 2 || hasSharedNumber;
      const isWordOverlapMatch = wordOverlapRatio >= 0.5;

      if (!isQtyMatch && !isTotalMatch && !isKeywordMatch && !isWordOverlapMatch) continue;
      if (!isQtyMatch && !isTotalMatch && (isKeywordMatch || isWordOverlapMatch) && qtyDiff > 0.5) continue;

      const score = Math.min(qtyDiff, totalDiff) - (sharedKeywords * 0.05) - (hasSharedNumber ? 0.2 : 0) - (wordOverlapRatio * 0.3);
      if (score < bestScore) {
        bestScore = score;
        bestKey = diKey;
      }
    }

    if (bestKey) {
      const diEntry = itemMap.get(bestKey)!;
      diEntry.po = poEntry.po;

      const poIdxMatch = poKey.match(/^orphan:po:(\d+):/);
      const poIdx = poIdxMatch ? parseInt(poIdxMatch[1], 10) : -1;
      const pairingIdx = poIdx >= 0
        ? pairings.findIndex((p) => p.po && !p.dn && !p.inv && p.po.index === poIdx)
        : pairings.findIndex((p) => p.po && !p.dn && !p.inv && p.po.description === poEntry.po?.description?.trim());

      const diQty = Number((diEntry.dn || diEntry.inv)?.quantity) || 0;
      const diDesc = normalizeDesc((diEntry.dn || diEntry.inv)?.description);
      // Try exact match first, then fuzzy match on description
      let diPairingIdx = pairings.findIndex(
        (p) => !p.po && (p.dn || p.inv) &&
          ((p.dn && p.dn.description === diDesc && p.dn.quantity === diQty) ||
            (p.inv && p.inv.description === diDesc && p.inv.quantity === diQty)),
      );
      // Fuzzy fallback: match by quantity + partial description overlap
      if (diPairingIdx < 0) {
        const diDescKw = normalizeDesc(diDesc).split(/\s+/).filter((w: string) => w.length >= 3);
        diPairingIdx = pairings.findIndex((p) => {
          if (p.po || (!p.dn && !p.inv)) return false;
          const pDesc = normalizeDesc((p.dn || p.inv)?.description || '');
          const pKw = pDesc.split(/\s+/).filter((w: string) => w.length >= 3);
          const hasDescOverlap = diDescKw.length === 0 || pKw.length === 0
            || diDescKw.some((w: string) => pKw.some((pw: string) => fuzzyHebrewWordMatch(w, pw)));
          if (!hasDescOverlap) return false;
          return (p.dn && Math.abs(p.dn.quantity - diQty) < 0.01) ||
            (p.inv && Math.abs(p.inv.quantity - diQty) < 0.01);
        });
      }

      if (diPairingIdx >= 0 && pairingIdx >= 0) {
        pairings[diPairingIdx].po = pairings[pairingIdx].po;
        pairings[diPairingIdx].matchSource = 'ai';
        pairings.splice(pairingIdx, 1);
      } else if (pairingIdx >= 0) {
        // No DI pairing found but we have PO pairing — add DN/INV to it
        if (diEntry.dn) {
          pairings[pairingIdx].dn = toPairingItem(diEntry.dn, diPairingIdx);
        }
        if (diEntry.inv) {
          pairings[pairingIdx].inv = toPairingItem(diEntry.inv, diPairingIdx);
        }
        pairings[pairingIdx].matchSource = 'ai';
      } else if (diPairingIdx >= 0) {
        // No PO pairing found — add PO data directly to DI pairing
        pairings[diPairingIdx].po = toPairingItem(poEntry.po, poIdx >= 0 ? poIdx : 0);
        pairings[diPairingIdx].matchSource = 'ai';
      }
      if (poIdx >= 0) matchedPo.add(poIdx);
      itemMap.delete(poKey);
      usedDnInvKeys.add(bestKey);
      merged++;
    }
  }

  if (merged > 0) {
    logger.log(`Merge step: merged ${merged} PO orphans with DN+INV groups`);
  } else if (poOnlyKeys.length > 0 && dnInvOnlyKeys.length > 0) {
    logger.log(`Merge step: ${poOnlyKeys.length} PO orphans, ${dnInvOnlyKeys.length} DN+INV groups, but no matches found`);
  }
}
