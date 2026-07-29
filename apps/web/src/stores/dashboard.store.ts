import { makeAutoObservable, runInAction } from 'mobx';
import {
  dashboardService,
  type DashboardSummary,
  type SupplierBreakdown,
} from '../services/dashboard.service';

export class DashboardStore {
  summary: DashboardSummary | null = null;
  supplierBreakdown: SupplierBreakdown[] = [];
  recentNotes: any[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchAll(force = false) {
    if (!force && this.summary) return;
    this.loading = true;
    try {
      const [summary, breakdown, recent] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getBySupplier(),
        dashboardService.getRecent(),
      ]);
      runInAction(() => {
        this.summary = summary;
        this.supplierBreakdown = breakdown;
        this.recentNotes = recent;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  invalidate() {
    this.summary = null;
  }
}
