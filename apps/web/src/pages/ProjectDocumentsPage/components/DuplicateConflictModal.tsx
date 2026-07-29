import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface DuplicateConflictModalProps {
  message: string;
  onCancel: () => void;
  onOverwrite: () => void;
}

export const DuplicateConflictModal = ({ message, onCancel, onOverwrite }: DuplicateConflictModalProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-base-100 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center">
            <AlertTriangle size={20} className="text-warning" />
          </div>
          <h3 className="text-lg font-bold text-base-content">{t('documents.duplicateDoc')}</h3>
        </div>
        <p className="text-sm text-base-content/60 mb-2">{message}</p>
        <p className="text-sm text-base-content/50 mb-6">{t('documents.overwritePrompt')}</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
            {t('common:cancel')}
          </button>
          <button
            onClick={onOverwrite}
            className="btn btn-warning btn-sm"
          >
            {t('documents.overwriteAndRescan')}
          </button>
        </div>
      </div>
    </div>
  );
};
