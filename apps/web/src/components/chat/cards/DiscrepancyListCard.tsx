import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DiscrepancyListCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';
import { ChatCardShell } from './ChatCardShell';

interface Props {
  data: DiscrepancyListCardData;
  onDismiss: () => void;
}

const MAX_ROWS = 5;

const STATUS_STYLE: Record<string, string> = {
  PARTIAL: 'bg-warning/15 text-warning',
  DISCREPANCY: 'bg-error/15 text-error',
  UNMATCHED: 'bg-base-300/60 text-base-content/60',
};

export const DiscrepancyListCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const shown = data.discrepancies.slice(0, MAX_ROWS);
  const remaining = data.count - shown.length;

  return (
    <ChatCardShell
      title={t('cards.discrepancies.title')}
      subtitle={t('cards.discrepancies.count', { count: data.count })}
      Icon={AlertTriangle}
      accent="warning"
      onDismiss={onDismiss}
    >
      <div className="flex flex-col gap-1.5">
        {shown.map((d) => (
          <div key={d.id} className="rounded-xl bg-base-200/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  STATUS_STYLE[d.status] ?? STATUS_STYLE.UNMATCHED
                }`}
              >
                {t(`cards.discrepancies.status.${d.status}`, d.status)}
              </span>
              <span className="text-[13px] font-semibold text-base-content truncate flex-1">
                {d.supplierName ?? t('cards.discrepancies.unknownSupplier')}
              </span>
              {d.poNumber && (
                <span className="text-[11px] text-base-content/40 font-medium shrink-0">
                  {t('cards.abbr.po')} {d.poNumber}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px]">
              <span className="text-base-content/50 truncate">{d.projectName ?? '—'}</span>
              {(d.totalInvoiceAmountIls > 0 || d.totalPoAmountIls > 0) && (
                <span className="text-base-content/60 tabular-nums shrink-0">
                  {formatCurrency(d.totalInvoiceAmountIls)} / {formatCurrency(d.totalPoAmountIls)}
                </span>
              )}
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <p className="text-[12px] text-base-content/40 font-medium text-center pt-1">
            {t('cards.more', { count: remaining })}
          </p>
        )}
      </div>
    </ChatCardShell>
  );
};
