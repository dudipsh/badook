import type { ReconciliationLineItem } from '../../../types/reconciliation';

export interface ItemGroup {
  key: string;
  label: string;
  date: string | null;
  items: ReconciliationLineItem[];
  total: number;
  currency: string;
  fileUrl: string | null;
}

export const groupItems = (items: ReconciliationLineItem[]): ItemGroup[] => {
  if (items.length === 0) return [];

  const groupMap = new Map<string, ItemGroup>();

  for (const item of items) {
    let key: string;
    let label: string;
    let date: string | null;

    if (item.groupBy === 'deliveryNotes') {
      key = item.dnId || item.poId || 'unknown';
      label = item.dnNoteNumber ? `DN# ${item.dnNoteNumber}` : `PO# ${item.poNumber}`;
      date = item.dnDeliveryDate || null;
    } else if (item.groupBy === 'invoices') {
      key = item.invoiceId || item.poId || 'unknown';
      label = item.invoiceNumber ? `Inv# ${item.invoiceNumber}` : `PO# ${item.poNumber}`;
      date = item.invoiceDate || null;
    } else {
      key = item.poId || 'unknown';
      label = `PO# ${item.poNumber}`;
      date = null;
    }

    if (!groupMap.has(key)) {
      let fileUrl: string | null = null;
      if (item.groupBy === 'deliveryNotes') {
        fileUrl = item.relatedDocuments?.find(d => d.type === 'DC')?.fileUrl || null;
      } else if (item.groupBy === 'invoices') {
        fileUrl = item.relatedDocuments?.find(d => d.type === 'INV')?.fileUrl || null;
      } else {
        fileUrl = item.relatedDocuments?.find(d => d.type === 'PO')?.fileUrl || null;
      }
      // Fallback: if type-specific doc has no fileUrl, try any doc with a fileUrl
      if (!fileUrl) {
        fileUrl = item.relatedDocuments?.find(d => d.fileUrl)?.fileUrl || null;
      }
      groupMap.set(key, { key, label, date, items: [], total: 0, currency: item.currency || 'ILS', fileUrl });
    }
    const group = groupMap.get(key)!;
    group.items.push(item);
    group.total += item.lineTotal || 0;
  }

  for (const group of groupMap.values()) {
    if (group.items[0]?.groupBy !== 'deliveryNotes') continue;
    const items = group.items;
    let i = 0;
    while (i < items.length) {
      let j = i;
      while (j + 1 < items.length && items[j + 1].description === items[i].description) j++;
      if (j > i) {
        const ordered = items[i].orderedQty ?? 0;
        let received = 0;
        for (let k = i; k <= j; k++) received += items[k].quantity ?? 0;
        const shortage = ordered - received;
        for (let k = i; k < j; k++) {
          items[k] = { ...items[k], _hideShortageBadge: true };
        }
        items[j] = {
          ...items[j],
          _shortageAnchor: shortage > 0.0001,
          _aggregateOrdered: ordered,
          _aggregateReceived: received,
          _aggregateShortage: shortage,
        };
      }
      i = j + 1;
    }
  }

  return Array.from(groupMap.values());
};
