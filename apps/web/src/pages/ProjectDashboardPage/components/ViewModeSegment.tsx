import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, FileText, Receipt } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import type { GroupByValue } from '../../../types/reconciliation';

const TAB_OPTIONS: { value: GroupByValue; labelKey: string; icon: typeof ClipboardList; activeClass: string }[] = [
  { value: 'orders', labelKey: 'toolbar.byOrders', icon: ClipboardList, activeClass: 'bg-primary text-primary-content shadow-md shadow-primary/20' },
  { value: 'deliveryNotes', labelKey: 'toolbar.byDeliveryNotes', icon: FileText, activeClass: 'bg-secondary text-secondary-content shadow-md shadow-secondary/20' },
  { value: 'invoices', labelKey: 'toolbar.byInvoices', icon: Receipt, activeClass: 'bg-accent text-accent-content shadow-md shadow-accent/20' },
];

const buildMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
};

const MONTH_OPTIONS = buildMonthOptions();

export const ViewModeSegment = observer(() => {
  const { projectDashboardStore } = useStores();
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { groupBy, dateFrom, projectId, selectedVendorId } = projectDashboardStore;

  const selectedMonth = dateFrom ? dateFrom.slice(0, 7) : '';

  const handleMonthChange = (value: string) => {
    if (!value) {
      projectDashboardStore.setDateFrom(null);
      projectDashboardStore.setDateTo(null);
      return;
    }
    const [year, month] = value.split('-').map(Number);
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0);
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
    projectDashboardStore.setDateFrom(first);
    projectDashboardStore.setDateTo(lastDay);
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="bg-base-200/70 p-1 rounded-xl flex items-center gap-1 border border-base-200/50 shadow-inner shrink-0">
        {TAB_OPTIONS.map(({ value, labelKey, icon: Icon, activeClass }) => {
          const isActive = groupBy === value;
          return (
            <button
              key={value}
              onClick={() => {
                projectDashboardStore.setGroupBy(value);
                if (projectId && selectedVendorId) {
                  navigate(`/projects/${projectId}/vendors/${selectedVendorId}/${value}`, { replace: true });
                }
              }}
              className={`btn btn-sm rounded-lg border-0 transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? `${activeClass} pointer-events-none`
                  : 'btn-ghost hover:bg-base-300/50 text-base-content/70'
              }`}
            >
              <Icon size={14} />
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <div className="h-6 w-px bg-base-300 mx-1 hidden sm:block shrink-0" />

      <select
        value={selectedMonth}
        onChange={(e) => handleMonthChange(e.target.value)}
        className="select select-sm font-semibold border border-base-300 focus:outline-none focus:ring-0 focus:border-base-content/30 rounded-md bg-base-100 text-xs whitespace-nowrap shrink-0"
      >
        <option value="">{t('toolbar.allMonths')}</option>
        {MONTH_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
});
