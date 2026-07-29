import { useMemo } from 'react';
import type { ItemGroup } from '../utils/groupItems';

export const useLinkedDocuments = (items: ItemGroup['items']) => {
  const uniquePOs = useMemo(() => {
    const map = new Map<string, { id: string; num: string }>();
    items.forEach((i) => {
      if (i.poId || i.poNumber) map.set(i.poId || i.poNumber, { id: i.poId || i.poNumber, num: i.poNumber });
    });
    return Array.from(map.values());
  }, [items]);

  const uniqueDCs = useMemo(() => {
    const map = new Map<string, { id: string; num: string }>();
    items.forEach((i) => {
      if (i.dnId && i.dnNoteNumber) map.set(i.dnId, { id: i.dnId, num: `DN# ${i.dnNoteNumber}` });
    });
    return Array.from(map.values());
  }, [items]);

  const uniqueInvoices = useMemo(() => {
    const map = new Map<string, { id: string; num: string }>();
    items.forEach((i) => {
      if (i.invoiceId && i.invoiceNumber) map.set(i.invoiceId, { id: i.invoiceId, num: `Inv# ${i.invoiceNumber}` });
    });
    return Array.from(map.values());
  }, [items]);

  return { uniquePOs, uniqueDCs, uniqueInvoices };
};
