import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DetailRow } from './DetailRow';
import { DocumentCard } from './DocumentCard';
import type { RelatedDocument } from '../../../types/reconciliation';

interface DrawerInvoiceSectionProps {
  invDocs: RelatedDocument[];
  invoicedAmount: number | null;
  invoicedUnitPrice: number | null | undefined;
  invoiceStatusLabel: string;
  invoiceStatusColor: string;
  safeCurrency: (amount: number | null | undefined) => string;
  onViewDocument: (fileUrl: string | null) => void;
}

export const DrawerInvoiceSection = ({
  invDocs,
  invoicedAmount,
  invoicedUnitPrice,
  invoiceStatusLabel,
  invoiceStatusColor,
  safeCurrency,
  onViewDocument,
}: DrawerInvoiceSectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-300 bg-base-200/50 flex items-center justify-between">
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider">{t('drawer.invoiceStatus')}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoiceStatusColor}`}>
          {invoiceStatusLabel}
        </span>
      </div>
      <div className="p-4 space-y-2.5">
        {invDocs.length > 0 ? (
          invDocs.map((doc, idx) => (
            <DocumentCard key={idx} name={doc.name} type="INV" hoverColor="blue" hasFile={!!doc.fileUrl} onClick={() => onViewDocument(doc.fileUrl)} />
          ))
        ) : (
          <div className="flex items-center gap-2 p-3 bg-base-200 border border-base-300 rounded-lg">
            <Clock size={14} className="text-base-content/40" />
            <span className="text-xs text-base-content/40">{t('drawer.pendingInvoice')}</span>
          </div>
        )}

        {invoicedAmount != null && !isNaN(invoicedAmount) && (
          <DetailRow label={t('drawer.invoicedAmount')} value={safeCurrency(invoicedAmount)} />
        )}
        {invoicedUnitPrice != null && !isNaN(invoicedUnitPrice) && (
          <DetailRow label={t('drawer.invoicedUnitPrice')} value={safeCurrency(invoicedUnitPrice)} />
        )}
      </div>
    </div>
  );
};
