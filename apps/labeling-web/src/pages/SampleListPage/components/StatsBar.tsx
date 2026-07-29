import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '@/stores/store-context';
import { FileText, CheckCircle, Clock, Sparkles } from 'lucide-react';
import type { SampleStatus } from '@/types/sample.types';

const statusIcons: Record<SampleStatus, typeof FileText> = {
  PENDING: Clock,
  AUTO_EXTRACTED: Sparkles,
  LABELED: FileText,
  VERIFIED: CheckCircle,
};

const StatsBar = observer(() => {
  const { t } = useTranslation();
  const { samplesStore } = useStores();
  const { stats } = samplesStore;

  if (!stats) return null;

  const statuses: SampleStatus[] = ['PENDING', 'AUTO_EXTRACTED', 'LABELED', 'VERIFIED'];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="stat bg-base-100 rounded-box shadow-sm p-4">
        <div className="stat-title text-xs">{t('stats.total')}</div>
        <div className="stat-value text-2xl">{stats.total}</div>
      </div>
      {statuses.map((status) => {
        const Icon = statusIcons[status];
        return (
          <div key={status} className="stat bg-base-100 rounded-box shadow-sm p-4">
            <div className="stat-figure text-primary">
              <Icon className="w-5 h-5" />
            </div>
            <div className="stat-title text-xs">{t(`status.${status}`)}</div>
            <div className="stat-value text-2xl">{stats.byStatus[status] ?? 0}</div>
          </div>
        );
      })}
    </div>
  );
});

export default StatsBar;
