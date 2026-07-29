import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { formatCurrency } from '../../../lib/currencyUtils';
import { getColCount } from '../utils/columnConfig';
import type { ItemGroup } from '../utils/groupItems';

interface GroupFooterRowProps {
  group: ItemGroup;
}

export const GroupFooterRow = observer(({ group }: GroupFooterRowProps) => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const { groupBy } = projectDashboardStore;
  const colCount = getColCount(groupBy);
  const formattedTotal = formatCurrency(group.total, group.currency);

  return (
    <tr className="bg-base-200/30 text-xs shadow-[inset_0_1px_0_0_hsl(var(--b3))]">
      <td colSpan={colCount - 1} className="px-4 py-3 text-end font-bold text-base-content">
        {t('footer.total', 'Total')}:
      </td>
      <td className="px-4 py-3 text-end font-mono font-bold text-base-content/90 tracking-tight text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formattedTotal}
      </td>
    </tr>
  );
});
