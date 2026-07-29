import { useTranslation } from 'react-i18next';
import { Archive, RotateCcw } from 'lucide-react';

export const ArchivedBanner = ({ onRestore }: { onRestore: () => void }) => {
  const { t } = useTranslation('projects');
  return (
    <div className="shrink-0 mb-3 flex items-center gap-3 bg-base-200 border border-base-300 rounded-lg px-4 py-3">
      <Archive size={16} className="text-base-content/50" />
      <span className="text-sm text-base-content/60 font-medium">{t('dashboard.archivedBanner')}</span>
      <button onClick={onRestore} className="mr-auto inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary font-medium">
        <RotateCcw size={14} />
        {t('dashboard.restore')}
      </button>
    </div>
  );
};
