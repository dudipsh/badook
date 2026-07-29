/**
 * Shared currency & number formatting utilities.
 * Eliminates duplication across LineItemRow, StatCardsRow, etc.
 */
import i18n from '../i18n';

export function getLocale(): string {
  return i18n.language === 'he' ? 'he-IL' : 'en-US';
}

export function formatCurrency(amount: number | null | undefined, currency = 'ILS'): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Round to 3 decimals and strip trailing zeros: 3.5640 → 3.564, 43.030 → 43.03 */
export function fmtQty(n: number | null | undefined): string {
  if (n == null) return '—';
  return parseFloat(n.toFixed(3)).toString();
}
