import { Link2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OrphanModalFooterProps {
  selectedCount: number;
  linking: boolean;
  isScanning: boolean;
  onClose: () => void;
  onLink: () => void;
}

export const OrphanModalFooter = ({ selectedCount, linking, isScanning, onClose, onLink }: OrphanModalFooterProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="flex items-center justify-between p-6 pt-4 border-t border-base-300">
      <span className="text-sm text-base-content/50">
        {selectedCount > 0 ? t('orphanModal.docsSelected', { count: selectedCount }) : t('orphanModal.noDocsSelected')}
      </span>
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
          {t('common:cancel')}
        </button>
        <button
          onClick={onLink}
          disabled={selectedCount === 0 || linking || isScanning}
          className="btn btn-sm btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linking ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          {isScanning ? t('orphanModal.waitingForScan') : t('orphanModal.assignToProject')}
        </button>
      </div>
    </div>
  );
};
