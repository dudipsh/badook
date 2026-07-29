import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../lib/store-context';

interface ResetConfirmModalProps {
  onClose: () => void;
}

export const ResetConfirmModal = ({ onClose }: ResetConfirmModalProps) => {
  const { t } = useTranslation('projects');
  const { adminStore, projectsStore } = useStores();
  const [resetting, setResetting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await adminStore.resetAllData(deleteFeedback);
      await adminStore.deleteAllMatches(deleteFeedback);
      toast.success(t('reset.resetSuccess'));
      onClose();
      projectsStore.fetchProjects();
    } catch {
      toast.error(t('reset.resetError'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-base-content mb-2">{t('reset.title')}</h3>
        <p className="text-sm text-base-content/50 mb-4">
          {t('reset.description')}
        </p>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteFeedback}
            onChange={(e) => setDeleteFeedback(e.target.checked)}
            className="rounded border-base-300"
          />
          <span className="text-sm text-base-content">{t('reset.deleteFeedback')}</span>
        </label>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
            {t('common:cancel')}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn btn-error btn-sm gap-2"
          >
            {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {resetting ? t('reset.resetting') : t('reset.resetAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
