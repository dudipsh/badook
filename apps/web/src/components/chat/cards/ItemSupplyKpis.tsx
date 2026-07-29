import { useTranslation } from 'react-i18next';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';

interface Props {
  data: ItemSupplySummaryCardData;
}

const money0 = (n: number) => formatCurrency(Math.round(n));
const qty = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 2 });

const Tile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl bg-base-200/40 px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
    <span className="text-[13px] text-base-content/50 font-medium truncate">{label}</span>
    <span className="text-[20px] font-bold text-base-content leading-none tabular-nums truncate">
      {value}
    </span>
    {hint && <span className="text-[12px] text-base-content/40 truncate">{hint}</span>}
  </div>
);

export const ItemSupplyKpis = ({ data }: Props) => {
  const { t } = useTranslation('chat');
  const lead = data.leadingSupplier;
  const unit = data.dominantUnit ?? '';
  const total = data.totalsByUnit[0];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Tile
        label={t('cards.itemSupply.spendAt', { name: lead?.name ?? '—' })}
        value={lead ? money0(lead.totalSpend) : '—'}
        hint={lead ? `${qty(lead.totalQuantity)} ${unit}`.trim() : undefined}
      />
      <Tile
        label={t('cards.itemSupply.leaderShare')}
        value={lead ? `${qty(lead.sharePct)}%` : '—'}
        hint={lead?.name}
      />
      <Tile
        label={t('cards.itemSupply.totalSpend')}
        value={data.price.totalSpend > 0 ? money0(data.price.totalSpend) : '—'}
        hint={t('cards.itemSupply.acrossSuppliers', { count: data.supplierBreakdown.length })}
      />
      <Tile
        label={t('cards.itemSupply.totalQuantity')}
        value={total ? qty(total.totalQuantity) : '—'}
        hint={unit || undefined}
      />
    </div>
  );
};
