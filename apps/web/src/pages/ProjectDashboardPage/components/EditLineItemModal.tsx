import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X, AlertTriangle, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import type { LineItemEditReason } from '../../../types/reconciliation';
import { formatCurrency } from '../../../lib/currencyUtils';

type EditSource = 'po' | 'dn' | 'invoice';

export const EditLineItemModal = observer(() => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');
  const item = projectDashboardStore.editingLineItem;
  const isOpen = !!item;

  const REASON_OPTIONS: { value: LineItemEditReason; label: string }[] = [
    { value: 'DATA_EXTRACTION_ERROR', label: t('editModal.reasonDataExtraction') },
    { value: 'PRICE_CORRECTION', label: t('editModal.reasonPriceCorrection') },
    { value: 'QUANTITY_ADJUSTMENT', label: t('editModal.reasonQuantityAdjustment') },
    { value: 'UNIT_TYPE_CORRECTION', label: t('editModal.reasonUnitTypeCorrection') },
    { value: 'CREDIT_NOTE_APPLIED', label: t('editModal.reasonCreditNote') },
    { value: 'OTHER', label: t('editModal.reasonOther') },
  ];

  const UNIT_OPTIONS = [
    { value: 'UNIT', label: t('editModal.unitUnit') },
    { value: 'TON', label: t('editModal.unitTon') },
    { value: 'M', label: t('editModal.unitMeter') },
    { value: 'KG', label: t('editModal.unitKg') },
    { value: 'M2', label: t('editModal.unitM2') },
    { value: 'M3', label: t('editModal.unitM3') },
    { value: 'LITER', label: t('editModal.unitLiter') },
  ];

  const SOURCE_OPTIONS: { value: EditSource; label: string }[] = [
    { value: 'po', label: t('editModal.sourceOrder') },
    { value: 'dn', label: t('editModal.sourceDeliveryNote') },
    { value: 'invoice', label: t('editModal.sourceInvoice') },
  ];

  const [editSource, setEditSource] = useState<EditSource>('po');
  const [qty, setQty] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [unit, setUnit] = useState<string>('UNIT');
  const [reason, setReason] = useState<LineItemEditReason | ''>('');
  const [note, setNote] = useState('');

  // Check which document types exist via related documents
  const hasPoDoc = item?.relatedDocuments?.some(d => d.type === 'PO') ?? (item?.orderedQty != null);
  const hasDnDoc = item?.relatedDocuments?.some(d => d.type === 'DC') ?? (item?.receivedQty != null && item.receivedQty > 0);
  const hasInvDoc = item?.relatedDocuments?.some(d => d.type === 'INV') ?? (item?.invoicedAmount != null);

  useEffect(() => {
    if (item) {
      // Default to the most relevant source
      const isDnView = item.groupBy && item.groupBy !== 'orders';
      const defaultSource: EditSource = isDnView ? 'dn' : 'po';
      setEditSource(defaultSource);
      setQtyForSource(defaultSource);
      setUnitPrice(String(item.unitPrice ?? 0));
      setUnit(item.unit || 'UNIT');
      setReason((projectDashboardStore.editDefaultReason as LineItemEditReason) || '');
      setNote('');
    }
  }, [item]);

  const setQtyForSource = (source: EditSource) => {
    if (!item) return;
    switch (source) {
      case 'po':
        setQty(String(item.orderedQty ?? 0));
        break;
      case 'dn':
        // In orders view: receivedQty comes from DN. In DN view: quantity is the DN qty.
        setQty(String(item.quantity ?? item.receivedQty ?? 0));
        break;
      case 'invoice':
        setQty(String(item.invoicedAmount ?? 0));
        break;
    }
  };

  const handleSourceChange = (source: EditSource) => {
    setEditSource(source);
    setQtyForSource(source);
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!item) return null;

  const canSave = reason !== '' && !projectDashboardStore.editSaving;

  const sourceLabel =
    editSource === 'po' ? t('editModal.orderedQtyLabel') :
    editSource === 'dn' ? t('editModal.receivedQtyLabel') :
    t('editModal.invoicedQtyLabel');

  const handleSave = async () => {
    if (!canSave) return;
    const payload: any = {
      unitPrice: Number(unitPrice),
      unit,
      reason: reason as LineItemEditReason,
      note: note.trim() || undefined,
      editSource,
    };
    if (editSource === 'invoice') {
      payload.invoicedQty = Number(qty);
    } else {
      payload.quantity = Number(qty);
    }
    await projectDashboardStore.saveLineItemEdit(payload);
  };

  const handleClose = () => {
    projectDashboardStore.closeEdit();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Right-side Drawer (RTL: opens from left) */}
      <div className="absolute top-0 left-0 bottom-0 w-full max-w-md bg-base-100 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-base-content">{t('editModal.title')}</h2>
              <p className="text-sm text-base-content/40 font-mono mt-1">{t('editModal.orderLabel')} {item.poNumber}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-base-content/40 hover:text-base-content/60 transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {/* Read-only: Item details */}
            <div className="bg-base-200 rounded-xl p-4 border border-base-300">
              <p className="text-base font-bold text-base-content mb-3">{item.description}</p>
              {hasPoDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50">
                  <span>{t('editModal.orderedQty')}</span>
                  <span className="font-bold text-base-content">{item.orderedQty}</span>
                </div>
              )}
              {hasDnDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                  <span>{t('editModal.receivedQty')}</span>
                  <span className="font-bold text-success">{item.quantity ?? item.receivedQty}</span>
                </div>
              )}
              {hasInvDoc && (
                <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                  <span>{t('editModal.invoicedQty')}</span>
                  <span className="font-bold text-info">{item.invoicedAmount}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-base-content/50 mt-1.5">
                <span>{t('editModal.unitPriceLabel')}</span>
                <span className="font-bold text-base-content">{formatCurrency(item.unitPrice ?? 0, item.currency)}</span>
              </div>
            </div>

            {/* Document Source Selector */}
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">{t('editModal.documentSource')}</label>
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_OPTIONS.map((opt) => {
                  const isAvailable =
                    opt.value === 'po' ? hasPoDoc :
                    opt.value === 'dn' ? hasDnDoc :
                    hasInvDoc;
                  const isSelected = editSource === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSourceChange(opt.value)}
                      disabled={!isAvailable}
                      className={`px-3 py-2.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : isAvailable
                            ? 'border-base-300 bg-base-100 text-base-content/60 hover:border-base-content/20'
                            : 'border-base-300 bg-base-200 text-base-content/30 cursor-not-allowed'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable: Quantity */}
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {sourceLabel}
              </label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full border-2 border-base-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                dir="ltr"
              />
            </div>

            {/* Editable: Unit Price + Unit Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-base-content mb-2">{t('editModal.unitPriceCurrency')}</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full border-2 border-base-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content mb-2">{t('editModal.unitType')}</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full border-2 border-base-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 transition-colors"
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-warning shrink-0" />
              <p className="text-sm text-warning">{t('editModal.editWarning')}</p>
            </div>

            {/* Reason for Change */}
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {t('editModal.changeReason')} <span className="text-error">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as LineItemEditReason)}
                className="w-full border-2 border-base-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 transition-colors"
              >
                <option value="">{t('editModal.selectReasonPlaceholder')}</option>
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Optional Note */}
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">{t('editModal.noteLabel')}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder={t('editModal.notePlaceholder')}
                className="w-full border-2 border-base-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer - pinned to bottom */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-100">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
          >
            {t('common:cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="btn btn-primary btn-sm gap-2"
          >
            <Save size={14} />
            {t('editModal.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
});
