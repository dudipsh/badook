import { makeAutoObservable, runInAction } from 'mobx';
import { adminService, type CompanyListItem } from '../services/admin.service';

// Single source of truth for the super-admin companies list. The list view and
// the per-company detail page both read from here, so a user count or a delete
// reflects everywhere without prop drilling.
export class SuperAdminStore {
  companies: CompanyListItem[] = [];
  loading = false;
  loaded = false;

  constructor() {
    makeAutoObservable(this);
  }

  getCompany(companyId: string): CompanyListItem | null {
    return this.companies.find((c) => c.id === companyId) ?? null;
  }

  async fetchCompanies(force = false) {
    if (this.loaded && !force) return;
    this.loading = true;
    try {
      const companies = await adminService.listCompanies();
      runInAction(() => {
        this.companies = companies;
        this.loaded = true;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async createCompany(dto: { name: string; email?: string; businessId?: string }) {
    const company = await adminService.createCompany(dto);
    const item: CompanyListItem = { ...company, _count: { users: 0 } };
    runInAction(() => { this.companies.unshift(item); });
    return item;
  }

  async deleteCompany(companyId: string) {
    await adminService.deleteCompany(companyId);
    runInAction(() => {
      this.companies = this.companies.filter((c) => c.id !== companyId);
    });
  }

  adjustUserCount(companyId: string, delta: number) {
    const company = this.companies.find((c) => c.id === companyId);
    if (company) company._count.users += delta;
  }
}
