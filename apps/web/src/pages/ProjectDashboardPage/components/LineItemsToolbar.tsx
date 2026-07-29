import { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, GitMerge, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { ToolbarSearchInput } from './ToolbarSearchInput';
import { ToolbarUploadMenu } from './ToolbarUploadMenu';
import type { DocType } from '../../../types/reconciliation';

interface LineItemsToolbarProps {
  onVendorAction?: (type: 'MERGE' | 'DELETE') => void;
  onUpload?: (docType: DocType) => void;
}

export const LineItemsToolbar = observer(({ onVendorAction, onUpload }: LineItemsToolbarProps) => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const { vendors, selectedVendorId } = projectDashboardStore;

  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="p-4 pb-0 border-b border-base-200">
      {selectedVendor ? (
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-base-content whitespace-nowrap">
              {selectedVendor.name}
            </h2>
            <div className="flex items-center gap-3">
              <button
                className="btn btn-ghost btn-sm btn-square opacity-50 hover:opacity-100"
                onClick={() => projectDashboardStore.toggleTableExpanded()}
                title={projectDashboardStore.isTableExpanded ? t('toolbar.collapseTable') : t('toolbar.expandTable')}
              >
                {projectDashboardStore.isTableExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              {onVendorAction && (
                <div ref={menuRef} className="relative">
                  <button className="btn btn-ghost btn-sm btn-square opacity-50 hover:opacity-100" onClick={() => setMenuOpen(!menuOpen)}>
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {menuOpen && (
                    <ul className="absolute end-0 top-full mt-2 w-48 bg-base-100 rounded-box shadow-lg border border-base-200 py-1 z-[100]">
                      <li>
                        <button onClick={() => { onVendorAction('MERGE'); setMenuOpen(false); }} className="w-full text-start px-4 py-2 hover:bg-base-200 flex justify-between items-center text-sm font-medium">
                          <span>{t('toolbar.merge')}</span>
                          <GitMerge className="w-4 h-4 opacity-70" />
                        </button>
                      </li>
                      <li>
                        <button onClick={() => { onVendorAction('DELETE'); setMenuOpen(false); }} className="w-full text-start px-4 py-2 hover:bg-error/10 text-error flex justify-between items-center text-sm font-medium border-t border-base-200 mt-1 pt-2">
                          <span>{t('toolbar.delete')}</span>
                          <Trash2 className="w-4 h-4 opacity-70" />
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <ToolbarSearchInput isExpanded={isSearchExpanded} onToggle={setIsSearchExpanded}>
            {onUpload && <ToolbarUploadMenu onUpload={onUpload} />}
          </ToolbarSearchInput>
        </div>
      ) : (
        <div className="flex h-14 bg-base-200/50 border border-base-300 border-dashed rounded-box items-center justify-center text-sm italic text-base-content/60 mb-3">
          {t('page.project.selectVendor')}
        </div>
      )}
    </div>
  );
});
