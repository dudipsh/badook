import { useTranslation } from 'react-i18next';
import { formatCurrency, fmtQty } from '../../../lib/currencyUtils';
import { translateUnit } from '../../../lib/formatters';
import type { ReconciliationLineItem } from '../../../types/reconciliation';

interface CellProps {
    item: ReconciliationLineItem;
}

/* -- Ordered Quantity -- */
export const QtyCell = ({ item }: CellProps) => {
    const { t } = useTranslation('projects');
    // Invoice view: show invoice's own quantity. DN/Orders view: show orderedQty from PO.
    const qty = item.groupBy === 'invoices' ? (item.quantity ?? null) : item.orderedQty;

    return (
        <td className="px-4 py-2 text-end font-mono tabular-nums">
            <div className="flex items-baseline gap-1">
                {qty != null ? (
                    <>
                        <span className="text-sm font-bold text-base-content">{fmtQty(qty)}</span>
                        {item.unit && <span className="text-xs text-base-content/40">{translateUnit(item.unit, t)}</span>}
                    </>
                ) : (
                    <span className="text-sm text-base-content/30">—</span>
                )}
            </div>
        </td>
    );
}

/* -- Price per Unit -- */
export const PriceCell = ({ item }: CellProps) => {
    const { t } = useTranslation('projects');
    const noPriceConfirmed = item.priceSource === null && item.unitPrice === 0 && item.groupBy && item.groupBy !== 'orders';

    return (
        <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
            <div className="flex flex-col items-start">
                {noPriceConfirmed ? (
                    <span
                        className="text-sm font-semibold text-base-content/30 cursor-help"
                        data-tooltip-id="mismatch-tip"
                        data-tooltip-content={t('cells.priceNotConfirmedTooltip')}
                    >
                        --
                    </span>
                ) : (
                    <>
                        {item.unitPrice > 0 && (
                            <span className={`text-sm font-semibold ${item.priceSource === 'po_matched' ? 'text-info' : 'text-base-content'}`}>
                                {formatCurrency(item.unitPrice, item.currency)}
                            </span>
                        )}
                        {item.priceSource === 'po_matched' && (
                            <span className="text-xs text-info/70 font-medium">{t('cells.completedFromPO')}</span>
                        )}
                        {item.priceSource === 'manual' && (
                            <span className="text-xs text-secondary font-medium">{t('cells.manualEntry')}</span>
                        )}
                    </>
                )}
                {item.discountPercent != null && item.discountPercent > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                        {item.priceBeforeDiscount != null && (
                            <span className="text-xs text-base-content/30 line-through">
                                {formatCurrency(item.priceBeforeDiscount, item.currency)}
                            </span>
                        )}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold bg-warning/15 text-warning border border-warning/30">
                            {item.discountPercent}% {t('cells.discountOff')}
                        </span>
                    </div>
                )}
            </div>
        </td>
    );
}

/* -- Received / Supplied -- */
export const ReceivedCell = ({ item }: CellProps) => {
    const { t } = useTranslation('projects');

    // DN view: show "X / Y" (this DN's qty / orderedQty) with shortage badge once per item-group
    if (item.groupBy === 'deliveryNotes') {
        const dnQty = item.quantity ?? 0;
        const ordered = item.orderedQty;
        const isPartial = item.deliveryStatus === 'partial' && ordered != null && dnQty < ordered;
        const isAnchor = item._shortageAnchor === true;
        const hideBadge = item._hideShortageBadge === true;
        const showBadge = isAnchor || (isPartial && !hideBadge);
        const tooltipOrdered = isAnchor ? (item._aggregateOrdered ?? 0) : (ordered ?? 0);
        const tooltipReceived = isAnchor ? (item._aggregateReceived ?? 0) : dnQty;
        const tooltipDiff = isAnchor ? (item._aggregateShortage ?? 0) : tooltipOrdered - tooltipReceived;

        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                <div className="flex flex-col items-start gap-0.5">
                    <div className="flex items-baseline gap-1">
                        <span className={`text-sm font-bold ${isPartial || hideBadge || isAnchor ? 'text-secondary' : 'text-success'}`}>{fmtQty(dnQty)}</span>
                        {ordered != null && (
                            <span className="text-sm text-base-content/40">/ {fmtQty(ordered)}</span>
                        )}
                        {item.unit && <span className="text-xs text-base-content/40">{translateUnit(item.unit, t)}</span>}
                    </div>
                    {showBadge && (
                        <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-warning/15 text-warning border border-warning/30 cursor-help"
                            data-tooltip-id="mismatch-tip"
                            data-tooltip-content={t('cells.shortageTooltip', {
                                diff: fmtQty(tooltipDiff),
                                received: fmtQty(tooltipReceived),
                                ordered: fmtQty(tooltipOrdered),
                            })}
                        >
                            {t('cells.shortage')}
                        </span>
                    )}
                </div>
            </td>
        );
    }

    // Invoice view: show received from DN with shipment count
    if (item.groupBy === 'invoices') {
        const received = item.receivedQty;
        const displayUnit = item.receivedUnit ?? item.unit;

        if (!received || received === 0) {
            return (
                <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
                    <span className="text-sm text-base-content/30">—</span>
                </td>
            );
        }

        return (
            <td className="px-4 py-2 text-end font-mono tabular-nums">
                <div className="flex flex-col items-start gap-0.5">
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-success">{fmtQty(received)}</span>
                        {displayUnit && <span className="text-xs text-base-content/40">{translateUnit(displayUnit, t)}</span>}
                    </div>
                    {item.shipmentCount > 0 && (
                        <span className="text-xs font-medium text-base-content/40">
                            {item.shipmentCount} {t('cells.shipment', { count: item.shipmentCount })}
                        </span>
                    )}
                </div>
            </td>
        );
    }

    // Orders view: show receivedQty with badge (original behavior)
    const displayUnit = item.receivedUnit ?? item.unit;

    return (
        <td className="px-4 py-2 text-end font-mono tabular-nums border-s border-base-300/50">
            <div className="flex flex-col items-start gap-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${item.receivedQty >= item.totalQty ? 'bg-success/20 text-success' :
                        item.receivedQty > 0 ? 'bg-warning/15 text-warning' : 'text-base-content/30'
                    }`}>
                    {fmtQty(item.receivedQty)} {translateUnit(displayUnit, t)}
                </span>
                {item.shipmentCount > 0 && (
                    <span className="text-xs font-medium text-base-content/40 uppercase">
                        {item.shipmentCount} {t('cells.shipment', { count: item.shipmentCount })}
                    </span>
                )}
            </div>
        </td>
    );
}
