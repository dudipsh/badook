import { observer } from 'mobx-react-lite';
import { X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { formatCurrency } from '../../../lib/currencyUtils';

export const DeleteLineItemDrawer = observer(() => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');
  const item = projectDashboardStore.deletingLineItem;
  const isOpen = !!item && !projectDashboardStore.deleteConfirmMode;
  const groupBy = projectDashboardStore.groupBy;

  if (!item) return null;

  const handleClose = () => projectDashboardStore.closeDelete();

  const hasPoDoc = item.relatedDocuments?.some(d => d.type === 'PO') ?? (item.orderedQty != null);
  const hasDnDoc = item.relatedDocuments?.some(d => d.type === 'DC') ?? (item.receivedQty != null && item.receivedQty > 0);
  const hasInvDoc = item.relatedDocuments?.some(d => d.type === 'INV') ?? (item.invoicedAmount != null);

  const canDeleteRow = groupBy === 'deliveryNotes' || groupBy === 'invoices';
  const canDeleteDocument = (groupBy === 'deliveryNotes' && !!item.dnId) || (groupBy === 'invoices' && !!item.invoiceId);

  const deleteDocLabel = groupBy === 'invoices'
    ? t('deleteModal.deleteDocumentInvoice')
    : t('deleteModal.deleteDocumentDN');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="absolute top-0 left-0 bottom-0 w-full max-w-md bg-base-100 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-base-content">{t('deleteModal.title')}</h2>
              <p className="text-sm text-base-content/40 font-mono mt-1">
                {item.poNumber && `${t('editModal.orderLabel')} ${item.poNumber}`}
                {item.dnNoteNumber && ` | ${item.dnNoteNumber}`}
                {item.invoiceNumber && ` | ${item.invoiceNumber}`}
              </p>
            </div>
            <button onClick={handleClose} className="text-base-content/40 hover:text-base-content/60 transition-colors p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {/* Read-only item details */}
            <div className="bg-base-200 rounded-xl p-4 border border-base-300">
              <p className="text-sm font-semibold text-base-content/50 mb-3">{t('deleteModal.description')}</p>
              <p className="text-base font-bold text-base-content mb-3">{item.description}</p>
              {hasPoDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50">
                  <span>{t('deleteModal.orderedQty')}</span>
                  <span className="font-bold text-base-content">{item.orderedQty}</span>
                </div>
              )}
              {hasDnDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                  <span>{t('deleteModal.receivedQty')}</span>
                  <span className="font-bold text-success">{item.quantity ?? item.receivedQty}</span>
                </div>
              )}
              {hasInvDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                  <span>{t('deleteModal.invoicedQty')}</span>
                  <span className="font-bold text-info">{item.invoicedAmount}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                <span>{t('deleteModal.unitPriceLabel')}</span>
                <span className="font-bold text-base-content">{formatCurrency(item.unitPrice ?? 0, item.currency)}</span>
              </div>
            </div>

            {/* Delete Actions */}
            <div className="space-y-3">
              {canDeleteRow && (
                <button
                  onClick={() => projectDashboardStore.requestDeleteConfirm('line')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-error/30 bg-error/10 text-error hover:bg-error/15 hover:border-error/50 transition-all text-sm font-semibold"
                >
                  <Trash2 size={18} />
                  {t('deleteModal.deleteRow')}
                </button>
              )}
              {canDeleteDocument && (
                <button
                  onClick={() => projectDashboardStore.requestDeleteConfirm('document')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-error/50 bg-error/15 text-error hover:bg-error/25 hover:border-error/70 transition-all text-sm font-semibold"
                >
                  <Trash2 size={18} />
                  {deleteDocLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-start px-6 py-4 border-t border-base-300 bg-base-100">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
          >
            {t('common:cancel')}
          </button>
        </div>
      </div>
    </div>
  );
});
