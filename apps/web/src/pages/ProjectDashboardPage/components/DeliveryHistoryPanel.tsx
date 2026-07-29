import { FileText, Download, Eye, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeliveryHistoryEntry, RelatedDocument } from '../../../types/reconciliation';
import i18n from '../../../i18n';

interface DeliveryHistoryPanelProps {
  deliveryHistory: DeliveryHistoryEntry[];
  dcDocs: RelatedDocument[];
  unit: string | null;
  onOpenDocument: (fileUrl: string) => void;
  onDownload: (fileUrl: string) => void;
}

export const DeliveryHistoryPanel = ({ deliveryHistory, dcDocs, unit, onOpenDocument, onDownload }: DeliveryHistoryPanelProps) => {
  const { t } = useTranslation('projects');
  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Package size={14} className="text-base-content/40" />
          <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
            {t('deliveryHistory.shipmentsAndDocs')}
          </h4>
        </div>
        {deliveryHistory.length > 0 && (
          <span className="text-xs text-base-content/40">{t('deliveryHistory.siteReceipt')}</span>
        )}
      </div>

      {deliveryHistory.length > 0 ? (
        <div className="space-y-2">
          {deliveryHistory.map((entry) => (
            <DeliveryEntry
              key={entry.deliveryNoteId}
              entry={entry}
              unit={unit}
              onOpenDocument={onOpenDocument}
              onDownload={onDownload}
            />
          ))}
        </div>
      ) : dcDocs.length > 0 ? (
        <div className="space-y-2">
          {dcDocs.map((doc, idx) => (
            <DcDocRow
              key={idx}
              doc={doc}
              onOpenDocument={onOpenDocument}
              onDownload={onDownload}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-base-content/40">{t('deliveryHistory.noShipments')}</p>
      )}
    </div>
  );
}

function DeliveryEntry({ entry, unit, onOpenDocument, onDownload }: {
  entry: DeliveryHistoryEntry;
  unit: string | null;
  onOpenDocument: (fileUrl: string) => void;
  onDownload: (fileUrl: string) => void;
}) {
  const { t } = useTranslation('projects');
  return (
    <div className="flex items-center justify-between px-3 py-2 group">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-success" />
        </div>
        <div>
          <span className="text-sm font-bold text-base-content">{entry.noteNumber}</span>
          <div className="flex items-center gap-1.5 text-xs text-base-content/40">
            {entry.date && (
              <span>{formatDate(entry.date)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {entry.fileUrl && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onOpenDocument(entry.fileUrl!)}
              className="p-1 text-base-content/40 hover:text-secondary transition-colors"
              title={t('documents.view')}
            >
              <Eye size={12} />
            </button>
            <button
              onClick={() => onDownload(entry.fileUrl!)}
              className="p-1 text-base-content/40 hover:text-secondary transition-colors"
              title={t('documents.download')}
            >
              <Download size={12} />
            </button>
          </div>
        )}
        <span className="text-sm font-bold text-success">+{entry.quantity}{unit ? ` ${unit}` : ''}</span>
      </div>
    </div>
  );
}

function DcDocRow({ doc, onOpenDocument, onDownload }: {
  doc: RelatedDocument;
  onOpenDocument: (fileUrl: string) => void;
  onDownload: (fileUrl: string) => void;
}) {
  const { t } = useTranslation('projects');
  return (
    <div className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-success" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-base-content truncate">{doc.name}</p>
          <p className="text-xs text-base-content/40">{t('deliveryHistory.deliveryNote')}</p>
        </div>
      </div>
      {doc.fileUrl && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onOpenDocument(doc.fileUrl!)}
            className="p-1 text-secondary hover:text-secondary transition-colors"
            title={t('documents.view')}
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => onDownload(doc.fileUrl!)}
            className="p-1 text-base-content/40 hover:text-secondary transition-colors"
            title={t('documents.download')}
          >
            <Download size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
    return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}
