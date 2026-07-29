import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';

export const DeleteConfirmModal = observer(() => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');

  const item = projectDashboardStore.deletingLineItem;
  const mode = projectDashboardStore.deleteConfirmMode;
  const isDeleting = projectDashboardStore.deleteInProgress;

  if (!item || !mode) return null;

  const title = mode === 'line'
    ? t('deleteModal.confirmDeleteRowTitle')
    : t('deleteModal.confirmDeleteDocTitle');

  const message = mode === 'line'
    ? t('deleteModal.confirmDeleteRowMessage', { description: item.description })
    : t('deleteModal.confirmDeleteDocMessage');

  const handleConfirm = async () => {
    try {
      await projectDashboardStore.confirmDelete();
      toast.success(t('deleteModal.deleteSuccess'));
    } catch {
      toast.error(t('deleteModal.deleteError'));
    }
  };

  const handleCancel = () => {
    projectDashboardStore.cancelDeleteConfirm();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
      <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-error/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-error" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-base-content">{title}</h3>
            <p className="text-sm text-base-content/50 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors"
          >
            {t('common:cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="btn btn-error btn-sm gap-2"
          >
            <Trash2 size={14} />
            {isDeleting ? t('deleteModal.deleting') : t('deleteModal.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  );
});
