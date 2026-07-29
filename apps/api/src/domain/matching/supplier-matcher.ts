/**
 * Normalize supplier name for fuzzy matching.
 */
export function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.\-,'"]/g, '')
    .replace(/\s*(בע"?מ|ltd|inc|llc)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Hebrew ↔ English transliteration ---

const HEBREW_TO_LATIN: Record<string, string> = {
  'א': '', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'o', 'ז': 'z', 'ח': 'h', 'ט': 't', 'י': 'i',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'p',
  'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
};

function isHebrewText(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function transliterateHebrew(text: string): string {
  let result = '';
  for (const ch of text) {
    const mapped = HEBREW_TO_LATIN[ch];
    if (mapped !== undefined) {
      result += mapped;
    } else if (/[\u0590-\u05FF]/.test(ch)) {
      // unknown Hebrew char – skip (niqqud, etc.)
    } else {
      result += ch;
    }
  }
  return result.toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Strip vowels to get a consonant skeleton for comparison */
function stripVowels(s: string): string {
  return s.replace(/[aeiou]/gi, '');
}

function wordSimilarity(transliterated: string, english: string): number {
  const maxLen = Math.max(transliterated.length, english.length);
  if (maxLen === 0) return 0;
  // Direct comparison
  const directSim = 1 - levenshtein(transliterated, english) / maxLen;
  // Consonant-skeleton comparison (handles missing vowels in Hebrew)
  const tCons = stripVowels(transliterated);
  const eCons = stripVowels(english);
  const consMax = Math.max(tCons.length, eCons.length);
  const consSim = consMax > 0 ? 1 - levenshtein(tCons, eCons) / consMax : 0;
  return Math.max(directSim, consSim);
}

/**
 * Check if two names match via Hebrew↔English transliteration.
 * Transliterates Hebrew words to Latin and compares with English words
 * using edit-distance similarity (with consonant-skeleton fallback).
 */
export function isTransliterationMatch(name1: string, name2: string): boolean {
  const has1 = isHebrewText(name1);
  const has2 = isHebrewText(name2);
  // Only useful when one name is Hebrew and the other is not
  if (has1 === has2) return false;

  const hebrewName = has1 ? name1 : name2;
  const englishName = has1 ? name2 : name1;

  const hebrewWords = normalizeSupplierName(hebrewName)
    .split(/\s+/)
    .filter((w) => w.length > 1 && isHebrewText(w));
  const englishWords = normalizeSupplierName(englishName)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !isHebrewText(w));

  if (hebrewWords.length === 0 || englishWords.length === 0) return false;

  let matchedWords = 0;
  for (const hWord of hebrewWords) {
    const transliterated = transliterateHebrew(hWord);
    if (transliterated.length < 2) continue;

    for (const eWord of englishWords) {
      if (wordSimilarity(transliterated, eWord) >= 0.6) {
        matchedWords++;
        break;
      }
    }
  }

  return matchedWords >= 1;
}

/**
 * Check if two supplier names likely refer to the same company.
 * Handles Hebrew + English names, abbreviations, and suffixes.
 */
export function isSameSupplier(name1: string, name2: string): boolean {
  const n1 = normalizeSupplierName(name1);
  const n2 = normalizeSupplierName(name2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const words1 = n1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = n2.split(/\s+/).filter((w) => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return false;

  const common = words1.filter((w) =>
    words2.some((w2) => w === w2 || w.includes(w2) || w2.includes(w)),
  );
  if (common.length / Math.min(words1.length, words2.length) >= 0.6) return true;

  // Fallback: cross-language transliteration match
  return isTransliterationMatch(name1, name2);
}

/**
 * Check if two documents belong to the same supplier.
 * First checks supplierId, then falls back to name matching.
 */
export function isSameSupplierDoc(
  doc1: { supplierName: string; supplierId?: string | null },
  doc2: { supplierName: string; supplierId?: string | null },
): boolean {
  if (doc1.supplierId && doc2.supplierId && doc1.supplierId === doc2.supplierId) return true;
  return isSameSupplier(doc1.supplierName, doc2.supplierName);
}
