import { useTranslation } from 'react-i18next';
import { GitMerge, Trash2, X } from 'lucide-react';

interface EntityModalHeaderProps {
  isDelete: boolean;
  entityTypeLabel: string;
  entityName: string;
  disabled: boolean;
  onClose: () => void;
}

export const EntityModalHeader = ({ isDelete, entityTypeLabel, entityName, disabled, onClose }: EntityModalHeaderProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className={`p-5 flex items-start justify-between border-b ${isDelete ? 'bg-error/5 border-error/10' : 'bg-primary/5 border-primary/10'}`}>
      <div className="flex gap-3 items-center">
        <div className={`p-2 rounded-xl ${isDelete ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'}`}>
          {isDelete ? <Trash2 className="w-5 h-5" /> : <GitMerge className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="font-bold text-lg rtl:text-right ltr:text-left" dir="auto">
            {isDelete ? t('entityActions.deleteTitle', { entityType: entityTypeLabel }) : t('entityActions.mergeTitle', { entityType: entityTypeLabel })}
          </h3>
          <p className="text-sm opacity-70 mt-0.5 truncate max-w-[200px]" title={entityName}>{entityName}</p>
        </div>
      </div>
      <button onClick={onClose} className="btn btn-sm btn-ghost btn-square" disabled={disabled}><X className="w-4 h-4" /></button>
    </div>
  );
};
