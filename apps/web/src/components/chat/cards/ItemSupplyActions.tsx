import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';

interface Props {
  data: ItemSupplySummaryCardData;
}

const csvCell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const ItemSupplyActions = ({ data }: Props) => {
  const { t } = useTranslation('chat');

  const exportCsv = () => {
    const header = [
      t('cards.itemSupply.colSupplier'),
      t('cards.itemSupply.colQty'),
      t('cards.itemSupply.colUnitPrice'),
      t('cards.itemSupply.colTotal'),
      t('cards.itemSupply.colVerified'),
    ];
    const rows = data.supplierBreakdown.map((r) => [
      r.label,
      r.totalQuantity,
      r.avgUnitPrice ?? '',
      r.totalSpend,
      r.source?.number ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.itemQuery}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
      <button
        onClick={exportCsv}
        className="btn btn-xs btn-ghost rounded-full gap-1.5 text-base-content/60 hover:text-base-content"
      >
        <Download className="w-3.5 h-3.5" />
        {t('cards.itemSupply.exportCsv')}
      </button>
      <span className="text-[12px] text-base-content/40">
        {t('cards.itemSupply.sourceFooter', {
          invoices: data.sourceDocCounts.invoices,
          deliveryNotes: data.sourceDocCounts.deliveryNotes,
        })}
      </span>
    </div>
  );
};
