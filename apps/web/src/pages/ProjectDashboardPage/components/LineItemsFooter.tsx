import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { formatCurrency } from '../../../lib/currencyUtils';

export const LineItemsFooter = observer(() => {
    const { projectDashboardStore, adminStore } = useStores();
    const { t } = useTranslation('projects');
    const { filteredLineItems } = projectDashboardStore;

    if (filteredLineItems.length === 0) return null;
    if (projectDashboardStore.groupBy === 'deliveryNotes') return null;

    const vatRate = adminStore.companySettings?.defaultVatRate ?? 18;
    const currency = filteredLineItems[0]?.currency || 'ILS';
    const subtotal = filteredLineItems.reduce((sum, item) => sum + (item.totalPrice ?? item.lineTotal ?? 0), 0);
    const vatAmount = subtotal * vatRate / 100;
    const grandTotal = subtotal + vatAmount;

    return (
        <div className="shrink-0 border-t-2 border-base-300 text-xs bg-base-100">
            <div className="flex justify-between items-center py-2.5 px-3 sm:px-6">
                <span className="text-base-content/40 uppercase tracking-wider font-semibold text-xs">{t('footer.subtotalBeforeVAT')}</span>
                <span className="font-mono text-base-content/50" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 px-3 sm:px-6">
                <span className="text-base-content/40 uppercase tracking-wider font-semibold text-xs">{t('footer.vat', { rate: vatRate })}</span>
                <span className="font-mono text-base-content/50" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(vatAmount, currency)}</span>
            </div>
            <div className="flex justify-between items-center py-3 px-3 sm:px-6 bg-base-200/60 border-t border-base-300/60">
                <span className="font-bold text-base-content uppercase tracking-wider text-xs">{t('footer.totalIncVAT')}</span>
                <span className="font-mono font-bold tracking-tight text-sm text-base-content/90" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(grandTotal, currency)}</span>
            </div>
        </div>
    );
});
