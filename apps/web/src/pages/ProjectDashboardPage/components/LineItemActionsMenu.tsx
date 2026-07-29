import { MoreVertical, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import type { ReconciliationLineItem } from '../../../types/reconciliation';

interface Props {
    item: ReconciliationLineItem;
}

export const LineItemActionsMenu = ({ item }: Props) => {
    const { projectDashboardStore } = useStores();
    const { t } = useTranslation('projects');

    const OVERRIDE_OPTIONS = [
        { label: t('actionsMenu.substituteProduct'), type: 'OVERRIDE_SUBSTITUTE' },
        { label: t('actionsMenu.approvePriceIncrease'), type: 'OVERRIDE_PRICE_APPROVED' },
        { label: t('actionsMenu.unitCorrection'), type: 'OVERRIDE_UNIT_CORRECTION' },
    ] as const;

    const handleResolve = async (type: string) => {
        if (type === 'OVERRIDE_UNIT_CORRECTION') {
            projectDashboardStore.openEdit(item, 'UNIT_TYPE_CORRECTION');
            return;
        }
        try {
            await projectDashboardStore.resolveException(item.id, type);
            toast.success(type === 'FLAG_DUPLICATE' ? t('actionsMenu.markedAsDuplicate') : t('actionsMenu.discrepancyResolved'));
        } catch {
            toast.error(t('actionsMenu.updateError'));
        }
    };

    const closeDropdown = () => {
        const el = document.activeElement as HTMLElement;
        el?.blur();
    };

    return (
        <div className="dropdown dropdown-end dropdown-bottom">
            <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-xs btn-square"
                onClick={(e) => e.stopPropagation()}
            >
                <MoreVertical size={14} />
            </div>
            <ul
                tabIndex={0}
                className="dropdown-content z-[50] menu p-2 shadow-lg bg-base-100 rounded-xl border border-base-300 w-52 text-right"
            >
                <li className="menu-title px-2 py-1 text-xs text-warning font-semibold uppercase tracking-wider">
                    {t('actionsMenu.exceptionActions')}
                </li>

                <li>
                    <details>
                        <summary className="text-xs font-semibold text-warning hover:bg-warning/10">
                            {t('actionsMenu.overrideDiscrepancy')}
                            {item.hasOverride && <Check size={12} className="text-success" />}
                        </summary>
                        <ul>
                            {OVERRIDE_OPTIONS.map(({ label, type }) => (
                                <li key={type}>
                                    <a
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleResolve(type);
                                            closeDropdown();
                                        }}
                                        className="text-xs text-base-content"
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </details>
                </li>

                <li>
                    <a
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResolve('FLAG_DUPLICATE');
                            closeDropdown();
                        }}
                        className="text-xs text-base-content"
                    >
                        {t('actionsMenu.markAsDuplicate')}
                    </a>
                </li>

                <div className="divider my-1" />

                <li>
                    <a
                        onClick={(e) => {
                            e.stopPropagation();
                            projectDashboardStore.openEdit(item);
                            closeDropdown();
                        }}
                        className="text-xs text-base-content"
                    >
                        {t('actionsMenu.editItemDetails')}
                    </a>
                </li>

                {projectDashboardStore.groupBy !== 'orders' && (
                    <li>
                        <a
                            onClick={(e) => {
                                e.stopPropagation();
                                projectDashboardStore.openDelete(item);
                                closeDropdown();
                            }}
                            className="text-xs text-error hover:!bg-error/10"
                        >
                            <Trash2 size={12} />
                            {t('actionsMenu.deleteItem')}
                        </a>
                    </li>
                )}
            </ul>
        </div>
    );
};
