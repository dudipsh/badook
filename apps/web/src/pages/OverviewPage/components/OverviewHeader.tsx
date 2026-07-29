import { useTranslation } from 'react-i18next';
import { FilePlusIcon } from 'lucide-react';
import { ViewModeTabs } from './ViewModeTabs';

interface OverviewHeaderProps {
  viewMode: 'active' | 'archived';
  activeCount: number;
  archivedCount: number;
  onChangeMode: (mode: 'active' | 'archived') => void;
  onCreateOrder: () => void;
}

export const OverviewHeader = ({ viewMode, activeCount, archivedCount, onChangeMode, onCreateOrder }: OverviewHeaderProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-base-content">{t('overview.title')}</h1>
          <p className="text-sm sm:text-lg text-base-content/40 mt-1 sm:mt-2">{t('overview.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCreateOrder} className="rounded-[.5rem] btn btn-sm btn-primary inline-flex items-center gap-2">
            <FilePlusIcon size={18} />
            {t('overview.createOrder')}
          </button>
        </div>
      </div>
      <ViewModeTabs viewMode={viewMode} onChangeMode={onChangeMode} activeCount={activeCount} archivedCount={archivedCount} />
    </div>
  );
};
