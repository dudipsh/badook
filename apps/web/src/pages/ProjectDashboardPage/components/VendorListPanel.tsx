import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { VendorCard } from './VendorCard';
import { CollapsedVendorCard } from './CollapsedVendorCard';
import { VendorSkeletonList } from './VendorSkeletonList';
import type { ProjectVendor } from '../../../types/reconciliation';

export const VendorListPanel = observer(() => {
  const { projectDashboardStore } = useStores();
  const navigate = useNavigate();
  const { t } = useTranslation('projects');
  const { filteredVendors, selectedVendorId, vendorSearch, vendorsLoading, projectId, sidebarCollapsed } = projectDashboardStore;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1400px)');
    projectDashboardStore.setSidebarCollapsed(mq.matches);
    const handler = (e: MediaQueryListEvent) => projectDashboardStore.setSidebarCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [projectDashboardStore]);

  const navigateToVendor = (vendorId: string) => navigate(`/projects/${projectId}/vendors/${vendorId}`);

  return (
    <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} shrink-0 bg-base-100 border border-base-300 shadow-sm rounded-xl flex flex-col h-full transition-all duration-200 overflow-hidden`}>
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-base-300 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              placeholder={t('vendorList.searchPlaceholder')}
              value={vendorSearch}
              onChange={(e) => projectDashboardStore.setVendorSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-base-200 border border-base-300 rounded-lg text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
            />
          </div>
        </div>
      )}

      <Tooltip id="vendor-name-tip" place="left" className="!text-xs !rounded-lg !px-3 !py-2 !max-w-[260px] !whitespace-normal !z-[9999]" style={{ zIndex: 9999 }} />

      <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-1 space-y-1' : 'p-3 space-y-1.5'}`}>
        {vendorsLoading ? (
          <VendorSkeletonList />
        ) : filteredVendors.length === 0 ? (
          <p className="text-sm text-base-content/40 text-center py-4">{t('vendorList.noVendorsFound')}</p>
        ) : (
          filteredVendors.map((vendor: ProjectVendor) =>
            sidebarCollapsed ? (
              <CollapsedVendorCard key={vendor.id} vendor={vendor} isActive={vendor.id === selectedVendorId} onClick={() => navigateToVendor(vendor.id)} />
            ) : (
              <VendorCard key={vendor.id} vendor={vendor} isActive={vendor.id === selectedVendorId} onClick={() => navigateToVendor(vendor.id)} />
            )
          )
        )}
      </div>
    </div>
  );
});

