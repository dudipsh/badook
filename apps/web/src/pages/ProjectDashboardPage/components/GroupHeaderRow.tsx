import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FileText, Package, Receipt, Eye, Calendar } from 'lucide-react';
import { formatCurrency } from '../../../lib/currencyUtils';
import { useStores } from '../../../lib/store-context';
import { LinkedDocumentsBadges } from './LinkedDocumentsBadges';
import { getColCount } from '../utils/columnConfig';
import type { ItemGroup } from '../utils/groupItems';

interface GroupHeaderRowProps {
  group: ItemGroup;
  isHighlighted?: boolean;
}

export const GroupHeaderRow = observer(({ group, isHighlighted = false }: GroupHeaderRowProps) => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const { groupBy } = projectDashboardStore;

  const formattedDate = group.date
    ? new Date(group.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const formattedTotal = formatCurrency(group.total, group.currency);

  const getDocIcon = () => {
    switch (groupBy) {
      case 'deliveryNotes': return <Package size={16} className="text-secondary" />;
      case 'invoices': return <Receipt size={16} className="text-accent" />;
      default: return <FileText size={16} className="text-primary" />;
    }
  };

  const getHighlightColor = () => {
    switch (groupBy) {
      case 'deliveryNotes': return 'bg-secondary/10 ring-inset ring-2 ring-secondary/40';
      case 'invoices': return 'bg-accent/10 ring-inset ring-2 ring-accent/40';
      default: return 'bg-primary/10 ring-inset ring-2 ring-primary/40';
    }
  };

  const colCount = getColCount(groupBy);

  return (
    <tr id={`doc-group-${group.key}`} className="shadow-sm">
      <th colSpan={colCount} className="bg-base-200 px-6 py-0 h-[44px] !border-b-0 sticky top-[34px] z-[19] outline outline-1 outline-base-300 relative" style={{ outlineOffset: '-1px' }}>
        <div className={`absolute inset-0 pointer-events-none ${getHighlightColor()} ${isHighlighted ? 'animate-highlight-breath' : 'opacity-0'}`} />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {getDocIcon()}
            <div className="flex items-center gap-2">
              <button
                className="text-sm font-bold text-base-content hover:bg-base-content/10 px-2.5 py-1 -ms-2.5 rounded-md transition-colors group/doc flex items-center gap-1.5 select-none"
                onClick={() => {
                  if (group.fileUrl) projectDashboardStore.openDocument(group.fileUrl);
                }}
              >
                {group.label}
                {group.fileUrl && (
                  <Eye size={14} className="text-base-content/40 opacity-0 group-hover/doc:opacity-70 transition-opacity" />
                )}
              </button>
              <LinkedDocumentsBadges group={group} groupBy={groupBy} />
              {formattedDate && (
                <>
                  <span className="text-base-content/30">│</span>
                  <span className="text-xs text-base-content/50 font-mono flex items-center gap-1.5">
                    <Calendar size={12} />
                    {formattedDate}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-base-content/50">
              {group.items.length} {t('toolbar.items')}
            </span>
            {groupBy !== 'deliveryNotes' && (
              <>
                <span className="text-base-content/20">|</span>
                <span className="font-bold text-base-content">
                  {formattedTotal} {t('footer.total', 'Total')}
                </span>
              </>
            )}
          </div>
        </div>
      </th>
    </tr>
  );
});
