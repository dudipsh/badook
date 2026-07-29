import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsService } from '../../../services/projects.service';

const DOC_TYPE_MAP: Record<string, 'deliveryNote' | 'purchaseOrder' | 'invoice'> = {
  deliveryNotes: 'deliveryNote',
  purchaseOrders: 'purchaseOrder',
  invoices: 'invoice',
};

interface CreateProjectDialogProps {
  docId: string;
  docType: string;
  onCreated: () => void;
  onCancel: () => void;
}

export const CreateProjectDialog = ({ docId, docType, onCreated, onCancel }: CreateProjectDialogProps) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const { t } = useTranslation('projects');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('orphanModal.mustEnterName'));
      return;
    }
    setCreating(true);
    try {
      await projectsService.createFromDocument({
        documentId: docId,
        documentType: DOC_TYPE_MAP[docType],
        name: name.trim(),
      });
      toast.success(t('orphanModal.projectCreatedSuccess'));
      onCreated();
    } catch {
      toast.error(t('orphanModal.projectCreateError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-base-content mb-3">{t('orphanModal.createNewProject')}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-base-content mb-1">{t('orphanModal.projectNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('orphanModal.projectNamePlaceholder')}
            className="w-full border border-base-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50"
            autoFocus
            dir="rtl"
          />
          <p className="text-xs text-base-content/40 mt-1">{t('orphanModal.docWillBeAssigned')}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
            {t('common:cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="btn btn-sm btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? t('orphanModal.creating') : t('orphanModal.createProject')}
          </button>
        </div>
      </div>
    </div>
  );
};
