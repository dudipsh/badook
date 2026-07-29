import { AlertTriangle, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, fmtQty } from '../../../lib/currencyUtils';
import { translateUnit } from '../../../lib/formatters';
import type { ReconciliationLineItem } from '../../../types/reconciliation';

interface CellProps {
    item: ReconciliationLineItem;
}

/* -- Remaining -- */
export const RemainingCell = ({ item }: CellProps) => {
    const { t } = useTranslation('projects');

    // DN view: show cumulative remaining vs PO
    if (item.groupBy === 'deliveryNotes') {
        if (item.remaining == null) {
            return (
                <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                    <span className="text-sm text-base-content/30">—</span>
                </td>
            );
        }
        if (item.remaining <= 0) {
            return (
                <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                        {t('cells.fulfilled')}
                    </span>
                </td>
            );
        }
        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-warning">{fmtQty(item.remaining)}</span>
                    {item.unit && <span className="text-xs text-base-content/40">{translateUnit(item.unit, t)}</span>}
                </div>
            </td>
        );
    }

    // Invoice view: column is hidden, but handle gracefully
    if (item.groupBy === 'invoices') {
        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <span className="text-sm text-base-content/30">—</span>
            </td>
        );
    }

    // Orders view: original behavior
    if (item.remaining === 0 && item.receivedQty > 0) {
        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                    {t('cells.fulfilled')}
                </span>
            </td>
        );
    }

    if (item.remaining < 0) {
        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-error">+{fmtQty(Math.abs(item.remaining))}</span>
                    <span className="text-xs text-error/70 font-medium">{t('cells.surplus')}</span>
                </div>
            </td>
        );
    }

    if (item.deliveryStatus === 'partial') {
        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-warning">{fmtQty(item.remaining)}</span>
                    <span className="text-xs text-warning font-medium">{t('cells.shortage')}</span>
                </div>
                {item.unit && <span className="text-xs text-base-content/40 mr-1">{translateUnit(item.unit, t)}</span>}
            </td>
        );
    }

    return (
        <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
            <span className="text-sm font-semibold text-base-content/60">{fmtQty(Math.abs(item.remaining))}</span>
            {item.remaining > 0 && item.unit && (
                <span className="text-xs text-base-content/40 mr-1">{translateUnit(item.unit, t)}</span>
            )}
        </td>
    );
}

/* -- Invoiced / Charged -- */
export const InvoicedCell = ({ item }: CellProps) => {
    const { t } = useTranslation('projects');

    // Invoice view: show invoice's own qty + @unit price
    if (item.groupBy === 'invoices') {
        const qty = item.quantity ?? 0;
        const price = item.unitPrice;

        return (
            <td className="px-4 py-2 text-end border-s border-base-300/50">
                <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-base-content">{fmtQty(qty)}</span>
                        {item.unit && <span className="text-xs text-base-content/40">{translateUnit(item.unit, t)}</span>}
                    </div>
                    {price != null && price > 0 && (
                        <span className="text-xs text-base-content/50 font-semibold">
                            @ {formatCurrency(price, item.currency)}
                        </span>
                    )}
                </div>
            </td>
        );
    }

    // DN view: column is hidden, but handle gracefully
    if (item.groupBy === 'deliveryNotes') {
        return (
            <td className="px-4 py-2 text-end border-s border-base-300/50">
                <span className="text-sm text-base-content/30">—</span>
            </td>
        );
    }

    // Orders view: original behavior
    const hasMismatch = item.invoicedStatus === 'mismatch';

    if (item.invoicedStatus === 'pending') {
        return (
            <td className="px-4 py-2 text-end border-s border-base-300/50">
                <span className="text-sm text-base-content/30">—</span>
            </td>
        );
    }

    const Icon = hasMismatch ? AlertTriangle : Check;
    const iconColor = hasMismatch ? 'text-error' : 'text-success';
    const textColor = hasMismatch ? 'text-error' : 'text-success';
    const subColor = hasMismatch ? 'text-error/70' : 'text-success/70';

    return (
        <td className="px-4 py-2 text-end border-s border-base-300/50">
            <div className="flex flex-col items-end gap-1.5">
                <span data-tooltip-id="mismatch-tip" data-tooltip-content={hasMismatch ? (item.mismatchReason || t('cells.mismatchDefault')) : undefined}>
                    <Icon size={14} className={`${iconColor} shrink-0`} />
                </span>
                <div className="flex flex-col items-end">
                    <span className={`text-sm font-mono ${hasMismatch ? 'font-extrabold' : 'font-bold'} ${textColor}`}>
                        {fmtQty(item.invoicedAmount ?? item.orderedQty)} <span className="text-xs font-normal text-base-content/40">{translateUnit(item.unit, t)}</span>
                    </span>
                    {(item.invoicedUnitPrice ?? item.unitPrice) > 0 && (
                        <span className={`text-xs ${subColor} font-semibold`}>
                            @ {formatCurrency(item.invoicedUnitPrice ?? item.unitPrice, item.currency)}
                        </span>
                    )}
                    {item.discountPercent != null && item.discountPercent > 0 && (
                        <span className="text-xs text-warning">{t('cells.discount', { percent: item.discountPercent })}</span>
                    )}
                </div>
            </div>
        </td>
    );
}

/* -- Line Total -- */
export const LineTotalCell = ({ item }: CellProps) => {
    const isDnOrInv = item.groupBy && item.groupBy !== 'orders';
    const noPriceConfirmed = item.priceSource === null && item.unitPrice === 0 && isDnOrInv;
    const total = isDnOrInv ? (item.totalPrice ?? item.lineTotal) : item.lineTotal;

    return (
        <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
            {noPriceConfirmed || total == null ? (
                <span className="text-sm font-bold text-base-content/30">--</span>
            ) : (
                <span className={`text-sm font-bold ${item.priceSource === 'po_matched' ? 'text-info' : 'text-base-content'}`}>
                    {formatCurrency(total, item.currency)}
                </span>
            )}
        </td>
    );
}
