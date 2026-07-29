import { FolderKanban, FileText, ScrollText, ReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectSummaryCardData } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';
import { ChatCardShell } from './ChatCardShell';
import { MatchRateRing } from './MatchRateRing';

interface Props {
  data: ProjectSummaryCardData;
  onDismiss: () => void;
}

const NON_MATCHED = ['PARTIAL', 'DISCREPANCY', 'UNMATCHED'];

export const ProjectSummaryCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const discrepancyCount = NON_MATCHED.reduce((sum, s) => sum + (data.matchSummary[s] ?? 0), 0);

  return (
    <ChatCardShell
      title={data.name}
      subtitle={data.address ?? undefined}
      Icon={FolderKanban}
      accent="secondary"
      onDismiss={onDismiss}
    >
      <div className="flex items-center gap-4">
        {data.matchRate !== null ? (
          <MatchRateRing rate={data.matchRate} label={t('cards.project.matchRate')} />
        ) : null}

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-xl bg-base-200/50 px-3 py-2">
            <span className="text-[12px] text-base-content/50 font-medium">{t('cards.project.invoiced')}</span>
            <span className="text-[14px] font-bold text-base-content tabular-nums">
              {formatCurrency(data.totalInvoiceAmountIls)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-base-200/50 px-3 py-2">
            <span className="text-[12px] text-base-content/50 font-medium">{t('cards.project.ordered')}</span>
            <span className="text-[14px] font-bold text-base-content tabular-nums">
              {formatCurrency(data.totalPurchaseOrderAmountIls)}
            </span>
          </div>
          {discrepancyCount > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-warning/10 px-3 py-2">
              <span className="text-[12px] text-warning/80 font-medium">{t('cards.project.discrepancies')}</span>
              <span className="text-[14px] font-bold text-warning tabular-nums">{discrepancyCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <CountChip Icon={ScrollText} value={data.deliveryNoteCount} label={t('cards.project.deliveryNotes')} />
        <CountChip Icon={FileText} value={data.purchaseOrderCount} label={t('cards.project.purchaseOrders')} />
        <CountChip Icon={ReceiptText} value={data.invoiceCount} label={t('cards.project.invoices')} />
      </div>
    </ChatCardShell>
  );
};

const CountChip = ({
  Icon,
  value,
  label,
}: {
  Icon: typeof FileText;
  value: number;
  label: string;
}) => (
  <div className="flex flex-col items-center gap-1 rounded-xl bg-base-200/50 py-2.5">
    <Icon className="w-4 h-4 text-base-content/40" />
    <span className="text-[15px] font-bold text-base-content tabular-nums leading-none">{value}</span>
    <span className="text-[10px] text-base-content/50 font-medium">{label}</span>
  </div>
);
