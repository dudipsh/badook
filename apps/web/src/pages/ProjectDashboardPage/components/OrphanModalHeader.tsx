import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OrphanModalHeaderProps {
  isScanning: boolean;
  onClose: () => void;
}

export const OrphanModalHeader = ({ isScanning, onClose }: OrphanModalHeaderProps) => {
  const { t } = useTranslation('projects');

  return (
    <>
      <div className="flex items-center justify-between p-6 pb-4 border-b border-base-300">
        <div>
          <h2 className="text-lg font-bold text-base-content">{t('orphanModal.title')}</h2>
          <p className="text-sm text-base-content/50 mt-0.5">{t('orphanModal.subtitle')}</p>
        </div>
        <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors">
          <X size={20} />
        </button>
      </div>

      {isScanning && (
        <div className="mx-6 mt-4 flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          <Loader2 size={16} className="animate-spin text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-warning">{t('orphanModal.activeScan')}</p>
            <p className="text-xs text-warning/80">{t('orphanModal.scanWarning')}</p>
          </div>
        </div>
      )}
    </>
  );
};
