import { Logger } from '@nestjs/common';
import { splitMixedScriptWords, fuzzyWordMatch } from '../matching/line-item-match-utils';
import { convertQtyIfNeeded } from './qty-converter';

const logger = new Logger('ResolveReceived');

/** Strip invisible Unicode and normalize whitespace */
export const normalize = (s: string) =>
  (s || '')
    .replace(/[\u200B-\u200D\u200E\u200F\u00AD\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ─── Received qty: primary path (pairing has dn) ────

export const resolveReceivedFromPairing = (
  pairing: any,
  pairings: any[],
  currentPoIndex: number,
  poDesc: string,
  match: any,
  deliveryHistory: any[],
  addQty: (qty: number, unit: string | null) => void,
  poUnit: string | null,
  crossMatchExcludedDnLineIds?: Set<string>,
) => {
  const dnDesc = pairing.dn?.description?.trim() || '';
  const dnDescNorm = normalize(dnDesc);
  const dnQty = pairing.dn?.quantity;
  const explicitSort = pairing.dn?.index;

  // Check for duplicate PO items (same description)
  const hasDups = pairings.some(
    (p: any) =>
      p !== pairing &&
      p?.po?.index != null &&
      p.po.index !== currentPoIndex &&
      normalize(p.po?.description || '') ===
        normalize(poDesc),
  );

  // Exclude DN items claimed by other pairings (using IDs when available, falling back to sortOrder)
  const excludedIds = new Set<string>();
  const excludedSorts = new Set<number>();
  for (const p of pairings) {
    if (p === pairing || !p?.dn) continue;
    if (p.dn.index === explicitSort && !p.dn.id) continue;
    const pPoIdx = p.po?.index;
    const shouldExclude = (pPoIdx != null && pPoIdx !== currentPoIndex) || (pPoIdx == null && hasDups);
    if (shouldExclude) {
      if (p.dn.id) excludedIds.add(p.dn.id);
      else excludedSorts.add(p.dn.index);
    }
  }
  const isExcluded = (li: any) => {
    if (li.id && excludedIds.has(li.id)) return true;
    if (!li.id && excludedSorts.has(li.sortOrder)) return true;
    // Exclude DN lines claimed by other PO matches (multi-PO sharing same DNs)
    if (li.id && crossMatchExcludedDnLineIds?.has(li.id)) return true;
    return false;
  };

  const add = (dn: any, li: any, overridePairing?: any) => {
    let qty = Number(li.quantity) || 0;
    let unit = li.unit ?? null;

    const converted = convertQtyIfNeeded(
      qty, unit, poUnit, li, overridePairing || pairing, match,
    );
    qty = converted.qty;
    unit = converted.unit;

    addQty(qty, unit);
    deliveryHistory.push({
      deliveryNoteId: dn.id,
      noteNumber: dn.noteNumber || dn.id.substring(0, 8),
      date: dn.deliveryDate?.toISOString() || '',
      quantity: qty,
      fileUrl: dn.originalFileUrl,
    });
  };

  let found = false;
  const pairingDnId = pairing.dn?.id;

  // Pass 0: find by ID (most reliable — avoids sortOrder collision across DNs)
  if (!found && pairingDnId) {
    for (const dn of match.deliveryNotes) {
      const li = dn.lineItems.find(
        (l: any) => l.id === pairingDnId,
      );
      if (li) {
        add(dn, li);
        found = true;
        // Partial delivery: find matching items in OTHER DNs (same description or catalog)
        const foundDescNorm = normalize(li.description?.trim() || '');
        const foundCat = (li.catalogNumber || '').trim();
        if (foundDescNorm || foundCat) {
          for (const otherDn of match.deliveryNotes) {
            for (const otherLi of otherDn.lineItems) {
              if (otherLi.id === pairingDnId) continue;
              if (isExcluded(otherLi)) continue;
              const otherDescNorm = normalize(otherLi.description?.trim() || '');
              const otherCat = (otherLi.catalogNumber || '').trim();

              if (otherDn === dn) {
                // Same DN: match by catalog or explicit pairing to same PO line.
                // Allow same-description items if they are explicitly paired to this PO line
                // (split items like GRIG B = 3 + 12) or have same catalog + different description.
                const explicitlyPaired = otherLi.id && pairings.some(
                  (p: any) => p?.dn?.id === otherLi.id && p?.po?.index === currentPoIndex,
                );
                const sameCatDiffDesc = foundCat && otherCat === foundCat && otherDescNorm !== foundDescNorm;
                if (explicitlyPaired || sameCatDiffDesc) {
                  const otherPairing = pairings.find(
                    (p: any) => p?.dn?.id && p.dn.id === otherLi.id,
                  );
                  add(otherDn, otherLi, otherPairing);
                }
              } else {
                // Different DN: match by description or catalog (partial delivery)
                if (
                  (foundDescNorm && otherDescNorm === foundDescNorm) ||
                  (foundCat && otherCat && otherCat === foundCat)
                ) {
                  const otherPairing = pairings.find(
                    (p: any) => p?.dn?.id && p.dn.id === otherLi.id,
                  );
                  add(otherDn, otherLi, otherPairing);
                }
              }
            }
          }
        }
        break;
      }
    }
  }

  // When there are duplicate PO items (same description),
  // use ONLY the explicit pairing index.
  if (!found && hasDups && explicitSort != null) {
    for (const dn of match.deliveryNotes) {
      const li = dn.lineItems.find(
        (l: any) => l.sortOrder === explicitSort,
      );
      if (li) {
        add(dn, li);
        found = true;
        break;
      }
    }
  }

  // Pass 1: exact description
  if (!found && !hasDups) {
    for (const dn of match.deliveryNotes) {
      for (const li of dn.lineItems) {
        if ((li.description?.trim() || '') !== dnDesc) continue;
        if (isExcluded(li)) continue;
        add(dn, li);
        found = true;
      }
    }
  }

  // Pass 1.5: normalized description
  if (!found && !hasDups) {
    for (const dn of match.deliveryNotes) {
      for (const li of dn.lineItems) {
        if (normalize(li.description || '') !== dnDescNorm)
          continue;
        if (isExcluded(li)) continue;
        add(dn, li);
        found = true;
      }
    }
  }

  // Pass 1.75: direct sortOrder match
  if (!found && explicitSort != null) {
    for (const dn of match.deliveryNotes) {
      const li = dn.lineItems.find(
        (l: any) => l.sortOrder === explicitSort,
      );
      if (li) {
        add(dn, li);
        const foundDesc = (li.description?.trim() || '');
        if (foundDesc) {
          for (const sibDn of match.deliveryNotes) {
            for (const sib of sibDn.lineItems) {
              if (sib === li) continue;
              if ((sib.description?.trim() || '') !== foundDesc)
                continue;
              if (isExcluded(sib)) continue;
              add(sibDn, sib);
            }
          }
        }
        found = true;
        break;
      }
    }
  }

  // Pass 2: fuzzy fallback
  if (!found && dnQty != null) {
    for (const dn of match.deliveryNotes) {
      const li = dn.lineItems.find(
        (l: any) =>
          !isExcluded(l) &&
          Math.abs(Number(l.quantity) - dnQty) <= 0.01 &&
          dnDesc
            .split(/\s+/)
            .some(
              (w: string) =>
                w.length >= 3 &&
                (l.description || '').includes(w),
            ),
      );
      if (li) {
        add(dn, li);
        break;
      }
    }
  }

  if (!found) {
    logger.warn(
      `DN match miss — poLine: "${poDesc}" | ` +
        `dn: "${dnDesc}" | sort: ${explicitSort}`,
    );
  }
};

// ─── Received qty: fallback path (no dn in pairing) ──

export const resolveReceivedFallback = (
  pairings: any[],
  currentPoIndex: number,
  poDesc: string,
  match: any,
  deliveryHistory: any[],
  addQty: (qty: number, unit: string | null) => void,
  poUnit: string | null,
  crossMatchExcludedDnLineIds?: Set<string>,
) => {
  // Exclude DN items paired to a DIFFERENT PO line (by ID when available)
  const claimedIds = new Set<string>();
  const claimedSorts = new Set<number>();
  for (const p of pairings) {
    if (!p?.dn || !p?.po || p.po.index === currentPoIndex) continue;
    if (p.dn.id) claimedIds.add(p.dn.id);
    else if (p.dn.index != null) claimedSorts.add(p.dn.index);
  }
  const isClaimed = (li: any) => {
    if (li.id && claimedIds.has(li.id)) return true;
    if (!li.id && claimedSorts.has(li.sortOrder)) return true;
    // Exclude DN lines claimed by other PO matches (multi-PO sharing same DNs)
    if (li.id && crossMatchExcludedDnLineIds?.has(li.id)) return true;
    return false;
  };

  // Find pairing for this PO line (for invoice lookup)
  const currentPairing = pairings.find(
    (p: any) => p?.po?.index === currentPoIndex,
  );

  const productNums = poDesc.match(/\d{3,}/g) || [];

  // Split mixed-script words so "גאלווALBAR" → ["גאלוו","albar","גאלווalbar"]
  const poRawWords = poDesc
    .replace(/[()"/\-,.:;!?]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length >= 2);
  const poKw: string[] = [];
  for (const w of poRawWords) {
    const parts = splitMixedScriptWords(w);
    if (parts.length > 1) {
      poKw.push(...parts.filter(p => p.length >= 2).map(p => p.toLowerCase()));
    }
    if (w.length >= 3) poKw.push(w.toLowerCase());
  }

  // PO total for total-price-based matching
  const poItem = currentPairing?.po;
  const poTotal = poItem
    ? (Number(poItem.totalPrice) || (Number(poItem.unitPrice || 0) * Number(poItem.quantity || 0)))
    : 0;

  let totalRecv = 0;

  const scoreDnItem = (li: any): number => {
    if (isClaimed(li)) return 0;
    let score = 0;

    for (const num of productNums) {
      if ((li.description?.trim() || '').includes(num))
        score += 3;
    }

    // Split DN words similarly
    const dnRawWords = (li.description?.trim() || '')
      .replace(/[()"/\-,.:;!?]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length >= 2);
    const dnWords: string[] = [];
    for (const w of dnRawWords) {
      const parts = splitMixedScriptWords(w);
      if (parts.length > 1) {
        dnWords.push(...parts.filter((p: string) => p.length >= 2).map((p: string) => p.toLowerCase()));
      }
      if (w.length >= 3) dnWords.push(w.toLowerCase());
    }

    for (const kw of poKw) {
      // Exact match first, then fuzzy
      if (dnWords.includes(kw)) {
        score += 1;
      } else if (dnWords.some(dw => fuzzyWordMatch(kw, dw))) {
        score += 0.5;
      }
    }

    // Total-price closeness bonus: if PO and DN totals are within 20%
    if (poTotal > 0) {
      const dnTotal = Number(li.totalPrice) ||
        (Number(li.unitPrice || 0) * Number(li.quantity || 0));
      if (dnTotal > 0 && Math.abs(poTotal - dnTotal) / Math.max(poTotal, dnTotal) <= 0.2) {
        score += 2;
      }
    }

    return score;
  };

  for (const dn of match.deliveryNotes) {
    // Collect ALL matching items from this DN (not just the best one)
    // to handle split items like BREACH (23.52 + 67.2)
    const scoredItems: { li: any; score: number }[] = [];
    for (const li of dn.lineItems) {
      const score = scoreDnItem(li);
      if (score >= 2) {
        scoredItems.push({ li, score });
      }
    }

    // Sort by score descending, take the best item always
    scoredItems.sort((a, b) => b.score - a.score);

    // Take the best item. Also take additional items if they share the
    // same catalog number (split items on same DN).
    const bestItem = scoredItems[0];
    if (!bestItem) continue;

    const toAdd = [bestItem];
    const bestCat = (bestItem.li.catalogNumber || '').trim();
    for (let i = 1; i < scoredItems.length; i++) {
      const cat = (scoredItems[i].li.catalogNumber || '').trim();
      if (bestCat && cat === bestCat) {
        toAdd.push(scoredItems[i]);
      }
    }

    for (const { li: best } of toAdd) {
      let qty = Number(best.quantity) || 0;
      let unit = best.unit ?? null;

      const converted = convertQtyIfNeeded(
        qty, unit, poUnit, best, currentPairing, match,
      );
      qty = converted.qty;
      unit = converted.unit;

      totalRecv += qty;
      addQty(qty, unit);
      deliveryHistory.push({
        deliveryNoteId: dn.id,
        noteNumber: dn.noteNumber || dn.id.substring(0, 8),
        date: dn.deliveryDate?.toISOString() || '',
        quantity: qty,
        fileUrl: dn.originalFileUrl,
      });
    }
  }

  if (totalRecv === 0 && match.deliveryNotes.length > 0) {
    logger.warn(
      `No DN match (fallback) — poLine: "${poDesc}"`,
    );
  }
};
