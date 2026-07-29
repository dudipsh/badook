import { AlertTriangle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ConfirmAction = 'delete' | 'block';

interface OrphanConfirmModalProps {
  action: ConfirmAction;
  senderEmail?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/* Confirmation modal for orphan doc delete / block actions */
export const OrphanConfirmModal = ({ action, senderEmail, loading, onConfirm, onCancel }: OrphanConfirmModalProps) => {
  const { t } = useTranslation('settings');

  const title = action === 'block'
    ? t('orphan.confirmModal.blockTitle')
    : t('orphan.confirmModal.deleteTitle');

  const message = action === 'block'
    ? t('orphan.confirmModal.blockMessage', { email: senderEmail })
    : t('orphan.confirmModal.deleteMessage');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
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
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors"
          >
            {t('orphan.confirmModal.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-error btn-sm gap-2"
          >
            <Trash2 size={14} />
            {loading ? t('orphan.confirmModal.processing') : t('orphan.confirmModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
