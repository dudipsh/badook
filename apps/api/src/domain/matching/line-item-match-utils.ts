import { levenshtein } from './supplier-matcher';
import { MatchingLineItem, PairingItem } from './matching.types';

/** Collapse all whitespace (including newlines) into a single space */
export const normalizeDesc = (s?: string) => (s || '').replace(/\s+/g, ' ').trim();

export const isHebrew = (s: string) => /[\u0590-\u05FF]/.test(s);

/**
 * Fuzzy match two words for line-item matching.
 * Works for both Hebrew and English/transliterated words.
 * - Exact match always returns true
 * - For words 3+ chars: substring containment (one word inside the other)
 * - For words 4+ chars: Levenshtein distance (1 for 4-6 chars, 2 for 7+)
 */
export const fuzzyWordMatch = (w1: string, w2: string): boolean => {
  if (w1 === w2) return true;
  if (w1.length < 3 || w2.length < 3) return false;
  // Substring containment: catches truncated words like "גאול" in "גאולווי"
  if (w1.includes(w2) || w2.includes(w1)) return true;
  const minLen = Math.min(w1.length, w2.length);
  if (minLen < 4) return false;
  const dist = levenshtein(w1, w2);
  const maxAllowed = minLen <= 6 ? 1 : 2;
  return dist <= maxAllowed;
};

/** Backward-compatible alias — existing code references this name */
export const fuzzyHebrewWordMatch = fuzzyWordMatch;

export const toPairingItem = (item: MatchingLineItem, idx: number): PairingItem => ({
  id: item.id || undefined,
  description: normalizeDesc(item.description),
  catalogNumber: item.catalogNumber?.trim() || undefined,
  quantity: Number(item.quantity) || 0,
  unitPrice: Number(item.unitPrice) || undefined,
  totalPrice: Number(item.totalPrice) || undefined,
  index: item.sortOrder ?? idx,
  ...(item.__sourceInvIdx != null ? { invoiceIdx: item.__sourceInvIdx } : {}),
});

/** Returns min absolute diff between targetQty and any quantity in the item (primary + breakdown). */
export const minQtyDiff = (item: MatchingLineItem, targetQty: number): number => {
  const primary = Number(item.quantity) || 0;
  let minDiff = Math.abs(primary - targetQty);
  if (minDiff === 0) return 0;
  if (Array.isArray(item.quantityBreakdown)) {
    for (const comp of item.quantityBreakdown) {
      const diff = Math.abs(Number(comp.value) - targetQty);
      if (diff < minDiff) minDiff = diff;
      if (diff === 0) return 0;
    }
  }
  return minDiff;
};

/**
 * Split a token that mixes Hebrew and Latin/digit scripts into separate parts.
 * e.g. "גאלווALBAR" → ["גאלוו", "ALBAR"], "60F88R" → ["60F88R"] (no split, same script group)
 */
export const splitMixedScriptWords = (word: string): string[] => {
  // Split at Hebrew↔Latin boundaries
  const parts = word.split(/(?<=[\u0590-\u05FF])(?=[a-zA-Z0-9])|(?<=[a-zA-Z0-9])(?=[\u0590-\u05FF])/);
  return parts.filter(p => p.length > 0);
};

export const extractKeywords = (desc: string): Set<string> => {
  const rawWords = (desc || '').replace(/[()"/\-,.:;!?*]/g, ' ').split(/\s+/);
  const expanded: string[] = [];
  for (const w of rawWords) {
    const parts = splitMixedScriptWords(w);
    if (parts.length > 1) {
      expanded.push(...parts);
    }
    expanded.push(w); // keep original too
  }
  return new Set(expanded.filter((w) => {
    if (w.length >= 3) return true;
    if (w.length === 2 && /^\d+$/.test(w)) return true;
    return false;
  }).map((w) => w.toLowerCase()));
};

export const extractCoreWords = (desc: string): string[] => {
  const words = (desc || '').match(/[\u0590-\u05FF]{3,}/g) || [];
  return words.slice(0, 3);
};
