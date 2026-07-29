import { useState, useEffect } from 'react';
import { X, Edit2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialName: string;
  initialAddress: string;
  onSave: (id: string, name: string, address: string) => Promise<void>;
}

export const EditProjectModal = ({
  isOpen,
  onClose,
  projectId,
  initialName,
  initialAddress,
  onSave,
}: EditProjectModalProps) => {
  const { t } = useTranslation('projects');
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setAddress(initialAddress);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, initialName, initialAddress]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage(t('editProject.nameRequired'));
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    try {
      await onSave(projectId, name.trim(), address.trim());
      setStatus('success');
      setTimeout(() => onClose(), 800);
    } catch {
      setStatus('error');
      setErrorMessage(t('editProject.saveError'));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-base-300/60 backdrop-blur-sm p-4" onClick={status !== 'loading' ? onClose : undefined}>
      <div
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-base-200"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        <div className="p-5 flex items-start justify-between border-b border-base-200 bg-base-100/50">
          <div className="flex gap-3 items-center">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Edit2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg">{t('editProject.title')}</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-square" disabled={status === 'loading'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="form-control w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase tracking-wider opacity-60">
                {t('editProject.nameLabel')} <span className="text-error">*</span>
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full font-medium sm:text-sm rtl:text-right ltr:text-left"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === 'loading' || status === 'success'}
              placeholder={t('editProject.namePlaceholder')}
              autoFocus
            />
          </div>

          <div className="form-control w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase tracking-wider opacity-60">
                {t('editProject.addressLabel')}
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full font-medium sm:text-sm rtl:text-right ltr:text-left"
              dir="auto"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={status === 'loading' || status === 'success'}
              placeholder={t('editProject.addressPlaceholder')}
            />
          </div>

          {status === 'error' && (
            <div className="text-sm text-error font-medium bg-error/10 p-2 rounded-md border border-error/20">
              {errorMessage}
            </div>
          )}

          {status === 'success' && (
            <div className="text-sm text-success font-bold flex items-center gap-2 bg-success/10 p-2 rounded-md border border-success/20">
              <Edit2 className="w-4 h-4" /> {t('editProject.saveSuccess')}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-base-200/30 border-t border-base-200 flex justify-end gap-3 rounded-b-2xl">
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={status === 'loading' || status === 'success'}>
            {t('common:cancel')}
          </button>
          <button
            className="btn btn-sm btn-primary min-w-[100px]"
            onClick={handleSave}
            disabled={status === 'loading' || status === 'success' || !name.trim()}
          >
            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Edit2 className="w-4 h-4 shrink-0" />}
            {status === 'loading' ? t('editProject.saving') : t('editProject.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
