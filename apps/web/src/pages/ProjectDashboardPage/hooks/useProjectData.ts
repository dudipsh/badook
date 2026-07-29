import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../../../lib/store-context';
import type { GroupByValue } from '../../../types/reconciliation';

const VALID_GROUP_BY: GroupByValue[] = ['orders', 'deliveryNotes', 'invoices'];

export function useProjectData(id?: string, vendorId?: string, groupBy?: string) {
  const navigate = useNavigate();
  const { projectDashboardStore } = useStores();

  useEffect(() => {
    if (!id) return;
    projectDashboardStore.loadProject(id);
    projectDashboardStore.loadVendors(id);
  }, [id, projectDashboardStore]);

  // Sync groupBy from URL to store
  useEffect(() => {
    if (groupBy && VALID_GROUP_BY.includes(groupBy as GroupByValue)) {
      if (projectDashboardStore.groupBy !== groupBy) {
        projectDashboardStore.setGroupBy(groupBy as GroupByValue);
      }
    }
  }, [groupBy, projectDashboardStore]);

  useEffect(() => {
    if (projectDashboardStore.vendors.length === 0) return;
    if (vendorId && projectDashboardStore.selectedVendorId !== vendorId) {
      const exists = projectDashboardStore.vendors.some((v) => v.id === vendorId);
      if (exists) projectDashboardStore.selectVendor(vendorId);
      else navigate(`/projects/${id}/vendors/${projectDashboardStore.vendors[0].id}`, { replace: true });
    } else if (!vendorId && projectDashboardStore.selectedVendorId) {
      navigate(`/projects/${id}/vendors/${projectDashboardStore.selectedVendorId}`, { replace: true });
    }
  }, [vendorId, projectDashboardStore.vendors, id, navigate, projectDashboardStore]);

  useEffect(() => {
    if (projectDashboardStore.selectedVendorId && projectDashboardStore.projectId) {
      projectDashboardStore.loadLineItems();
      projectDashboardStore.loadVendorPOs();
    }
  }, [projectDashboardStore.selectedVendorId, projectDashboardStore.projectId, projectDashboardStore]);
}
