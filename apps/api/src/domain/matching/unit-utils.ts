export const UNIT_ALIASES: Record<string, string> = {
  'מטר אורך': 'מטר אורך', 'מטר': 'מטר אורך', 'מ"א': 'מטר אורך', "מ'א": 'מטר אורך', "מ'": 'מטר אורך', 'מא': 'מטר אורך', 'מ': 'מטר אורך', 'm': 'מטר אורך', 'meter': 'מטר אורך',
  'מ"ר': 'מ"ר', 'מטר רבוע': 'מ"ר', 'מר': 'מ"ר', 'sqm': 'מ"ר',
  'מ"ק': 'מ"ק', 'מטר קובי': 'מ"ק', 'קוב': 'מ"ק', 'קוב\'': 'מ"ק', 'קובי': 'מ"ק', 'מק': 'מ"ק', 'מ3': 'מ"ק', 'cbm': 'מ"ק', 'cubic': 'מ"ק', 'cum': 'מ"ק', 'm3': 'מ"ק',
  'קרטון': 'קרטון', 'ארגז': 'קרטון', "קרט'": 'קרטון', 'box': 'קרטון',
  'יחידות': 'יחידות', "יח'": 'יחידות', "יח'ים": 'יחידות', 'יחידה': 'יחידות', 'יח': 'יחידות', 'unit': 'יחידות', 'units': 'יחידות',
  'ק"ג': 'ק"ג', 'קג': 'ק"ג', 'קילוגרם': 'ק"ג', 'kg': 'ק"ג',
  'חבילה': 'חבילה', "חב'": 'חבילה', 'אריזה': 'חבילה', 'pack': 'חבילה',
  'שק': 'שק', 'שקית': 'שק',
  'גליל': 'גליל', 'roll': 'גליל',
  'ליטר': 'ליטר', "ל'": 'ליטר', 'liter': 'ליטר',
  'טון': 'טון', 'ton': 'טון',
  'משטח': 'משטח', 'משט': 'משטח', 'פלטה': 'משטח', 'pallet': 'משטח',
  'סט': 'סט', 'מערכת': 'סט', 'set': 'סט',
};

export const normalizeUnit = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const key = raw.trim()
    .replace(/\u05F4/g, '"')   // Hebrew gershayim ״ → ASCII "
    .replace(/\u05F3/g, "'")   // Hebrew geresh ׳ → ASCII '
    .toLowerCase();
  return UNIT_ALIASES[key] ?? raw.trim();
};

export const unitsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return normalizeUnit(a) === normalizeUnit(b);
};

/** Material-to-unit rules for post-extraction correction */
const MATERIAL_UNIT_RULES: { pattern: RegExp; unit: string }[] = [
  { pattern: /בטון|^ב\s*\d{2,3}\s/,       unit: 'מ"ק' },  // concrete (B30, B40, etc.)
  { pattern: /\bm3\b|\bcbm\b|\bcubic\b/i,  unit: 'מ"ק' },  // M3, CBM, cubic
];

/**
 * Correct unit based on product description when the AI extracted a generic/wrong unit.
 * Only overrides "יחידות" (the default fallback) — if the AI chose a specific unit, trust it.
 */
export const inferUnitFromDescription = (
  description: string | null | undefined,
  currentUnit: string | null | undefined,
): string | null | undefined => {
  if (!description) return currentUnit;
  const normalized = normalizeUnit(currentUnit);
  if (normalized && normalized !== 'יחידות') return currentUnit;

  for (const rule of MATERIAL_UNIT_RULES) {
    if (rule.pattern.test(description)) return rule.unit;
  }
  return currentUnit;
};
