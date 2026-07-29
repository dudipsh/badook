import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GitMerge } from 'lucide-react';
import { EntityDeleteContent } from './EntityDeleteContent';
import { EntityMergeContent } from './EntityMergeContent';
import { EntityModalHeader } from './EntityModalHeader';
import { EntityModalFooter } from './EntityModalFooter';

export type EntityType = 'PROJECT' | 'VENDOR';
export type ActionType = 'MERGE' | 'DELETE' | null;

interface EntityActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    entityType: EntityType; actionType: ActionType; entityId: string; entityName: string;
    availableTargets: { id: string; name: string }[];
    onConfirmMerge: (targetId: string) => Promise<void>;
    onConfirmDelete: () => Promise<void>;
  };
}

export const EntityActionsModal = ({ isOpen, onClose, config }: EntityActionsModalProps) => {
  const { t } = useTranslation('projects');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) { setStatus('idle'); setErrorMessage(''); setSearchTerm(''); setSelectedTarget(null); setDropdownOpen(false); }
  }, [isOpen]);

  if (!isOpen || !config.actionType) return null;

  const isDelete = config.actionType === 'DELETE';
  const entityTypeLabel = config.entityType === 'PROJECT' ? t('entityActions.project') : t('entityActions.vendor');
  const filteredTargets = config.availableTargets.filter((tgt) => tgt.id !== config.entityId && tgt.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleConfirm = async () => {
    setStatus('loading'); setErrorMessage('');
    try {
      if (config.actionType === 'MERGE') { if (!selectedTarget) return; await config.onConfirmMerge(selectedTarget.id); }
      else if (config.actionType === 'DELETE') { await config.onConfirmDelete(); }
      setStatus('success'); setTimeout(() => { onClose(); }, 1000);
    } catch (e: any) { setStatus('error'); setErrorMessage(e?.message || t('entityActions.error', 'An error occurred')); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-base-300/60 backdrop-blur-sm p-4" onClick={status !== 'loading' ? onClose : undefined}>
      <div className={`bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${isDelete ? 'border-error/20' : 'border-primary/20'}`} onClick={(e) => e.stopPropagation()}>
        <EntityModalHeader isDelete={isDelete} entityTypeLabel={entityTypeLabel} entityName={config.entityName} disabled={status === 'loading'} onClose={onClose} />
        <div className="p-6 space-y-4">
          {isDelete && <EntityDeleteContent entityName={config.entityName} />}
          {!isDelete && (
            <EntityMergeContent entityName={config.entityName} searchTerm={searchTerm} dropdownOpen={dropdownOpen} selectedTarget={selectedTarget} filteredTargets={filteredTargets}
              onSearchChange={(v) => { setSearchTerm(v); setDropdownOpen(true); }} onFocus={() => setDropdownOpen(true)} onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              onSelectTarget={(tgt) => { setSelectedTarget(tgt); setDropdownOpen(false); setSearchTerm(''); }} onClearTarget={() => { setSelectedTarget(null); setSearchTerm(''); }}
            />
          )}
          {status === 'error' && <div className="text-sm text-error mt-2 font-medium bg-error/10 p-2 rounded-md border border-error/20">{errorMessage}</div>}
          {status === 'success' && <div className="text-sm text-success mt-2 font-bold flex items-center gap-2 bg-success/10 p-2 rounded-md border border-success/20"><GitMerge className="w-4 h-4" /> {t('entityActions.success', 'Success!')}</div>}
        </div>
        <EntityModalFooter isDelete={isDelete} status={status} canConfirm={isDelete || !!selectedTarget} onClose={onClose} onConfirm={handleConfirm} />
      </div>
    </div>
  );
};
