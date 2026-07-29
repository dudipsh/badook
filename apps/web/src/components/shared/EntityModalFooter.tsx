import { useTranslation } from 'react-i18next';
import { Loader2, GitMerge, Trash2 } from 'lucide-react';

interface EntityModalFooterProps {
  isDelete: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  canConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const EntityModalFooter = ({ isDelete, status, canConfirm, onClose, onConfirm }: EntityModalFooterProps) => {
  const { t } = useTranslation('projects');
  const busy = status === 'loading' || status === 'success';

  return (
    <div className="px-6 py-4 bg-base-200/50 border-t border-base-200 flex justify-end gap-3">
      <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>{t('entityActions.cancel')}</button>
      <button className={`btn btn-sm gap-2 min-w-[120px] ${isDelete ? 'btn-error' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || !canConfirm}>
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {status !== 'loading' && isDelete && <Trash2 className="w-4 h-4 shrink-0" />}
        {status !== 'loading' && !isDelete && <GitMerge className="w-4 h-4 shrink-0" />}
        {status === 'loading' ? t('entityActions.processing') : isDelete ? t('entityActions.deleteConfirm') : t('entityActions.mergeConfirm')}
      </button>
    </div>
  );
};
