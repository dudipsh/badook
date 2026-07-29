import { makeAutoObservable, runInAction } from 'mobx';
import { authService } from '../services/auth.service';
import { adminService } from '../services/admin.service';

const SUPER_TOKEN_KEY = 'superToken';

export class AuthStore {
  user: any = null;
  token: string | null = localStorage.getItem('token');
  // When impersonating, the super admin's own token is parked here so we can
  // return to it. Persisted so a refresh mid-impersonation still works.
  originalToken: string | null = localStorage.getItem(SUPER_TOKEN_KEY);
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  get isAuthenticated() {
    return !!this.token;
  }

  get isSuperAdmin() {
    return this.user?.role === 'SUPER_ADMIN';
  }

  get isAdmin() {
    return this.user?.role === 'ADMIN' || this.user?.role === 'SUPER_ADMIN';
  }

  get isImpersonating() {
    return !!this.originalToken;
  }

  // Called after an OAuth login redirect delivers a token (in the URL hash),
  // or after impersonation swaps the active token.
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
    return this.loadProfile();
  }

  async loadProfile() {
    if (!this.token) return;
    try {
      const profile = await authService.getProfile();
      runInAction(() => { this.user = profile; });
    } catch {
      this.logout();
    }
  }

  // Super admin → act as another user. Parks the current token and swaps in the
  // impersonation token (carrying an impersonatedBy claim).
  async impersonate(userId: string) {
    const { accessToken } = await adminService.impersonate(userId);
    const current = this.token;
    runInAction(() => {
      this.originalToken = current;
      if (current) localStorage.setItem(SUPER_TOKEN_KEY, current);
    });
    await this.setToken(accessToken);
  }

  async exitImpersonation() {
    const original = this.originalToken;
    runInAction(() => {
      this.originalToken = null;
      localStorage.removeItem(SUPER_TOKEN_KEY);
    });
    if (original) await this.setToken(original);
  }

  logout() {
    this.token = null;
    this.user = null;
    this.originalToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem(SUPER_TOKEN_KEY);
  }
}
