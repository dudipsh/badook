import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Project } from '../../../services/projects.service';

interface ProjectSelectorProps {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
  onCreateProject: (name: string, address: string) => Promise<void>;
}

export const ProjectSelector = ({ projects, value, onChange, onCreateProject }: ProjectSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { t } = useTranslation('projects');
  const selected = projects.find((p) => p.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreatingNew(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await onCreateProject(newName.trim(), newAddress.trim());
      setNewName('');
      setNewAddress('');
      setCreatingNew(false);
      setOpen(false);
      toast.success(t('documents.projectCreatedSuccess'));
    } catch {
      toast.error(t('documents.projectCreateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
      >
        <span className={selected ? 'text-base-content' : 'text-base-content/40'}>
          {selected ? selected.name : t('createPO.selectProjectPlaceholder')}
        </span>
        <ChevronDown size={16} className="text-base-content/40" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-base-200 transition-colors text-right"
            >
              <span className="text-base-content">{p.name}</span>
              {p.id === value && <Check size={14} className="text-secondary shrink-0" />}
            </button>
          ))}

          {projects.length > 0 && <div className="border-t border-base-300" />}

          {creatingNew ? (
            <div className="p-2 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('createPO.projectName')}
                autoFocus
                className="w-full px-2.5 py-2 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-1 focus:ring-secondary/20"
              />
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder={t('createPO.projectAddress')}
                className="w-full px-2.5 py-2 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-1 focus:ring-secondary/20"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setCreatingNew(false); setNewName(''); setNewAddress(''); }}
                  className="text-xs text-base-content/50 hover:text-base-content px-2 py-1.5"
                >
                  {t('common:cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="btn btn-sm btn-primary disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : t('createPO.createProject')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-secondary hover:bg-secondary/10 transition-colors font-medium"
            >
              <Plus size={14} />
              {t('createPO.createProject')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
