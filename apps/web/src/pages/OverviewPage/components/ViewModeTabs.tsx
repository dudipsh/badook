import { useTranslation } from 'react-i18next';
import { Building2, Archive } from 'lucide-react';

interface ViewModeTabsProps {
  viewMode: string;
  onChangeMode: (m: 'active' | 'archived') => void;
  activeCount: number;
  archivedCount: number;
}

const tabClass = (isActive: boolean) =>
  `flex items-center gap-2 px-6 py-3 text-base font-medium border-b-2 -mb-px transition-colors outline-none focus-visible:bg-base-200/60 focus-visible:rounded-t-md ${
    isActive
      ? 'border-primary border-color-primary text-primary font-bold '
      : 'border-transparent text-base-content/60 hover:text-base-content'
  }`;

const Count = ({ value, isActive }: { value: number; isActive: boolean }) => (
  <span className={`font-mono tabular-nums text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
    ({value})
  </span>
);

export const ViewModeTabs = ({ viewMode, onChangeMode, activeCount, archivedCount }: ViewModeTabsProps) => {
  const { t } = useTranslation('projects');
  return (
    <div className="flex gap-0 mt-6 border-b border-base-300">
      <button
        onClick={() => onChangeMode('active')}
        className={tabClass(viewMode === 'active')}
      >
        <Building2 size={16} />
        <span>{t('overview.active')}</span>
        <Count value={activeCount} isActive={viewMode === 'active'} />
      </button>
      <button
        onClick={() => onChangeMode('archived')}
        className={tabClass(viewMode === 'archived')}
      >
        <Archive size={16} />
        <span>{t('overview.archive')}</span>
        <Count value={archivedCount} isActive={viewMode === 'archived'} />
      </button>
    </div>
  );
};
