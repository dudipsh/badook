import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Tooltip } from 'react-tooltip';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { VirtualTable } from '../../../components/shared/virtual-table/VirtualTable';
import { LineItemsToolbar } from './LineItemsToolbar';
import { LineItemsTableHeader } from './LineItemsTableHeader';
import { GroupHeaderRow } from './GroupHeaderRow';
import { GroupFooterRow } from './GroupFooterRow';
import { LineItemRow } from './LineItemRow';
import { ServiceFeesSeparator } from './ServiceFeesSeparator';
import { EditLineItemModal } from './EditLineItemModal';
import { groupItems, type ItemGroup } from '../utils/groupItems';
import { getColCount } from '../utils/columnConfig';
import type { ReconciliationLineItem, DocType } from '../../../types/reconciliation';

interface LineItemsPanelProps {
  onVendorAction?: (type: 'MERGE' | 'DELETE') => void;
  onUpload?: (docType: DocType) => void;
}

export const LineItemsPanel = observer(({ onVendorAction, onUpload }: LineItemsPanelProps) => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');
  const { filteredLineItems, lineItemsLoading, isTableExpanded, groupBy, highlightedDocId } = projectDashboardStore;

  useEffect(() => {
    if (!isTableExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') projectDashboardStore.toggleTableExpanded();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTableExpanded, projectDashboardStore]);

  const regularItems = filteredLineItems.filter((item) => !item.isService);
  const serviceItems = filteredLineItems.filter((item) => item.isService);
  const groups = useMemo(() => groupItems(regularItems), [regularItems]);
  const colCount = getColCount(groupBy);

  const containerClass = isTableExpanded
    ? 'fixed inset-0 z-[9999] bg-base-100 flex flex-col p-4 sm:p-6 w-screen h-screen overflow-hidden shadow-2xl'
    : 'flex-1 flex flex-col min-w-0 h-full bg-base-100 rounded-xl border border-base-300 shadow-sm relative overflow-hidden';

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={containerClass}
      style={{ borderRadius: isTableExpanded ? 0 : 16 }}
    >
      <LineItemsToolbar onVendorAction={onVendorAction} onUpload={onUpload} />

      {lineItemsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto" />
            <p className="text-sm text-base-content/50 mt-2">{t('itemsPanel.loadingItems')}</p>
          </div>
        </div>
      ) : filteredLineItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-lg font-medium text-base-content/30">{t('itemsPanel.selectVendor')}</p>
          <p className="text-sm text-base-content/30 mt-1">{t('itemsPanel.selectVendorDescription')}</p>
        </div>
      ) : (
        <VirtualTable<ItemGroup, ReconciliationLineItem>
          groups={groups}
          groupKey={(g) => g.key}
          groupItems={(g) => g.items}
          groupHasFooter={(g) => groupBy !== 'deliveryNotes' && g.total > 0}
          itemKey={(item) => item.id}
          renderTableHeader={() => <LineItemsTableHeader />}
          renderGroupHeader={(g) => (
            <GroupHeaderRow key={`gh-${g.key}`} group={g} isHighlighted={highlightedDocId === g.key} />
          )}
          renderGroupFooter={(g) => <GroupFooterRow key={`gf-${g.key}`} group={g} />}
          renderRow={(item) => <LineItemRow key={item.id} item={item} />}
          trailingItems={serviceItems}
          separatorBeforeTrailing={<ServiceFeesSeparator />}
          renderTrailingRow={(item) => <LineItemRow key={item.id} item={item} isServiceRow />}
          trailingEmptyState={
            <tr className="bg-sky-50/20">
              <td colSpan={colCount} className="px-4 py-4 text-center text-xs text-base-content/40">
                {t('lineItems.noServiceItems')}
              </td>
            </tr>
          }
          highlightGroupKey={highlightedDocId}
          onHighlightComplete={() => projectDashboardStore.setHighlightedDocId(null)}
          colCount={colCount}
          overscan={10}
        />
      )}

      <Tooltip id="mismatch-tip" place="top" className="!text-xs !rounded-lg !px-3 !py-2" />
      <Tooltip id="desc-tip" place="top" className="!text-xs !rounded-lg !px-3 !py-2 !max-w-[300px] !whitespace-normal !z-[9999]" style={{ zIndex: 9999 }} />
      <EditLineItemModal />
    </motion.div>
  );
});
