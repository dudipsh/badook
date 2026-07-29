import { useTranslation } from 'react-i18next';
import { DetailRow } from './DetailRow';
import { DocumentCard } from './DocumentCard';
import type { RelatedDocument } from '../../../types/reconciliation';

interface DrawerOrderDetailsProps {
  poDocs: RelatedDocument[];
  poNumber: string;
  orderedQty: number;
  unitLabel: string;
  unitPrice: number;
  lineTotal: number;
  discountPercent: number | null;
  safeCurrency: (amount: number | null | undefined) => string;
  safeValue: (val: unknown, suffix?: string) => string;
  onViewDocument: (fileUrl: string | null) => void;
}

export const DrawerOrderDetails = ({
  poDocs,
  poNumber,
  orderedQty,
  unitLabel,
  unitPrice,
  lineTotal,
  discountPercent,
  safeCurrency,
  safeValue,
  onViewDocument,
}: DrawerOrderDetailsProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-300 bg-base-200/50">
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider">{t('drawer.orderDetails')}</p>
      </div>
      <div className="p-4 space-y-2.5">
        {poDocs.length > 0 ? (
          poDocs.map((doc, idx) => (
            <DocumentCard
              key={idx}
              name={doc.name}
              type="PO"
              hoverColor="purple"
              hasFile={!!doc.fileUrl}
              onClick={() => onViewDocument(doc.fileUrl)}
            />
          ))
        ) : (
          <div className="flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-lg">
            <span className="text-sm font-bold text-base-content">{poNumber}</span>
            <span className="text-xs font-semibold text-secondary uppercase">PO</span>
          </div>
        )}

        <DetailRow label={t('drawer.quantity')} value={safeValue(orderedQty, unitLabel)} />
        <DetailRow label={t('drawer.unitPrice')} value={safeCurrency(unitPrice)} />
        <DetailRow label={t('drawer.lineTotal')} value={safeCurrency(lineTotal)} highlight />
        {discountPercent != null && discountPercent > 0 && (
          <DetailRow
            label={t('drawer.discount')}
            value={`${discountPercent}%`}
            valueClassName="text-orange-600 font-bold"
          />
        )}
      </div>
    </div>
  );
};
