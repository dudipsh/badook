import { apiClient } from './api-client';

export interface DashboardSummary {
  totalNotes: number;
  pendingReview: number;
  approvedThisMonth: number;
  totalAmountThisMonth: number;
}

export interface SupplierBreakdown {
  supplierName: string;
  noteCount: number;
  totalAmount: number;
}

export const dashboardService = {
  getSummary() {
    return apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data);
  },
  getBySupplier() {
    return apiClient.get<SupplierBreakdown[]>('/dashboard/by-supplier').then((r) => r.data);
  },
  getRecent() {
    return apiClient.get('/dashboard/recent').then((r) => r.data);
  },
};
