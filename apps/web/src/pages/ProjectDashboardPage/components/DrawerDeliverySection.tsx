import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DetailRow } from './DetailRow';
import { DocumentCard } from './DocumentCard';
import { DeliveryNoteCard } from './DeliveryNoteCard';
import type { RelatedDocument, DeliveryHistoryEntry } from '../../../types/reconciliation';

interface DrawerDeliverySectionProps {
  dcDocs: RelatedDocument[];
  deliveryHistory: DeliveryHistoryEntry[];
  receivedQty: number;
  receivedUnit: string | null | undefined;
  remaining: number;
  shipmentCount: number;
  unitLabel: string;
  deliveryStatusLabel: string;
  deliveryStatusColor: string;
  safeValue: (val: unknown, suffix?: string) => string;
  onViewDocument: (fileUrl: string | null) => void;
}

export const DrawerDeliverySection = ({
  dcDocs, deliveryHistory, receivedQty, receivedUnit, remaining, shipmentCount,
  unitLabel, deliveryStatusLabel, deliveryStatusColor, safeValue, onViewDocument,
}: DrawerDeliverySectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-300 bg-base-200/50 flex items-center justify-between">
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider">{t('drawer.deliveryStatus')}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${deliveryStatusColor}`}>{deliveryStatusLabel}</span>
      </div>
      <div className="p-4 space-y-2.5">
        {dcDocs.length > 0 ? (
          dcDocs.map((doc, idx) => (
            <DocumentCard key={idx} name={doc.name} type="DC" hoverColor="emerald" hasFile={!!doc.fileUrl} onClick={() => onViewDocument(doc.fileUrl)} />
          ))
        ) : deliveryHistory?.length > 0 ? (
          deliveryHistory.map((d) => (
            <DeliveryNoteCard key={d.deliveryNoteId} entry={d} unitLabel={unitLabel} onClick={() => onViewDocument(d.fileUrl)} />
          ))
        ) : (
          <div className="flex items-center gap-2 p-3 bg-base-200 border border-base-300 rounded-lg">
            <Clock size={14} className="text-base-content/40" />
            <span className="text-xs text-base-content/40">{t('drawer.pendingDelivery')}</span>
          </div>
        )}
        <DetailRow label={t('drawer.received')} value={safeValue(receivedQty, receivedUnit || unitLabel)} />
        <DetailRow label={t('drawer.remaining')} value={safeValue(remaining)} />
        <DetailRow label={t('drawer.shipments')} value={safeValue(shipmentCount)} />
      </div>
    </div>
  );
};
