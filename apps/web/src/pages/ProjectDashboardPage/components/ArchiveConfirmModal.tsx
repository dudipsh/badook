import { useTranslation } from 'react-i18next';
import { Archive, AlertTriangle } from 'lucide-react';

interface ArchiveConfirmModalProps {
  projectName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ArchiveConfirmModal = ({ projectName, onConfirm, onClose }: ArchiveConfirmModalProps) => {
  const { t } = useTranslation('projects');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-base-content">{t('archiveConfirm.title')}</h3>
            <p className="text-sm text-base-content/50 mt-1">
              {t('archiveConfirm.message', { projectName })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
            {t('common:cancel')}
          </button>
          <button
            onClick={() => { onClose(); onConfirm(); }}
            className="btn btn-warning btn-sm gap-2"
          >
            <Archive size={14} />
            {t('archiveConfirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
