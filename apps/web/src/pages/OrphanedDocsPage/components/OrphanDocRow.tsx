import { FileQuestion, Eye, Mail, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrphanedDoc } from '../../../types/orphan';
import { OrphanReasonBadge } from './OrphanReasonBadge';
import { OrphanDocContextMenu } from './OrphanDocContextMenu';
import i18n from '../../../i18n';

interface OrphanDocRowProps {
  doc: OrphanedDoc;
  onHandle: (doc: OrphanedDoc) => void;
  onView?: (doc: OrphanedDoc) => void;
  onDelete: (doc: OrphanedDoc) => void;
  onBlockSender: (doc: OrphanedDoc) => void;
}

export const OrphanDocRow = ({ doc, onHandle, onView, onDelete, onBlockSender }: OrphanDocRowProps) => {
  const { t } = useTranslation('settings');
  const displayDate = doc.date
    ? new Date(doc.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')
    : '\u2014';

  const isUnknownVendor = !doc.supplierName || doc.supplierName.includes('Unknown');

  return (
    <tr className="hover:bg-base-200/40 border-b border-base-100 last:border-0">
      <td className="pr-6 py-4">
        <OrphanReasonBadge reason={doc.reason} />
      </td>
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-base-200 flex items-center justify-center text-base-content/50">
            <FileQuestion className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-base-content text-sm">{doc.docNumber || t('orphan.noNumber')}</div>
            <div className="text-xs opacity-50 font-mono">{displayDate}</div>
          </div>
        </div>
      </td>
      <td className="py-4">
        {doc.senderEmail && (
          <div className="flex items-center gap-1.5 text-xs text-base-content/60">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[140px]" title={doc.senderEmail}>
              {doc.senderEmail}
            </span>
          </div>
        )}
      </td>
      <td className="py-4 text-base-content/70 text-xs max-w-[200px]">
        {doc.reason === 'UNKNOWN_VENDOR'
          ? t('orphan.vendorNotInList', { vendor: doc.supplierName })
          : t(`orphan.issues.${doc.reason}`)}
      </td>
      <td className="py-4 text-right pr-6">
        <div className="flex items-center justify-end gap-1">
          {doc.originalFileUrl && onView && (
            <button onClick={() => onView(doc)} className="btn btn-ghost btn-xs gap-1" title={t('orphan.viewDocument')}>
              <Eye className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => onHandle(doc)} className="btn btn-primary btn-xs gap-1">
            {t('orphan.handle', 'טפל')} <ArrowRight className="w-3 h-3 rtl-flip" />
          </button>
          <OrphanDocContextMenu
            doc={doc}
            onDelete={() => onDelete(doc)}
            onBlockSender={() => onBlockSender(doc)}
          />
        </div>
      </td>
    </tr>
  );
};
