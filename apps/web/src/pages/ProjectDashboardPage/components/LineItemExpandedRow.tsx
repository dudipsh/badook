import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReconciliationLineItem, LineItemEditReason, LineItemAuditEntry } from '../../../types/reconciliation';
import { filesService } from '../../../services/files.service';
import { useStores } from '../../../lib/store-context';
import { LineItemDetailsGrid } from './LineItemDetailsGrid';
import { DeliveryHistoryPanel } from './DeliveryHistoryPanel';
import i18n from '../../../i18n';

interface LineItemExpandedRowProps {
  item: ReconciliationLineItem;
}

export const LineItemExpandedRow = ({ item }: LineItemExpandedRowProps) => {
  const { projectDashboardStore } = useStores();

  const handleDownload = async (fileUrl: string) => {
    try {
      await filesService.downloadFile(fileUrl);
    } catch {
      // failed to download
    }
  };

  const docs = item.relatedDocuments || [];
  const poDoc = docs.find((d) => d.type === 'PO');
  const invoiceDoc = docs.find((d) => d.type === 'INV');
  const dcDocs = docs.filter((d) => d.type === 'DC');

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left: Purchase Order Details */}
      <LineItemDetailsGrid
        item={item}
        poDoc={poDoc}
        invoiceDoc={invoiceDoc}
        onOpenDocument={(url) => projectDashboardStore.openDocument(url)}
        onDownload={handleDownload}
      />

      {/* Middle: Shipment & Delivery Docs */}
      <DeliveryHistoryPanel
        deliveryHistory={item.deliveryHistory || []}
        dcDocs={dcDocs}
        unit={item.unit}
        onOpenDocument={(url) => projectDashboardStore.openDocument(url)}
        onDownload={handleDownload}
      />

      {/* Right: Resolution History / Audit Trail */}
      <AuditTrailSection lineItemId={item.id} />
    </div>
  );
}

const REASON_LABEL_KEYS: Record<LineItemEditReason, string> = {
  DATA_EXTRACTION_ERROR: 'expandedRow.reasonDataExtraction',
  PRICE_CORRECTION: 'expandedRow.reasonPriceCorrection',
  QUANTITY_ADJUSTMENT: 'expandedRow.reasonQuantityAdjustment',
  UNIT_TYPE_CORRECTION: 'expandedRow.reasonUnitTypeCorrection',
  CREDIT_NOTE_APPLIED: 'expandedRow.reasonCreditNote',
  OVERRIDE_SUBSTITUTE: 'expandedRow.reasonOverrideSubstitute',
  OVERRIDE_PRICE_APPROVED: 'expandedRow.reasonOverridePriceApproved',
  OVERRIDE_UNIT_CORRECTION: 'expandedRow.reasonOverrideUnitCorrection',
  FLAG_DUPLICATE: 'expandedRow.reasonFlagDuplicate',
  OTHER: 'expandedRow.reasonOther',
};

function groupByTimestamp(entries: LineItemAuditEntry[]): Array<{ timestamp: string; entries: LineItemAuditEntry[] }> {
  const map = new Map<string, LineItemAuditEntry[]>();
  for (const entry of entries) {
    const key = entry.createdAt;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return Array.from(map.entries()).map(([timestamp, entries]) => ({ timestamp, entries }));
}

const AuditTrailSection = observer(({ lineItemId }: { lineItemId: string }) => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');

  useEffect(() => {
    projectDashboardStore.loadAuditTrail(lineItemId);
  }, [lineItemId, projectDashboardStore]);

  const entries = projectDashboardStore.auditTrail.get(lineItemId) || [];
  const loading = projectDashboardStore.auditTrailLoading.has(lineItemId);

  const grouped = groupByTimestamp(entries);

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <History size={14} className="text-base-content/40" />
          <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
            {t('expandedRow.changeHistory')}
          </h4>
        </div>
        <span className="text-xs text-base-content/40">Audit Trail</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <span className="loading loading-spinner loading-sm text-base-content/40" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-base-content/30">{t('expandedRow.noChanges')}</p>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.timestamp} className="flex items-start gap-2.5 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-base-content text-xs">{t('expandedRow.itemEdited')}</span>
                  <span className="text-xs text-base-content/40 font-mono">
                    {formatDateTime(group.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {t('expandedRow.reason')} {t(REASON_LABEL_KEYS[group.entries[0].reason]) || group.entries[0].reason}
                </p>
                {group.entries[0].note && (
                  <p className="text-xs text-base-content/40 mt-0.5">{t('expandedRow.note')} {group.entries[0].note}</p>
                )}
                <p className="text-xs text-base-content/30 mt-0.5">
                  {group.entries[0].editedBy.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function formatDateTime(isoStr: string): string {
  try {
    const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
    const d = new Date(isoStr);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}
