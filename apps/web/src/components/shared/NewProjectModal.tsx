import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X, Building2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../lib/store-context';

interface NewProjectModalProps {
  onClose: () => void;
}

export const NewProjectModal = ({ onClose }: NewProjectModalProps) => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { projectsStore } = useStores();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const project = await projectsStore.createProject({ name: name.trim() });
      toast.success(t('documents.projectCreatedSuccess'));
      onClose();
      navigate(`/projects/${project.id}`);
    } catch {
      toast.error(t('documents.projectCreateError'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Building2 size={20} className="text-secondary" />
            </div>
            <h3 className="text-lg font-bold text-base-content">{t('newProjectModal.title')}</h3>
          </div>
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <label className="block text-sm font-medium text-base-content mb-2">{t('newProjectModal.nameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('newProjectModal.namePlaceholder')}
            autoFocus
            className="w-full px-4 py-3 border border-base-300 rounded-xl text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
          />

          <p className="text-xs text-base-content/40 mt-3">
            {t('newProjectModal.helperText')}
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-base-content/60 hover:text-base-content transition-colors">
              {t('common:cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('newProjectModal.creating') : t('newProjectModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
