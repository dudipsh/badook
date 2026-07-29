import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { isColVisible, type ColumnKey } from '../utils/columnConfig';

export const LineItemsTableHeader = observer(() => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const { groupBy } = projectDashboardStore;

  const getLabel = (key: string, defaultLabel: string): string => {
    if (groupBy === 'deliveryNotes') {
      if (key === 'quantity') return t('lineItems.orderedFromPO');
      if (key === 'received') return t('lineItems.suppliedInShipment');
    }
    if (groupBy === 'invoices') {
      if (key === 'invoiced') return t('lineItems.charged');
    }
    return defaultLabel;
  };

  const allHeaders: { key: ColumnKey; label: string; minW: string; align: string; px: string }[] = [
    { key: 'item', label: getLabel('item', t('lineItems.item')), minW: 'min-w-[200px]', align: 'text-start', px: 'px-6' },
    { key: 'quantity', label: getLabel('quantity', t('lineItems.quantity')), minW: 'min-w-[80px]', align: 'text-end', px: 'px-3' },
    { key: 'pricePerUnit', label: getLabel('pricePerUnit', t('lineItems.pricePerUnit')), minW: 'min-w-[100px]', align: 'text-end', px: 'px-4' },
    { key: 'received', label: getLabel('received', t('lineItems.received')), minW: 'min-w-[100px]', align: 'text-end', px: 'px-4' },
    { key: 'remaining', label: getLabel('remaining', t('lineItems.remaining')), minW: 'min-w-[90px]', align: 'text-end', px: 'px-4' },
    { key: 'invoiced', label: getLabel('invoiced', t('lineItems.invoice')), minW: 'min-w-[100px]', align: 'text-end', px: 'px-4' },
    { key: 'lineTotal', label: getLabel('lineTotal', t('lineItems.lineTotal')), minW: 'min-w-[110px]', align: 'text-end', px: 'px-4' },
    { key: 'action', label: getLabel('action', t('lineItems.action')), minW: 'min-w-[100px]', align: 'text-center', px: 'px-4' },
  ];

  const headers = allHeaders.filter((h) => isColVisible(h.key, groupBy));

  return (
    <thead>
      <tr className="text-base-content/40/60 uppercase text-xs">
        {headers.map((h, i) => (
          <th key={h.key} className={`${h.align} text-xs font-semibold tracking-wider ${h.px} py-0 h-9 ${h.minW} whitespace-nowrap sticky top-0 z-[20] bg-base-100 border-b border-base-300 ${i > 0 ? 'border-s border-base-300/50' : ''}`}>
            {h.label}
          </th>
        ))}
      </tr>
    </thead>
  );
});
