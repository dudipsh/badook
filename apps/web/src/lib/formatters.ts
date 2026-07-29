import { format } from 'date-fns';
import type { TFunction } from 'i18next';

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy');
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy HH:mm');
}

export function translateUnit(unit: string | null | undefined, t: TFunction): string {
  if (!unit) return '';
  const key = `createPO.uom_${unit}`;
  const translated = t(key);
  return translated !== key ? translated : unit;
}
