import { X, Package } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { translateUnit } from '../../../lib/formatters';
import { DrawerAlertBanners } from './DrawerAlertBanners';
import { DrawerOrderDetails } from './DrawerOrderDetails';
import { DrawerDeliverySection } from './DrawerDeliverySection';
import { DrawerInvoiceSection } from './DrawerInvoiceSection';

export const LineItemDetailDrawer = observer(() => {
  const { projectDashboardStore, languageStore } = useStores();
  const { t } = useTranslation('projects');
  const item = projectDashboardStore.selectedDetailItem;

  if (!item) return null;

  const safeCurrency = (amount: number | null | undefined) => {
    if (amount == null || isNaN(amount)) return '\u2014';
    return new Intl.NumberFormat(languageStore.isRtl ? 'he-IL' : 'en-US', {
      style: 'currency', currency: item.currency || 'ILS', minimumFractionDigits: 2,
    }).format(amount);
  };

  const safeValue = (val: unknown, suffix = '') => {
    if (val == null || val === undefined) return '\u2014';
    const str = String(val);
    if (str === 'undefined' || str === 'null' || str === 'NaN') return '\u2014';
    return suffix ? `${str} ${suffix}`.trim() : str;
  };

  const deliveryLabels: Record<string, string> = { full: t('drawer.delivered'), partial: t('drawer.partialDelivery'), over: t('drawer.overDelivery'), none: t('drawer.pendingDelivery') };
  const deliveryColors: Record<string, string> = { full: 'text-success bg-success/10', partial: 'text-warning bg-warning/10', over: 'text-error bg-error/10' };
  const invoiceLabels: Record<string, string> = { matched: t('drawer.invoiceMatched'), mismatch: t('drawer.invoiceMismatch'), pending: t('drawer.pendingInvoice') };
  const invoiceColors: Record<string, string> = { matched: 'text-success bg-success/10', mismatch: 'text-error bg-error/10' };
  const statusHelpers = {
    deliveryLabel: deliveryLabels[item.deliveryStatus] ?? '\u2014',
    deliveryColor: deliveryColors[item.deliveryStatus] ?? 'text-base-content/50 bg-base-200',
    invoiceLabel: invoiceLabels[item.invoicedStatus] ?? '\u2014',
    invoiceColor: invoiceColors[item.invoicedStatus] ?? 'text-base-content/50 bg-base-200',
  };

  const poDocs = item.relatedDocuments?.filter((d) => d.type === 'PO') ?? [];
  const dcDocs = item.relatedDocuments?.filter((d) => d.type === 'DC') ?? [];
  const invDocs = item.relatedDocuments?.filter((d) => d.type === 'INV') ?? [];
  const unitLabel = translateUnit(item.unit, t);
  const handleViewDocument = (fileUrl: string | null) => { if (fileUrl) projectDashboardStore.openDocument(fileUrl); };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[10000] transition-opacity" onClick={() => projectDashboardStore.closeDetailDrawer()} />
      <div className={`fixed inset-y-0 z-[10001] w-full sm:max-w-md bg-base-100 shadow-2xl flex flex-col transition-transform duration-300 border-base-300 ${languageStore.isRtl ? 'left-0 border-r' : 'right-0 border-l'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0"><Package size={18} className="text-secondary" /></div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-base-content truncate">{item.description}</h3>
              <p className="text-xs text-base-content/40 mt-0.5">{item.poNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => projectDashboardStore.openEvidence(item)} className="px-3 py-1.5 text-xs font-semibold text-secondary bg-secondary/10 rounded-lg hover:bg-secondary/20 border border-secondary/30 transition-colors">{t('drawer.compareDocs')}</button>
            <button onClick={() => projectDashboardStore.closeDetailDrawer()} className="p-1.5 rounded-full text-base-content/40 hover:text-base-content/60 hover:bg-base-200 transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-base-200/30">
          <DrawerAlertBanners hasMismatch={item.invoicedStatus === 'mismatch'} hasShortDelivery={item.deliveryStatus === 'partial'} hasOverDelivery={item.deliveryStatus === 'over'} mismatchReason={item.mismatchReason} remaining={item.remaining} />
          <DrawerOrderDetails poDocs={poDocs} poNumber={item.poNumber} orderedQty={item.orderedQty} unitLabel={unitLabel} unitPrice={item.unitPrice} lineTotal={item.lineTotal} discountPercent={item.discountPercent} safeCurrency={safeCurrency} safeValue={safeValue} onViewDocument={handleViewDocument} />
          <DrawerDeliverySection dcDocs={dcDocs} deliveryHistory={item.deliveryHistory} receivedQty={item.receivedQty} receivedUnit={item.receivedUnit} remaining={item.remaining} shipmentCount={item.shipmentCount} unitLabel={unitLabel} deliveryStatusLabel={statusHelpers.deliveryLabel} deliveryStatusColor={statusHelpers.deliveryColor} safeValue={safeValue} onViewDocument={handleViewDocument} />
          <DrawerInvoiceSection invDocs={invDocs} invoicedAmount={item.invoicedAmount} invoicedUnitPrice={item.invoicedUnitPrice} invoiceStatusLabel={statusHelpers.invoiceLabel} invoiceStatusColor={statusHelpers.invoiceColor} safeCurrency={safeCurrency} onViewDocument={handleViewDocument} />
        </div>
      </div>
    </>
  );
});
