import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ItemSupplySource,
  ItemSupplySummaryCardData,
} from '../../../services/chat.service';
import { formatCurrency, fmtQty } from '../../../lib/currencyUtils';
import { formatDate } from '../../../lib/formatters';
import { useStores } from '../../../lib/store-context';
import { DOC_TYPE_BADGE } from '../docType';

interface Props {
  data: ItemSupplySummaryCardData;
}

const SourceCell = ({ source }: { source: ItemSupplySource | null }) => {
  const { t } = useTranslation('chat');
  if (!source?.number) return <span className="text-base-content/30">—</span>;
  const badge = DOC_TYPE_BADGE[source.type];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${badge.cls}`}>{t(badge.labelKey)}</span>
      <span className="text-[13px] text-base-content/60 tabular-nums">{source.number}</span>
    </span>
  );
};

const periodLabel = (from: string | null, to: string | null): string => {
  if (!from && !to) return '—';
  if (from && to && from !== to) return `${formatDate(from)} – ${formatDate(to)}`;
  return formatDate(from ?? to);
};

export const ItemSupplySupplierTable = ({ data }: Props) => {
  const { t } = useTranslation('chat');
  const { chatStore } = useStores();
  const rows = data.supplierBreakdown;
  const totalQty = rows.reduce((s, r) => s + r.totalQuantity, 0);
  const totalSpend = rows.reduce((s, r) => s + r.totalSpend, 0);
  const verified = rows.filter((r) => r.source?.number).length;

  const openDoc = (source: ItemSupplySource | null) => {
    if (!source?.docId) return;
    chatStore.openDocument({ type: source.type, id: source.docId, highlightItem: data.itemQuery });
  };

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between mb-1.5 px-0.5">
        <span className="text-[14px] font-bold text-base-content">{t('cards.itemSupply.tableTitle')}</span>
        <span className="text-[12px] text-base-content/40">
          {t('cards.itemSupply.tableMeta', { count: rows.length })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-base-200">
        <table className="table table-sm">
          <thead>
            <tr className="text-[13px] text-base-content/50">
              <th className="text-start font-medium">{t('cards.itemSupply.colSupplier')}</th>
              <th className="text-start font-medium tabular-nums">{t('cards.itemSupply.colQty')}</th>
              <th className="text-start font-medium tabular-nums">{t('cards.itemSupply.colUnitPrice')}</th>
              <th className="text-start font-medium tabular-nums">{t('cards.itemSupply.colTotal')}</th>
              <th className="text-start font-medium">{t('cards.itemSupply.colPeriod')}</th>
              <th className="text-start font-medium">{t('cards.itemSupply.colVerified')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const clickable = !!r.source?.docId;
              return (
                <tr
                  key={r.key}
                  className={`text-[14px] ${clickable ? 'cursor-pointer hover:bg-base-200/50 transition-colors' : ''}`}
                  onClick={clickable ? () => openDoc(r.source) : undefined}
                  title={clickable ? t('cards.itemSupply.openDocHint') : undefined}
                >
                  <td className="font-medium text-base-content">
                    <span className="truncate">{r.label}</span>
                    {i === 0 && (
                      <span className="ms-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold align-middle">
                        {t('cards.itemSupply.leaderTag')}
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums">{fmtQty(r.totalQuantity)}</td>
                  <td className="tabular-nums">{r.avgUnitPrice != null ? formatCurrency(r.avgUnitPrice) : '—'}</td>
                  <td className="tabular-nums font-semibold">{formatCurrency(r.totalSpend)}</td>
                  <td className="text-[13px] text-base-content/60 whitespace-nowrap">
                    {periodLabel(r.firstDate, r.lastDate)}
                  </td>
                  <td><SourceCell source={r.source} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-[14px] font-bold border-t-2 border-base-200">
              <td>{t('cards.itemSupply.totalRow')}</td>
              <td className="tabular-nums">{fmtQty(totalQty)}</td>
              <td className="text-base-content/30">—</td>
              <td className="tabular-nums">{formatCurrency(totalSpend)}</td>
              <td className="text-base-content/30">—</td>
              <td className="text-[12px] font-medium text-success inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {t('cards.itemSupply.verifiedOf', { verified, total: rows.length })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
