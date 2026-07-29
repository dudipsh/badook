/**
 * Parse a date string, preferring DD/MM/YY (Israeli format) over MM/DD/YY (American format).
 * Falls back to native Date parsing for ISO strings (YYYY-MM-DD).
 */
export function safeParseDate(value: string | undefined | null): Date | null {
  if (!value) return null;

  // 1. Try DD/MM/YY or DD/MM/YYYY regex FIRST (Israeli format takes priority)
  const ddmmyy = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (ddmmyy) {
    const day = Number(ddmmyy[1]);
    const month = Number(ddmmyy[2]);
    const year = ddmmyy[3].length === 2 ? 2000 + Number(ddmmyy[3]) : Number(ddmmyy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month - 1, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 2. Try native Date parsing (handles ISO "YYYY-MM-DD" strings)
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    // Sanity check: documents in this system are from 2020+.
    // A year before 2020 is almost certainly a mis-parsed DD/MM/YY date.
    if (d.getFullYear() < 2020) return null;
    return d;
  }

  return null;
}
