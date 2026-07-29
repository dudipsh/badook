import { Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompanyOverviewCardData } from '../../../services/chat.service';
import { ChatCardShell } from './ChatCardShell';
import { CardStatTile } from './CardStatTile';

interface Props {
  data: CompanyOverviewCardData;
  onDismiss: () => void;
}

export const CompanyOverviewCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const totalMatches = data.matchedCount + data.unmatchedOrPartialCount;
  const matchRate = totalMatches > 0 ? Math.round((data.matchedCount / totalMatches) * 100) : null;

  return (
    <ChatCardShell title={t('cards.overview.title')} Icon={Building2} accent="primary" onDismiss={onDismiss}>
      <div className="grid grid-cols-3 gap-2">
        <CardStatTile label={t('cards.overview.projects')} value={data.projectCount} />
        <CardStatTile label={t('cards.overview.suppliers')} value={data.supplierCount} />
        <CardStatTile label={t('cards.overview.invoices')} value={data.invoiceCount} />
        <CardStatTile label={t('cards.overview.deliveryNotes')} value={data.deliveryNoteCount} />
        <CardStatTile label={t('cards.overview.purchaseOrders')} value={data.purchaseOrderCount} />
        {matchRate !== null && (
          <div className="rounded-xl bg-primary/10 px-3 py-2.5 flex flex-col gap-0.5">
            <span className="text-[20px] font-bold text-primary leading-none tabular-nums">{matchRate}%</span>
            <span className="text-[11px] text-primary/70 font-medium leading-tight">{t('cards.overview.matchRate')}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-2.5">
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <span className="text-[13px] font-semibold text-success tabular-nums">{data.matchedCount}</span>
          <span className="text-[12px] text-base-content/60">{t('cards.overview.matched')}</span>
        </div>
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <span className="text-[13px] font-semibold text-warning tabular-nums">{data.unmatchedOrPartialCount}</span>
          <span className="text-[12px] text-base-content/60">{t('cards.overview.unmatched')}</span>
        </div>
      </div>
    </ChatCardShell>
  );
};
