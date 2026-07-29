import { useEffect, useState } from 'react';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { fmtQty } from '../../../../lib/currencyUtils';
import { ToggleChip } from './ToggleChip';
import { DocumentColumn, type DocColumn } from './DocumentColumn';
import type { RelatedDocument } from '../../../../types/reconciliation';

export const EvidenceSlidePanel = observer(() => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');
  const item = projectDashboardStore.evidenceItem;
  const isOpen = !!item;

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['PO', 'INV', 'DC']));

  useEffect(() => {
    if (item) setVisibleTypes(new Set(['PO', 'INV', 'DC']));
  }, [item]);

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') projectDashboardStore.closeEvidence();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, projectDashboardStore]);

  if (!item) return null;

  const isMatched = item.invoicedStatus === 'matched';

  const invDocs: RelatedDocument[] = item.relatedDocuments?.filter((d) => d.type === 'INV') ?? [];
  let dcDocs: RelatedDocument[] = item.relatedDocuments?.filter((d) => d.type === 'DC') ?? [];
  const poDocs: RelatedDocument[] = item.relatedDocuments?.filter((d) => d.type === 'PO') ?? [];

  if (dcDocs.length === 0 && item.deliveryHistory?.length > 0) {
    dcDocs = item.deliveryHistory
      .filter((d) => d.fileUrl)
      .map((d) => ({
        type: 'DC' as const,
        name: d.noteNumber || d.deliveryNoteId.slice(0, 12),
        documentNumber: d.noteNumber || null,
        fileUrl: d.fileUrl,
      }));
  }

  const columns: DocColumn[] = [];

  if (poDocs.length > 0) {
    columns.push({
      type: 'PO',
      title: t('evidence.purchaseOrder'),
      count: fmtQty(item.orderedQty ?? 0),
      docs: poDocs,
      cssColor: 'var(--color-secondary)',
    });
  }

  columns.push({
    type: 'INV',
    title: t('evidence.invoiced'),
    count: fmtQty(item.invoicedAmount ?? item.orderedQty ?? 0),
    docs: invDocs,
    cssColor: 'var(--color-primary)',
  });

  columns.push({
    type: 'DC',
    title: t('evidence.received'),
    count: fmtQty(item.receivedQty ?? 0),
    docs: dcDocs,
    cssColor: 'var(--color-accent)',
  });

  const visibleColumns = columns.filter((col) => visibleTypes.has(col.type));

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[10002] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => projectDashboardStore.closeEvidence()}
      />

      <div className={`fixed z-[10003] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ top: 12, left: 12, right: 12, bottom: 12 }}>
        <div className="flex flex-col w-full h-full bg-base-100 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 border-b shrink-0 ${isMatched ? 'border-success/20 bg-success/5' : 'border-base-300 bg-base-100'}`}>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-base-content flex items-center gap-2">
                {isMatched ? (
                  <span className="text-success flex items-center gap-1.5 shrink-0"><CheckCircle size={16} /> {t('evidence.matchedItem')}</span>
                ) : (
                  <span className="text-error shrink-0">{t('evidence.discrepancyLabel')}</span>
                )}
                <span className="text-base-content truncate">{item.description}</span>
              </h2>
              <p className="text-xs text-base-content/40 mt-0.5">{t('evidence.invoiceVsDelivery')}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {poDocs.length > 0 && (
                <ToggleChip label={t('evidence.showPurchaseOrder')} active={visibleTypes.has('PO')} onClick={() => toggleType('PO')} color="secondary" />
              )}
              <ToggleChip label={t('evidence.showInvoice')} active={visibleTypes.has('INV')} onClick={() => toggleType('INV')} color="primary" />
              <ToggleChip label={t('evidence.showDeliveryNote')} active={visibleTypes.has('DC')} onClick={() => toggleType('DC')} color="accent" />
            </div>
            <button onClick={() => projectDashboardStore.closeEvidence()} className="p-2 rounded-full hover:bg-base-200 text-base-content/40 hover:text-base-content/60 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-0">
            {visibleColumns.map((col, idx) => (
              <DocumentColumn key={col.type} col={col} isFirst={idx === 0} noDocsLabel={t('evidence.noDocuments')} unitsLabel={t('evidence.units')} widthPercent={100 / visibleColumns.length} />
            ))}
          </div>

          <div className="p-3 sm:p-4 bg-base-100 border-t border-base-300 flex justify-end gap-3 shrink-0">
            <button onClick={() => projectDashboardStore.closeEvidence()} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
              {t('common:close')}
            </button>
            <button className="btn btn-sm btn-primary inline-flex items-center gap-2">
              {t('evidence.requestCreditNote')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
