/**
 * Pure utility functions for project name cleaning, normalization, and validation.
 * Extracted from ProjectsService to reduce file size.
 */

/** Clean a delivery address for use as project name. Returns empty string if name is garbage. */
export function cleanAddress(addr: string): string {
  let cleaned = addr
    // Normalize whitespace and punctuation
    .replace(/[,\-\/\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Strip address field labels (from structured delivery addresses: "רחוב: X ישוב: Y מיקוד: Z")
    .replace(/(רחוב|ישוב|מיקוד|עיר|יישוב|מספר):\s*/g, '')
    // Strip "לידי:" and everything after it (contact person info)
    .replace(/לידי:?.*/i, '')
    // Strip phone/fax numbers (Israeli format: 0X-XXXXXXX, 05X-XXXXXXX)
    .replace(/\b0\d{1,2}[-\s]?\d{6,7}\b/g, '')
    .replace(/פקס:?\s*\S+/g, '')
    // Strip long digit sequences (IDs, barcodes)
    .replace(/\b\d{7,}\b/g, '')
    // Strip person names with phone patterns (e.g., "משה לוי 052-0000002")
    .replace(/[\u0590-\u05FF]+\s+[\u0590-\u05FF]+\s+0\d{1,2}[-\s]?\d{6,7}/g, '')
    // Strip self-pickup patterns
    .replace(/איסוף\s*עצמי.*/i, '')
    .replace(/לאיסוף\s*מ.*/i, '')
    // Strip isolated short English words (prepositions, articles) but keep meaningful names
    .replace(/\b[A-Za-z]{1,3}\b/g, '')
    // Strip floor/apartment info
    .replace(/\b(קומה|דירה|כניסה|בניין)\s*\d*/g, '')
    // Strip trailing zip codes (Israeli: 5 or 7 digits)
    .replace(/\s+\d{5,7}\s*$/, '')
    // Strip trailing street numbers
    .replace(/\s+\d{1,3}\s*$/, '')
    // Expand abbreviations
    .replace(/\bת"א\b/g, 'תל אביב')
    // Final whitespace cleanup
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicate: OCR sometimes extracts the same text twice (e.g. "פתח תקווה פתח תקווה")
  if (cleaned.length >= 6) {
    const mid = Math.ceil(cleaned.length / 2);
    // Check if the string is exactly "X X" (two identical halves separated by space)
    for (let i = mid - 1; i <= mid + 1; i++) {
      if (i > 0 && i < cleaned.length && cleaned[i] === ' ') {
        const first = cleaned.substring(0, i).trim();
        const second = cleaned.substring(i + 1).trim();
        if (first === second) {
          cleaned = first;
          break;
        }
      }
    }

    // Deduplicate prefix/suffix: OCR sometimes puts the city at both start and end
    // e.g. "פתח תקווה יגיע כפיים 20 פתח תקווה" -> "יגיע כפיים 20 פתח תקווה"
    const words = cleaned.split(/\s+/);
    if (words.length >= 4) {
      for (let prefixLen = 1; prefixLen <= Math.min(3, Math.floor(words.length / 2)); prefixLen++) {
        const prefix = words.slice(0, prefixLen).join(' ');
        const suffix = words.slice(-prefixLen).join(' ');
        if (prefix === suffix) {
          cleaned = words.slice(prefixLen).join(' ');
          break;
        }
      }
    }
  }

  if (!isValidProjectName(cleaned)) {
    return '';
  }
  return cleaned;
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.\-,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidProjectName(name: string): boolean {
  if (!name || name.length < 3) return false;
  const hebrewChars = (name.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrewChars < 3) return false;
  const allAlpha = (name.match(/[\p{L}\p{N}]/gu) || []).length;
  if (allAlpha > 0 && hebrewChars / allAlpha < 0.4) return false;
  const hebrewWords = (name.match(/[\u0590-\u05FF]{2,}/g) || []);
  if (hebrewWords.length === 0) return false;
  if (hebrewWords.length === 1 && hebrewWords[0].length < 4) return false;
  if (name.replace(/\s+/g, '').length < 5) return false;
  if (hebrewChars < 6 && name.match(/\d/)) return false;

  // Reject company/supplier names -- these are not project/site names
  const companyPatterns = /בע"?מ|תעשיות|קבוצת|חברת|מפעלי|ושות['׳]|סחר|שיווק|הנדסת|מעבדות|טכנולוגיות/;
  if (companyPatterns.test(name)) return false;

  // Reject self-pickup / branch patterns -- not project locations
  const pickupPatterns = /איסוף\s*עצמי|סניף\s+[\u0590-\u05FF]+$/;
  if (pickupPatterns.test(name)) return false;

  // Reject receipt/invoice garbage text -- thermal POS printouts produce OCR noise
  const receiptGarbage = /חשבונית|אלקטרונית|עוסק\s*מורשה|קופה\s*רושמת|מס['׳]\s*קבלה|פיקדון\s*בקבוק/;
  if (receiptGarbage.test(name)) return false;

  // Reject bare city + zip patterns (likely supplier address, not project)
  // e.g., "קיבוץ יקום 60972" or "נתניה 4250416"
  if (/^[\u0590-\u05FF\s]+\d{5,7}$/.test(name.trim())) return false;

  return true;
}

export function isFuzzyMatch(n1: string, n2: string): boolean {
  if (n1 === n2) return true;

  const maxLen = Math.max(n1.length, n2.length);
  const minLen = Math.min(n1.length, n2.length);

  // Shared site identifier prefix: Hebrew word(s) + number at the start of both names.
  // In construction, "מצדה 3" / "נחל שורק 5" uniquely identifies a project site.
  // "מצדה 3 אקסלנס שלב ב בני ברק" and "מצדה 3 קיבוץ יקום" → same project.
  const sitePrefix = /^((?:[\u0590-\u05FF]+\s+){1,3}\d+)/;
  const prefix1 = n1.match(sitePrefix)?.[1];
  const prefix2 = n2.match(sitePrefix)?.[1];
  if (prefix1 && prefix2 && prefix1 === prefix2 && prefix1.length >= 4) return true;

  // Substring match — but only when sizes are similar.
  // "קיבוץ יקום מצדה 3 אקסלנס" should NOT match "קיבוץ יקום" (city is a small part of a long address).
  if ((n1.includes(n2) || n2.includes(n1)) && minLen / maxLen >= 0.55) return true;

  // Suffix match: in Israeli addresses the city is always at the end.
  // "פתח תקווה" at the end of "יגיע כפיים 20 פתח תקווה" is a strong match signal
  // even when the size ratio is too low for the general substring check above.
  if (n1.endsWith(n2) || n2.endsWith(n1)) {
    const shorter = n1.length < n2.length ? n1 : n2;
    const hebrewWords = shorter.split(/\s+/).filter((w) => /[\u0590-\u05FF]{2,}/.test(w));
    if (hebrewWords.length >= 2) return true;
  }

  if (maxLen > 0 && maxLen <= 20) {
    const dist = editDistance(n1, n2);
    if (dist <= 1) return true;
    if (maxLen >= 4 && dist <= 2 && dist / maxLen <= 0.4) return true;
    if (maxLen >= 8 && dist <= 3 && dist / maxLen <= 0.35) return true;
    if (Math.abs(n1.length - n2.length) <= 2 && dist <= 3 && minLen >= 4) return true;
  }

  const words1 = n1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = n2.split(/\s+/).filter((w) => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return false;

  const common = words1.filter((w) =>
    words2.some((w2) => {
      if (w === w2 || w.includes(w2) || w2.includes(w)) return true;
      const wDist = editDistance(w, w2);
      const wMaxLen = Math.max(w.length, w2.length);
      if (wMaxLen < 6) return wDist <= 1;
      return wDist <= 2 && wDist / wMaxLen <= 0.3;
    }),
  );
  // Full subset: if ALL words of the shorter name appear in the longer one
  // and there are 3+ matched words, it's the same place with extra details.
  // "מצדה 3 קיבוץ יקום" ⊂ "קיבוץ יקום מצדה 3 אקסלנס שלב ב במגדל" → match
  // But "קיבוץ יקום" (only 2 words) is too generic to match any long address.
  const shorter = words1.length <= words2.length ? words1 : words2;
  if (common.length >= shorter.length && common.length >= 3) return true;

  // Require overlap relative to the LARGER set — prevents a 2-word city name
  // from matching any long address that happens to contain those words.
  const overlapRatio = common.length / Math.max(words1.length, words2.length);
  return overlapRatio >= 0.6;
}

export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
