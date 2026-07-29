import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Truck } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { getColCount } from '../utils/columnConfig';

export const ServiceFeesSeparator = observer(() => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const colCount = getColCount(projectDashboardStore.groupBy);

  return (
    <tr className="bg-info/5 border-t-2 border-info/20">
      <td colSpan={colCount} className="p-0">
        <div className="px-6 py-2">
          <div className="flex items-center gap-2 text-info">
            <Truck className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-widest">{t('lineItems.serviceFeesLabel')}</span>
            <div className="flex-1 border-t border-info/20 ms-2" />
            <span className="text-xs font-mono opacity-60">{t('lineItems.relatedItems')}</span>
          </div>
        </div>
      </td>
    </tr>
  );
});
