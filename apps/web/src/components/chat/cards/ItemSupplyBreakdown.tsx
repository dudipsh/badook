import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ItemSupplySummaryCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';
import { useStores } from '../../../lib/store-context';

interface Props {
  data: ItemSupplySummaryCardData;
}

const TITLE_KEY: Record<string, string> = {
  project: 'cards.itemSupply.breakdownByProject',
  supplier: 'cards.itemSupply.breakdownBySupplier',
  month: 'cards.itemSupply.breakdownByMonth',
};

const MAX_ROWS = 8;

export const ItemSupplyBreakdown = ({ data }: Props) => {
  const { t } = useTranslation('chat');
  const { chatStore } = useStores();
  const navigate = useNavigate();
  const max = Math.max(...data.breakdown.map((r) => r.totalQuantity), 1);
  const titleKey = TITLE_KEY[data.groupBy];

  const openProject = (id: string) => {
    chatStore.close();
    navigate(`/projects/${id}`);
  };

  return (
    <div className="mt-3">
      {titleKey && (
        <p className="text-[13px] text-base-content/50 font-medium mb-1.5">{t(titleKey)}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {data.breakdown.slice(0, MAX_ROWS).map((row) => {
          const clickable = data.groupBy === 'project' && !!row.id;
          return (
            <div
              key={row.key}
              className={`relative rounded-lg bg-base-200/40 overflow-hidden ${
                clickable ? 'cursor-pointer hover:bg-base-200/70 transition-colors' : ''
              }`}
              onClick={clickable ? () => openProject(row.id as string) : undefined}
              title={clickable ? t('cards.itemSupply.openProjectHint') : undefined}
            >
              <div
                className="absolute inset-y-0 start-0 bg-primary/15"
                style={{ width: `${Math.round((row.totalQuantity / max) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 gap-2">
                <span className="text-[14px] font-medium text-base-content truncate">{row.label}</span>
                <span className="text-[14px] font-bold text-base-content tabular-nums shrink-0">
                  {row.totalQuantity.toLocaleString('he-IL', { maximumFractionDigits: 2 })}
                  {data.dominantUnit ? ` ${data.dominantUnit}` : ''}
                  {row.totalSpend > 0 ? ` · ${formatCurrency(row.totalSpend)}` : ''}
                </span>
              </div>
            </div>
          );
        })}
        {data.breakdown.length > MAX_ROWS && (
          <p className="text-[12px] text-base-content/40">
            {t('cards.more', { count: data.breakdown.length - MAX_ROWS })}
          </p>
        )}
      </div>
    </div>
  );
};
