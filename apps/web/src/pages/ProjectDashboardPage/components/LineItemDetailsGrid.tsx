import { FileText, Download, ArrowLeft, Calendar, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReconciliationLineItem, RelatedDocument } from '../../../types/reconciliation';
import { translateUnit } from '../../../lib/formatters';
import i18n from '../../../i18n';

interface LineItemDetailsGridProps {
  item: ReconciliationLineItem;
  poDoc: RelatedDocument | undefined;
  invoiceDoc: RelatedDocument | undefined;
  onOpenDocument: (fileUrl: string) => void;
  onDownload: (fileUrl: string) => void;
}

function formatDate(dateStr: string): string {
  try {
    const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
    return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export const LineItemDetailsGrid = ({ item, poDoc, invoiceDoc, onOpenDocument, onDownload }: LineItemDetailsGridProps) => {
  const { t } = useTranslation('projects');
  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ClipboardList size={14} className="text-base-content/40" />
          <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
            {t('detailsGrid.poDetails')}
          </h4>
        </div>
        {poDoc?.fileUrl && (
          <button
            onClick={() => onOpenDocument(poDoc.fileUrl!)}
            className="text-xs font-medium text-base-content/50 border border-base-300 rounded-full px-3 py-1 hover:bg-base-200 hover:border-base-300 transition-colors"
          >
            {t('detailsGrid.originalContract')}
          </button>
        )}
      </div>

      {/* PO info row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-base-content font-mono">{item.poNumber}</span>
          {item.quoteReference && (
            <span className="text-xs bg-warning/10 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-medium">
              {t('detailsGrid.quoteRef')} {item.quoteReference}
            </span>
          )}
          <span className="text-base-content/30">|</span>
          {item.deliveryHistory?.length > 0 && item.deliveryHistory[0].date && (
            <span className="flex items-center gap-1 text-xs text-base-content/40">
              <Calendar size={12} />
              {formatDate(item.deliveryHistory[0].date)}
            </span>
          )}
          {item.dnDeliveryDate && !item.deliveryHistory?.length && (
            <span className="flex items-center gap-1 text-xs text-base-content/40">
              <Calendar size={12} />
              {formatDate(item.dnDeliveryDate)}
            </span>
          )}
        </div>
        <span className="text-xs text-base-content/50">{parseFloat((item.quantity ?? item.orderedQty ?? 0).toFixed(2))} {translateUnit(item.unit, t) || t('lineItems.unit')}</span>
      </div>

      {/* Invoice Document */}
      {invoiceDoc?.fileUrl && (
        <DocumentRow
          doc={invoiceDoc}
          iconBg="bg-secondary/10"
          iconColor="text-secondary"
          onOpen={onOpenDocument}
          onDownload={onDownload}
        />
      )}

      {/* PO Document (if no invoice, show PO file) */}
      {!invoiceDoc?.fileUrl && poDoc?.fileUrl && (
        <DocumentRow
          doc={poDoc}
          iconBg="bg-info/10"
          iconColor="text-info"
          onOpen={onOpenDocument}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}

function DocumentRow({ doc, iconBg, iconColor, onOpen, onDownload }: {
  doc: RelatedDocument;
  iconBg: string;
  iconColor: string;
  onOpen: (fileUrl: string) => void;
  onDownload: (fileUrl: string) => void;
}) {
  const { t } = useTranslation('projects');
  if (!doc.fileUrl) return null;

  return (
    <div className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2.5 mb-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <FileText size={14} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-base-content truncate">{doc.name}</p>
          <button
            onClick={() => onOpen(doc.fileUrl!)}
            className="text-xs text-secondary hover:text-secondary/80 transition-colors"
          >
            {t('detailsGrid.viewOriginalDoc')}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onDownload(doc.fileUrl!)}
          className="p-1 text-base-content/40 hover:text-secondary transition-colors"
          title={t('documents.download')}
        >
          <Download size={14} />
        </button>
        <button
          onClick={() => onOpen(doc.fileUrl!)}
          className="p-1 text-base-content/30 hover:text-base-content/50 transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
      </div>
    </div>
  );
}
