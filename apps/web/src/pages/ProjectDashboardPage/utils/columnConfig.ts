import type { GroupByValue } from '../../../types/reconciliation';

export type ColumnKey =
  | 'item' | 'quantity' | 'pricePerUnit'
  | 'received' | 'remaining' | 'invoiced'
  | 'lineTotal' | 'action';

const HIDDEN_COLS: Record<string, ColumnKey[]> = {
  deliveryNotes: ['pricePerUnit', 'invoiced', 'lineTotal'],
  invoices: ['remaining'],
};

export const isColVisible = (
  key: ColumnKey, groupBy: GroupByValue,
): boolean => !(HIDDEN_COLS[groupBy] ?? []).includes(key);

export const getColCount = (groupBy: GroupByValue): number =>
  8 - (HIDDEN_COLS[groupBy] ?? []).length;
