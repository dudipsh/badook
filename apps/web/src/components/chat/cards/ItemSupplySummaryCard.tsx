import { motion } from 'framer-motion';
import { Package, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';
import { ItemSupplyKpis } from './ItemSupplyKpis';
import { ItemSupplySupplierTable } from './ItemSupplySupplierTable';
import { ItemSupplyInsight } from './ItemSupplyInsight';
import { ItemSupplyActions } from './ItemSupplyActions';
import { ItemSupplyBreakdown } from './ItemSupplyBreakdown';

interface Props {
  data: ItemSupplySummaryCardData;
  onDismiss: () => void;
}

export const ItemSupplySummaryCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const { filters } = data;
  const meta = [
    t('cards.itemSupply.metaItem', { item: data.itemQuery }),
    data.itemCode ? t('cards.itemSupply.metaCode', { code: data.itemCode }) : null,
    data.leadingSupplier ? t('cards.itemSupply.metaLeader', { name: data.leadingSupplier.name }) : null,
    filters.dateFrom || filters.dateTo
      ? t('cards.itemSupply.metaPeriod', { from: filters.dateFrom ?? '…', to: filters.dateTo ?? '…' })
      : null,
  ].filter(Boolean) as string[];
  const showBars = (data.groupBy === 'project' || data.groupBy === 'month') && data.breakdown.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[980px] rounded-2xl border border-base-200 bg-base-100 shadow-[0_4px_24px_rgb(0,0,0,0.06)] overflow-hidden"
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
          <Package className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-[18px] text-base-content leading-tight truncate">
              {filters.projectName
                ? t('cards.itemSupply.titleWithProject', { item: data.itemQuery, project: filters.projectName })
                : t('cards.itemSupply.title', { item: data.itemQuery })}
            </h4>
            <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0" />
          </div>
          {meta.length > 0 && (
            <p className="text-[13px] text-base-content/50 font-medium mt-1 line-clamp-2">
              {meta.join('  ·  ')}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label={t('close')}
          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        {data.matchedLineCount === 0 ? (
          <p className="text-[15px] text-base-content/50">{t('cards.itemSupply.noResults')}</p>
        ) : (
          <>
            <ItemSupplyKpis data={data} />
            <ItemSupplySupplierTable data={data} />
            {showBars && <ItemSupplyBreakdown data={data} />}
            {data.priceInsight && <ItemSupplyInsight insight={data.priceInsight} />}
            <ItemSupplyActions data={data} />
            {data.truncated && (
              <p className="mt-2 text-[13px] text-warning/80">{t('cards.itemSupply.truncated')}</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
