import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search, X } from 'lucide-react';

interface EntityMergeContentProps {
  entityName: string;
  searchTerm: string;
  dropdownOpen: boolean;
  selectedTarget: { id: string; name: string } | null;
  filteredTargets: { id: string; name: string }[];
  onSearchChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSelectTarget: (target: { id: string; name: string }) => void;
  onClearTarget: () => void;
}

export const EntityMergeContent = ({
  entityName, searchTerm, dropdownOpen, selectedTarget, filteredTargets,
  onSearchChange, onFocus, onBlur, onSelectTarget, onClearTarget,
}: EntityMergeContentProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="space-y-5">
      <div className="alert alert-info bg-info/10 text-info-content border-info/20 shadow-sm rounded-xl py-3 px-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed opacity-90 rtl:text-right ltr:text-left" dir="auto">
          {t('entityActions.mergeDescription', { entityName })}
        </div>
      </div>

      <div className="form-control w-full">
        <label className="label py-1">
          <span className="label-text text-xs font-bold uppercase tracking-wider opacity-60">
            {t('entityActions.selectTarget', 'Select Target')} <span className="text-error">*</span>
          </span>
        </label>

        <div className="relative w-full">
          {selectedTarget ? (
            <div className="flex items-center justify-between p-3 border border-primary bg-primary/5 rounded-lg">
              <span className="font-semibold text-sm">{selectedTarget.name}</span>
              <button onClick={onClearTarget} className="btn btn-xs btn-ghost btn-circle text-base-content/50 hover:text-error">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 z-10" />
              <input
                type="text"
                className="input input-bordered input-sm w-full font-medium h-10 pe-9 rtl:text-right ltr:text-left"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={t('entityActions.searchPlaceholder')}
                dir="auto"
              />
              {dropdownOpen && filteredTargets.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 shadow-xl rounded-box max-h-48 overflow-y-auto menu menu-sm p-1">
                  {filteredTargets.map((target) => (
                    <li key={target.id}>
                      <button type="button" className="w-full text-start py-2.5 px-3" onClick={() => onSelectTarget(target)}>
                        <span className="font-medium text-sm">{target.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
