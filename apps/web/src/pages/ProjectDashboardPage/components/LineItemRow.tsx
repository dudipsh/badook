import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import type { ReconciliationLineItem } from '../../../types/reconciliation';
import { QtyCell, PriceCell, ReceivedCell } from './LineItemCells';
import { RemainingCell, InvoicedCell, LineTotalCell } from './LineItemStatusCells';
import { LineItemActionsMenu } from './LineItemActionsMenu';
import { isColVisible } from '../utils/columnConfig';

interface LineItemRowProps {
  item: ReconciliationLineItem;
  isServiceRow?: boolean;
}

export const LineItemRow = ({ item, isServiceRow }: LineItemRowProps) => {
  const { projectDashboardStore } = useStores();
  const navigate = useNavigate();
  const { t } = useTranslation('projects');
  const { groupBy } = projectDashboardStore;
  const hasMismatch = item.invoicedStatus === 'mismatch';

  const handleReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    projectDashboardStore.openReview(item);
    navigate(`/projects/${projectDashboardStore.projectId}/review/${item.id}`);
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = item.relatedDocuments?.find((d) => d.fileUrl);
    if (doc?.fileUrl) projectDashboardStore.openDocument(doc.fileUrl);
  };

  return (
    <tr className={`hover:bg-base-200/60 group transition-colors duration-200 border-b border-base-300 ${hasMismatch ? 'bg-error/5' : ''} ${isServiceRow ? 'bg-info/[0.03]' : ''}`}>
      <td className="px-6 py-2 max-w-[220px]">
        <button
          onClick={() => projectDashboardStore.openDetailDrawer(item)}
          className="text-xs font-medium text-base-content hover:text-secondary transition-colors text-right w-full"
        >
          <span className="truncate block" data-tooltip-id="desc-tip" data-tooltip-content={item.description}>
            {item.description}
          </span>
        </button>
      </td>

      <QtyCell item={item} />
      {isColVisible('pricePerUnit', groupBy) && <PriceCell item={item} />}
      <ReceivedCell item={item} />
      {isColVisible('remaining', groupBy) && <RemainingCell item={item} />}
      {isColVisible('invoiced', groupBy) && <InvoicedCell item={item} />}
      {isColVisible('lineTotal', groupBy) && <LineTotalCell item={item} />}

      {/* Actions */}
      <td className="px-4 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          {hasMismatch ? (
            <button onClick={handleReview} className="inline-flex items-center gap-1.5 border border-warning text-warning bg-base-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-warning/10 hover:border-warning transition-colors">
              <Eye size={12} /> {t('itemRow.review')}
            </button>
          ) : (
            <button onClick={handleView} className="inline-flex items-center gap-1.5 text-base-content/50 hover:text-secondary text-xs font-medium transition-colors">
              <Eye size={12} /> {t('itemRow.view')}
            </button>
          )}
          <LineItemActionsMenu item={item} />
        </div>
      </td>
    </tr>
  );
}
