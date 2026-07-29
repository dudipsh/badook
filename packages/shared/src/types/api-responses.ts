export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardSummary {
  totalNotes: number;
  pendingReview: number;
  approvedThisMonth: number;
  totalAmountThisMonth: number;
}

export interface SupplierBreakdown {
  supplierId: string;
  supplierName: string;
  noteCount: number;
  totalAmount: number;
}
