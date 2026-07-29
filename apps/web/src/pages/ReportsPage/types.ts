export type ReportType = 'GLOBAL_DISCREPANCY' | 'VENDOR_SUMMARY' | 'MASTER_LEDGER' | 'BUDGET_CONTROL';

export interface ReportRow {
  vendorName: string;
  amount: number;
  notes: string;
  poNumber: number;
  dcNumber: number;
  date: string;
}
