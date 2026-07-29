const UNIT_ALIASES: Record<string, string> = {
  // Linear meter (מטר אורך)
  'מטר אורך': 'מטר אורך', 'מטר': 'מטר אורך', 'מ"א': 'מטר אורך', "מ'": 'מטר אורך', 'מא': 'מטר אורך', 'מ': 'מטר אורך', 'm': 'מטר אורך', 'meter': 'מטר אורך',
  // Square meter
  'מ"ר': 'מ"ר', 'מטר רבוע': 'מ"ר', 'מר': 'מ"ר', 'sqm': 'מ"ר',
  // Carton / box
  'קרטון': 'קרטון', 'ארגז': 'קרטון', "קרט'": 'קרטון', 'box': 'קרטון',
  // Units
  'יחידות': 'יחידות', "יח'": 'יחידות', 'יחידה': 'יחידות', 'יח': 'יחידות', 'unit': 'יחידות',
  // Kilogram
  'ק"ג': 'ק"ג', 'קג': 'ק"ג', 'קילוגרם': 'ק"ג', 'kg': 'ק"ג',
  // Package
  'חבילה': 'חבילה', "חב'": 'חבילה', 'אריזה': 'חבילה', 'pack': 'חבילה',
  // Bag
  'שק': 'שק', 'שקית': 'שק',
  // Roll
  'גליל': 'גליל', 'roll': 'גליל',
  // Liter
  'ליטר': 'ליטר', "ל'": 'ליטר', 'liter': 'ליטר',
  // Ton
  'טון': 'טון', 'ton': 'טון',
  // Sleeve
  'שרוול': 'שרוול', 'sleeve': 'שרוול',
  // Board
  'לוח': 'לוח', 'board': 'לוח',
  // Box (small)
  'קופסה': 'קופסה', "קופ'": 'קופסה',
  // Pallet
  'משטח': 'משטח', 'פלטה': 'משטח', 'pallet': 'משטח',
  // Set
  'סט': 'סט', 'מערכת': 'סט', 'set': 'סט',
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim()
    .replace(/\u05F4/g, '"')   // Hebrew gershayim ״ → ASCII "
    .replace(/\u05F3/g, "'")   // Hebrew geresh ׳ → ASCII '
    .toLowerCase();
  return UNIT_ALIASES[key] ?? raw.trim();
}

export function unitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return normalizeUnit(a) === normalizeUnit(b);
}
