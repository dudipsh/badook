import { MoreHorizontal, Trash2, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrphanedDoc } from '../../../types/orphan';

interface OrphanDocContextMenuProps {
  doc: OrphanedDoc;
  onDelete: () => void;
  onBlockSender: () => void;
}

export const OrphanDocContextMenu = ({ doc, onDelete, onBlockSender }: OrphanDocContextMenuProps) => {
  const { t } = useTranslation('settings');

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-xs btn-square opacity-50 hover:opacity-100">
        <MoreHorizontal className="w-4 h-4" />
      </div>
      <ul tabIndex={0} className="dropdown-content z-[100] menu p-1 shadow-xl bg-base-100 rounded-lg border border-base-300 w-60 mt-1 overflow-visible">
        <li>
          <a
            onClick={onDelete}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm hover:bg-base-200 text-base-content"
          >
            <span>{t('orphan.contextMenu.delete')}</span>
            <Trash2 className="w-4 h-4 opacity-70" />
          </a>
        </li>
        {doc.senderEmail && (
          <li>
            <a
              onClick={onBlockSender}
              className="flex items-start justify-between gap-2 px-3 py-2 rounded-md hover:bg-error/10 text-error"
            >
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-sm">{t('orphan.contextMenu.blockSender')}</span>
                <span className="text-xs opacity-80 truncate max-w-[180px]" title={doc.senderEmail}>
                  {doc.senderEmail}
                </span>
              </div>
              <Ban className="w-4 h-4 flex-shrink-0 mt-0.5" />
            </a>
          </li>
        )}
      </ul>
    </div>
  );
};
