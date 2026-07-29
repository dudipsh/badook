# Super Admin Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated Super Admin page with 6 tabs (Companies, Users, Prompts, Stats, Feedback, Testing), move content from Settings/AdminPage, restrict access to SUPER_ADMIN role only.

**Architecture:** New `/super-admin` route group with tab-based navigation using React Router. A `SuperAdminGuard` component wraps routes to enforce role check. Existing components are moved from AdminPage/UserManagementPage/TestingPage into tab sub-components under `pages/SuperAdminPage/`. Settings page is simplified to keep only Email, WhatsApp, Agent Training.

**Tech Stack:** React 19, React Router 7, MobX, Tailwind CSS, lucide-react, react-i18next

---

## File Structure

```
pages/SuperAdminPage/
  SuperAdminPage.tsx              (~50 lines - layout shell with tab bar + Outlet)
  components/
    SuperAdminTabBar.tsx           (~55 lines - 6 tab buttons)
    CompaniesTab/
      CompaniesTab.tsx             (~70 lines - orchestrator)
      components/
        CreateCompanyForm.tsx      (~55 lines)
        CompanyCard.tsx            (~60 lines)
        CompanyUsersList.tsx       (~75 lines)
        CompanyUserRow.tsx         (~75 lines)
        AddCompanyUserForm.tsx     (~45 lines)
    UsersTab/
      UsersTab.tsx                 (~70 lines - from UserManagementPage)
      components/
        UsersTable.tsx             (move from UserManagementPage/components/)
        AddUserModal.tsx           (move from UserManagementPage/components/)
    PromptsTab.tsx                 (~45 lines - from PromptsSection, PromptCard stays inline as <80)
    StatsTab.tsx                   (~40 lines - orchestrates stats + AI + company settings)
    FeedbackTab.tsx                (~55 lines - from AdminPage feedback logic)
    TestingTab/
      TestingTab.tsx               (~75 lines - from TestingPage)
      components/
        TestCaseCard.tsx           (move from TestingPage/components/)
        TestResultsPanel.tsx       (move from TestingPage/components/)

components/layout/
  SuperAdminGuard.tsx              (~15 lines - checks isSuperAdmin, redirects if not)
```

**Files to modify:**
- `App.tsx` — add /super-admin routes, remove /settings/admin, /settings/users, /settings/tests
- `components/layout/SagurSidebar.tsx` — add Super Admin nav item (visible only to super admins)
- `components/shared/SettingsTabBar.tsx` — remove System Admin, User Management, Testing tabs
- `i18n/locales/he/nav.json` — add superAdmin key
- `i18n/locales/en/nav.json` — add superAdmin key

**Files to delete after migration:**
- `pages/AdminPage/` (entire directory)
- `pages/UserManagementPage/` (entire directory)
- `pages/TestingPage/` (entire directory)

**Shared components that stay in place (reused by tabs):**
- `components/ui/Modal.tsx`
- `components/shared/ResetConfirmModal.tsx`
- `pages/AdminPage/components/SystemStatsGrid.tsx` → moves to SuperAdminPage
- `pages/AdminPage/components/AIUsageSection.tsx` → moves to SuperAdminPage
- `pages/AdminPage/components/FeedbackTable.tsx` → moves to SuperAdminPage
- `pages/AdminPage/components/FeedbackEditModal.tsx` → moves to SuperAdminPage
- `pages/AdminPage/components/DeleteConfirmModal.tsx` → moves to SuperAdminPage
- `pages/AdminPage/components/CompanySettingsSection.tsx` → moves to SuperAdminPage

---

### Task 1: Create SuperAdminGuard component

**Files:**
- Create: `apps/web/src/components/layout/SuperAdminGuard.tsx`

- [ ] **Step 1: Create SuperAdminGuard**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';

export const SuperAdminGuard = observer(() => {
  const { authStore } = useStores();
  if (!authStore.user) return null;
  if (!authStore.isSuperAdmin) return <Navigate to="/" />;
  return <Outlet />;
});
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/layout/SuperAdminGuard.tsx
git commit -m "feat: add SuperAdminGuard route guard"
```

---

### Task 2: Create SuperAdminTabBar

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/components/SuperAdminTabBar.tsx`

- [ ] **Step 1: Create SuperAdminTabBar**

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Bot, BarChart3, Brain, TestTube2 } from 'lucide-react';

const TABS = [
  { path: '/super-admin/companies', labelKey: 'superAdminTabs.companies', icon: Building2 },
  { path: '/super-admin/users', labelKey: 'superAdminTabs.users', icon: Users },
  { path: '/super-admin/prompts', labelKey: 'superAdminTabs.prompts', icon: Bot },
  { path: '/super-admin/stats', labelKey: 'superAdminTabs.stats', icon: BarChart3 },
  { path: '/super-admin/feedback', labelKey: 'superAdminTabs.feedback', icon: Brain },
  { path: '/super-admin/testing', labelKey: 'superAdminTabs.testing', icon: TestTube2 },
] as const;

export const SuperAdminTabBar = () => {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/components/SuperAdminTabBar.tsx
git commit -m "feat: add SuperAdminTabBar component"
```

---

### Task 3: Create SuperAdminPage shell

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/SuperAdminPage.tsx`

- [ ] **Step 1: Create SuperAdminPage**

```tsx
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import { SuperAdminTabBar } from './components/SuperAdminTabBar';

export const SuperAdminPage = () => {
  const { t } = useTranslation('nav');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">
          {t('superAdmin')}
        </h1>
      </div>
      <SuperAdminTabBar />
      <Outlet />
    </div>
  );
};
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/SuperAdminPage.tsx
git commit -m "feat: add SuperAdminPage shell with tab bar"
```

---

### Task 4: Create CompaniesTab (split from CompaniesSection 288 lines)

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/CompaniesTab.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/components/CreateCompanyForm.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/components/CompanyCard.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/components/CompanyUsersList.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/components/CompanyUserRow.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/components/AddCompanyUserForm.tsx`

The original `CompaniesSection.tsx` (288 lines) must be split into focused components:

- [ ] **Step 1: Create AddCompanyUserForm**

Extracted from CompaniesSection lines 194-213. Grid form for adding a user to a specific company.

```tsx
import { Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  companyName: string;
  form: { name: string; email: string; password: string; role: string };
  saving: boolean;
  onFormChange: (form: Props['form']) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const AddCompanyUserForm = ({ companyName, form, saving, onFormChange, onSubmit, onCancel }: Props) => {
  const { t } = useTranslation('settings');

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <h4 className="text-xs font-medium text-gray-600">
        {t('companies.newUserFor')} {companyName}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <input className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder={`${t('companies.fullName')} *`} value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} />
        <input className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder={`${t('companies.email')} *`} type="email" value={form.email} onChange={(e) => onFormChange({ ...form, email: e.target.value })} />
        <input className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder={`${t('companies.password')} *`} type="password" value={form.password} onChange={(e) => onFormChange({ ...form, password: e.target.value })} />
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={form.role} onChange={(e) => onFormChange({ ...form, role: e.target.value })}>
          <option value="ADMIN">{t('common:roles.admin')}</option>
          <option value="ACCOUNTANT">{t('common:roles.accountant')}</option>
          <option value="FIELD_WORKER">{t('common:roles.fieldWorker')}</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={onSubmit} disabled={saving || !form.email || !form.name || !form.password} className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t('companies.createUser')}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-2">{t('common:cancel')}</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create CompanyUserRow**

Extracted from CompaniesSection lines 239-278. Single user row with edit/reset password.

```tsx
import { useState } from 'react';
import { Pencil, KeyRound, Loader2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyUser } from '../../../../../services/admin.service';
import toast from 'react-hot-toast';

interface Props {
  user: CompanyUser;
  companyId: string;
  onUserUpdated: (user: CompanyUser) => void;
  onTempPassword: (password: string) => void;
}

export const CompanyUserRow = ({ user, companyId, onUserUpdated, onTempPassword }: Props) => {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const startEdit = () => {
    setEditing(true);
    setEditForm({ name: user.name, email: user.email });
    setResetConfirm(false);
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    setSaving(true);
    try {
      const updated = await adminService.updateCompanyUser(companyId, user.id, editForm);
      onUserUpdated(updated);
      setEditing(false);
      toast.success(t('companies.userUpdated'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.userUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const { temporaryPassword } = await adminService.resetUserPassword(companyId, user.id);
      onTempPassword(temporaryPassword);
      setResetConfirm(false);
      toast.success(t('companies.passwordReset'));
    } catch {
      toast.error(t('companies.passwordResetError'));
    } finally {
      setResetting(false);
    }
  };

  const roleKey = user.role === 'SUPER_ADMIN' ? 'superAdmin' : user.role === 'ADMIN' ? 'admin' : user.role === 'ACCOUNTANT' ? 'accountant' : 'fieldWorker';

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input className="border border-gray-300 rounded px-2 py-1 text-sm w-36" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="border border-gray-300 rounded px-2 py-1 text-sm w-48" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} type="email" />
          <button onClick={handleSave} disabled={saving} className="text-xs bg-primary-600 text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1">
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} {t('common:save')}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">{t('common:cancel')}</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-800">{user.name}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{t(`common:roles.${roleKey}`)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startEdit} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-50">
              <Pencil size={12} /> {t('common:edit')}
            </button>
            {resetConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600">{t('common:areYouSure')}</span>
                <button onClick={handleReset} disabled={resetting} className="text-xs bg-red-600 text-white px-2 py-1 rounded flex items-center gap-1">
                  {resetting ? <Loader2 size={10} className="animate-spin" /> : null} {t('common:yes')}
                </button>
                <button onClick={() => setResetConfirm(false)} className="text-xs text-gray-500 px-1">{t('common:no')}</button>
              </div>
            ) : (
              <button onClick={() => setResetConfirm(true)} className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-50">
                <KeyRound size={12} /> {t('companies.resetPassword')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Create CompanyUsersList**

Shows temp password banner + list of CompanyUserRow components.

```tsx
import { useState, useEffect } from 'react';
import { Loader2, Copy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyUser } from '../../../../../services/admin.service';
import { CompanyUserRow } from './CompanyUserRow';
import toast from 'react-hot-toast';

interface Props {
  companyId: string;
}

export const CompanyUsersList = ({ companyId }: Props) => {
  const { t } = useTranslation('settings');
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminService.listCompanyUsers(companyId)
      .then((data) => setUsers(data))
      .catch(() => toast.error(t('companies.usersLoadError')))
      .finally(() => setLoading(false));
  }, [companyId, t]);

  const handleUserUpdated = (updated: CompanyUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-400" /></div>;
  }

  if (users.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-3">{t('companies.noUsersInCompany')}</p>;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <h4 className="text-xs font-medium text-gray-500 mb-2">{t('companies.users')} ({users.length})</h4>

      {tempPassword && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
          <span className="text-green-800">{t('companies.tempPassword')}</span>
          <code className="bg-green-100 px-2 py-0.5 rounded font-mono text-green-900">{tempPassword}</code>
          <button onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success(t('common:copied')); }} className="text-green-600 hover:text-green-800"><Copy size={14} /></button>
          <button onClick={() => setTempPassword(null)} className="mr-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      )}

      {users.map((user) => (
        <CompanyUserRow key={user.id} user={user} companyId={companyId} onUserUpdated={handleUserUpdated} onTempPassword={setTempPassword} />
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Create CreateCompanyForm**

```tsx
import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyListItem } from '../../../../../services/admin.service';
import toast from 'react-hot-toast';

interface Props {
  onCreated: (company: CompanyListItem) => void;
  onCancel: () => void;
}

export const CreateCompanyForm = ({ onCreated, onCancel }: Props) => {
  const { t } = useTranslation('settings');
  const [form, setForm] = useState({ name: '', email: '', businessId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const newCo = await adminService.createCompany({
        name: form.name,
        email: form.email || undefined,
        businessId: form.businessId || undefined,
      });
      onCreated({ ...newCo, _count: { users: 0 } });
      toast.success(t('companies.companyCreated', { name: newCo.name }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.companyCreateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <h3 className="font-medium text-gray-800 text-sm">{t('companies.newCompany')}</h3>
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`${t('companies.companyName')} *`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('companies.email')} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('companies.businessId')} value={form.businessId} onChange={(e) => setForm((p) => ({ ...p, businessId: e.target.value }))} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('common:create')}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-2">{t('common:cancel')}</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Create CompanyCard**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CompanyListItem } from '../../../../../services/admin.service';
import { CompanyUsersList } from './CompanyUsersList';
import { AddCompanyUserForm } from './AddCompanyUserForm';

interface Props {
  company: CompanyListItem;
  onUserCountChange: (delta: number) => void;
}

export const CompanyCard = ({ company, onUserCountChange }: Props) => {
  const { t } = useTranslation('settings');
  const [showUsers, setShowUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'ADMIN' });

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-gray-900 text-sm">{company.name}</span>
          <div className="flex gap-3 mt-0.5">
            {company.email && <span className="text-xs text-gray-500">{company.email}</span>}
            {company.businessId && <span className="text-xs text-gray-500">{t('companies.businessId')} {company.businessId}</span>}
            <span className="text-xs text-gray-400">{company._count.users} {t('companies.users')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowUsers(!showUsers); setShowAddUser(false); }} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
            <Users size={14} /> {t('companies.showUsers')}
            {showUsers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => setShowAddUser(!showAddUser)} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            <UserPlus size={14} /> {t('companies.addUser')}
          </button>
        </div>
      </div>

      {showAddUser && (
        <AddCompanyUserForm
          companyName={company.name}
          form={userForm}
          saving={false}
          onFormChange={setUserForm}
          onSubmit={() => { onUserCountChange(1); setShowAddUser(false); setUserForm({ name: '', email: '', password: '', role: 'ADMIN' }); }}
          onCancel={() => setShowAddUser(false)}
        />
      )}

      {showUsers && <CompanyUsersList companyId={company.id} />}
    </div>
  );
};
```

Note: CompanyCard's AddCompanyUserForm integration needs the actual API call. The final implementation will wire `adminService.createCompanyUser` through the form's onSubmit properly.

- [ ] **Step 6: Create CompaniesTab**

```tsx
import { useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyListItem } from '../../../../services/admin.service';
import { CreateCompanyForm } from './components/CreateCompanyForm';
import { CompanyCard } from './components/CompanyCard';
import toast from 'react-hot-toast';

export const CompaniesTab = () => {
  const { t } = useTranslation('settings');
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await adminService.listCompanies();
      setCompanies(data);
      setLoaded(true);
    } catch {
      toast.error(t('companies.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = (company: CompanyListItem) => {
    setCompanies((prev) => [company, ...prev]);
    setShowCreate(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('companies.title')}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCompanies} disabled={loading} className="text-sm text-primary-600 hover:underline">
            {loaded ? t('common:refresh') : t('companies.loadCompanies')}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={14} /> {t('companies.createCompany')}
          </button>
        </div>
      </div>

      {showCreate && <CreateCompanyForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />}
      {loading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>}
      {loaded && companies.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t('companies.noCompanies')}</p>}

      <div className="space-y-2">
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            onUserCountChange={(delta) => setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, _count: { users: c._count.users + delta } } : c))}
          />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/components/CompaniesTab/
git commit -m "feat: add CompaniesTab with split sub-components"
```

---

### Task 5: Create UsersTab

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/components/UsersTab/UsersTab.tsx`
- Move: `apps/web/src/pages/UserManagementPage/components/UsersTable.tsx` → `apps/web/src/pages/SuperAdminPage/components/UsersTab/components/UsersTable.tsx`
- Move: `apps/web/src/pages/UserManagementPage/components/AddUserModal.tsx` → `apps/web/src/pages/SuperAdminPage/components/UsersTab/components/AddUserModal.tsx`

- [ ] **Step 1: Move UsersTable and AddUserModal**

Move the files, update import paths (change `../../../` to `../../../../../`).

- [ ] **Step 2: Create UsersTab**

Adapt from UserManagementPage.tsx (92 lines), remove SettingsTabBar and page header (SuperAdminPage provides those).

```tsx
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { UserPlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { UsersTable } from './components/UsersTable';
import { AddUserModal } from './components/AddUserModal';
import toast from 'react-hot-toast';
import type { CreateUserPayload, UserRole } from '../../../../services/users.service';

export const UsersTab = observer(() => {
  const { t } = useTranslation('settings');
  const { usersStore } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { usersStore.fetchUsers(); }, [usersStore]);

  const handleAddUser = async (dto: CreateUserPayload) => {
    try {
      await usersStore.createUser(dto);
      toast.success(t('userManagement.userCreated'));
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('userManagement.userCreateError'));
    }
  };

  const handleToggleActive = async (id: string, currentIsActive: boolean) => {
    try {
      await usersStore.toggleActive(id, currentIsActive);
      toast.success(currentIsActive ? t('userManagement.userDisabled') : t('userManagement.userEnabled'));
    } catch { toast.error(t('userManagement.statusError')); }
  };

  const handleChangeRole = async (id: string, role: UserRole) => {
    try {
      await usersStore.changeRole(id, role);
      toast.success(t('userManagement.roleUpdated'));
    } catch { toast.error(t('userManagement.roleUpdateError')); }
  };

  if (usersStore.loading && usersStore.users.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors">
          <UserPlus className="w-4 h-4" />
          {t('userManagement.addUser')}
        </button>
      </div>
      <UsersTable users={usersStore.users} onToggleActive={handleToggleActive} onChangeRole={handleChangeRole} />
      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddUser} />
    </div>
  );
});
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/components/UsersTab/
git commit -m "feat: add UsersTab with moved table and modal"
```

---

### Task 6: Create PromptsTab, StatsTab, FeedbackTab

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/components/PromptsTab.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/StatsTab.tsx`
- Create: `apps/web/src/pages/SuperAdminPage/components/FeedbackTab.tsx`
- Move: AdminPage components (SystemStatsGrid, AIUsageSection, CompanySettingsSection, FeedbackTable, FeedbackEditModal, DeleteConfirmModal) to `apps/web/src/pages/SuperAdminPage/components/shared/`

- [ ] **Step 1: Move shared admin components**

Move these files from `pages/AdminPage/components/` to `pages/SuperAdminPage/components/shared/`:
- `SystemStatsGrid.tsx`
- `AIUsageSection.tsx`
- `CompanySettingsSection.tsx`
- `FeedbackTable.tsx`
- `FeedbackEditModal.tsx`
- `DeleteConfirmModal.tsx`

Update their import paths accordingly.

- [ ] **Step 2: Create PromptsTab**

Adapted from PromptsSection.tsx. Keep PromptCard as a local function (it's small, ~35 lines).

```tsx
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Bot, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import type { AgentPromptItem } from '../../../../services/admin.service';

const PromptCard = ({ prompt }: { prompt: AgentPromptItem }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{prompt.name}</span>
          {prompt.description && <p className="text-xs text-gray-500 mt-1">{prompt.description}</p>}
          <span className="text-xs font-mono text-gray-300 mt-1 block">{prompt.promptKey}</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <pre className="p-3 bg-gray-50 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto leading-relaxed" dir="ltr">{prompt.promptText}</pre>
        </div>
      )}
    </div>
  );
};

const AGENT_TYPES = ['INTAKE', 'EXTRACTION', 'MATCHING'] as const;

export const PromptsTab = observer(() => {
  const { adminStore } = useStores();
  const { t } = useTranslation('settings');

  useEffect(() => { adminStore.fetchPrompts(); }, [adminStore]);

  const grouped = AGENT_TYPES.map((agentType) => ({
    agentType,
    name: t(`prompts.agents.${agentType}.name`),
    description: t(`prompts.agents.${agentType}.description`),
    prompts: adminStore.prompts.filter((p) => p.agentType === agentType),
  }));

  return (
    <div className="bg-white rounded-xl border p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-semibold text-gray-900">{t('prompts.title')}</h2>
      </div>
      <p className="text-sm text-gray-500">{t('prompts.description')}</p>
      {adminStore.promptsLoading && adminStore.prompts.length === 0 ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        grouped.map((group) => (
          <div key={group.agentType} className="space-y-3">
            <div className="border-b pb-2">
              <h3 className="font-semibold text-gray-800">{group.name}</h3>
              <p className="text-xs text-gray-500">{group.description}</p>
            </div>
            <div className="space-y-2">
              {group.prompts.map((prompt) => <PromptCard key={`${prompt.agentType}-${prompt.promptKey}`} prompt={prompt} />)}
              {group.prompts.length === 0 && <p className="text-sm text-gray-400 py-2">{t('prompts.noPrompts')}</p>}
            </div>
          </div>
        ))
      )}
    </div>
  );
});
```

- [ ] **Step 3: Create StatsTab**

Orchestrates SystemStatsGrid + AIUsageSection + CompanySettingsSection.

```tsx
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Loader2 } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { SystemStatsGrid } from './shared/SystemStatsGrid';
import { AIUsageSection } from './shared/AIUsageSection';
import { CompanySettingsSection } from './shared/CompanySettingsSection';

export const StatsTab = observer(() => {
  const { adminStore } = useStores();

  useEffect(() => { adminStore.fetchAll(); }, [adminStore]);

  if (adminStore.loading && !adminStore.systemStats) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <SystemStatsGrid stats={adminStore.systemStats} />
      <AIUsageSection usageStats={adminStore.usageStats} />
      <CompanySettingsSection settings={adminStore.companySettings} onSave={(dto) => adminStore.updateCompanySettings(dto)} />
    </div>
  );
});
```

- [ ] **Step 4: Create FeedbackTab**

Adapted from AdminPage feedback logic.

```tsx
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { FeedbackTable } from './shared/FeedbackTable';
import { FeedbackEditModal } from './shared/FeedbackEditModal';
import { DeleteConfirmModal } from './shared/DeleteConfirmModal';
import type { FeedbackItem } from '../../../../services/admin.service';
import toast from 'react-hot-toast';

export const FeedbackTab = observer(() => {
  const { t } = useTranslation('settings');
  const { adminStore } = useStores();
  const [editItem, setEditItem] = useState<FeedbackItem | null>(null);
  const [editForm, setEditForm] = useState({ descriptionA: '', descriptionB: '', catalogNumberA: '', catalogNumberB: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { adminStore.fetchFeedback(); }, [adminStore]);

  const handleEdit = (item: FeedbackItem) => {
    setEditItem(item);
    setEditForm({ descriptionA: item.descriptionA, descriptionB: item.descriptionB, catalogNumberA: item.catalogNumberA || '', catalogNumberB: item.catalogNumberB || '' });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      await adminStore.updateFeedback(editItem.id, { descriptionA: editForm.descriptionA, descriptionB: editForm.descriptionB, catalogNumberA: editForm.catalogNumberA || undefined, catalogNumberB: editForm.catalogNumberB || undefined });
      toast.success(t('training.feedbackUpdated'));
      setEditItem(null);
    } catch { toast.error(t('training.feedbackUpdateError')); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await adminStore.deleteFeedback(deleteId);
      toast.success(t('training.feedbackDeleted'));
      setDeleteId(null);
    } catch { toast.error(t('training.feedbackDeleteError')); }
  };

  return (
    <div className="space-y-4">
      <FeedbackTable list={adminStore.feedbackList} page={adminStore.feedbackPage} totalPages={adminStore.feedbackTotalPages}
        onEdit={handleEdit} onDelete={setDeleteId} onPageChange={(p) => adminStore.fetchFeedback(p)} />
      <FeedbackEditModal item={editItem} form={editForm} onFormChange={setEditForm} onClose={() => setEditItem(null)} onSave={handleSaveEdit} />
      <DeleteConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  );
});
```

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/components/
git commit -m "feat: add PromptsTab, StatsTab, FeedbackTab"
```

---

### Task 7: Create TestingTab

**Files:**
- Create: `apps/web/src/pages/SuperAdminPage/components/TestingTab/TestingTab.tsx`
- Move: `apps/web/src/pages/TestingPage/components/TestCaseCard.tsx` → `apps/web/src/pages/SuperAdminPage/components/TestingTab/components/TestCaseCard.tsx`
- Move: `apps/web/src/pages/TestingPage/components/TestResultsPanel.tsx` → `apps/web/src/pages/SuperAdminPage/components/TestingTab/components/TestResultsPanel.tsx`

- [ ] **Step 1: Move TestCaseCard and TestResultsPanel**

Move files, update import paths.

- [ ] **Step 2: Create TestingTab**

Adapted from TestingPage.tsx, remove SettingsTabBar and page header.

```tsx
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { TestTube2, Loader2, PlayCircle } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { TestCaseCard } from './components/TestCaseCard';
import { TestResultsPanel } from './components/TestResultsPanel';
import toast from 'react-hot-toast';

export const TestingTab = observer(() => {
  const { t } = useTranslation('settings');
  const { testingStore } = useStores();

  useEffect(() => { testingStore.fetchCases(); }, [testingStore]);

  const handleRunLive = async (id: string) => {
    try {
      const result = await testingStore.runLive(id);
      toast[result.status === 'passed' ? 'success' : 'error'](`${result.caseName}: ${result.status === 'passed' ? 'כל הטסטים עברו' : `${result.assertions.filter((a) => !a.passed).length} טסטים נכשלו`}`);
    } catch { toast.error('שגיאה בהרצת טסט חי'); }
  };

  const handleRunMock = async (id: string) => {
    try {
      const result = await testingStore.runMock(id);
      toast[result.status === 'passed' ? 'success' : 'error'](`${result.caseName}: ${result.status === 'passed' ? 'כל הטסטים עברו' : `${result.assertions.filter((a) => !a.passed).length} טסטים נכשלו`}`);
    } catch { toast.error('שגיאה בהרצת טסט מול מוק'); }
  };

  const handleGenerateMocks = async (id: string) => {
    try {
      await testingStore.generateMocks(id);
      toast.success('מוקים נוצרו בהצלחה');
    } catch { toast.error('שגיאה ביצירת מוקים'); }
  };

  const handleRunAllMocks = async () => {
    try {
      const results = await testingStore.runAllMocks();
      if (!results) return;
      const passed = results.filter((r) => r.status === 'passed').length;
      const failed = results.length - passed;
      toast[failed === 0 ? 'success' : 'error'](failed === 0 ? `כל ${passed} הטסטים עברו` : `${passed} עברו, ${failed} נכשלו`);
    } catch { toast.error('שגיאה בהרצת כל הטסטים'); }
  };

  if (testingStore.loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  if (testingStore.cases.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <TestTube2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium">{t('testing.noCases', 'אין טסטים')}</p>
        <p className="text-sm mt-1">{t('testing.noCasesDesc', 'הוסף תקיות עם מסמכים ב-test-fixtures/chains/')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={handleRunAllMocks} disabled={testingStore.running || testingStore.cases.filter((c) => c.hasMocks).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
          {testingStore.running && testingStore.runningCaseId === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {t('testing.runAllMocks', 'הרצת כל המוקים')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {testingStore.cases.map((tc) => (
          <TestCaseCard key={tc.id} testCase={tc} running={testingStore.running} runningCaseId={testingStore.runningCaseId} generatingMocksForId={testingStore.generatingMocksForId}
            onRunLive={handleRunLive} onRunMock={handleRunMock} onGenerateMocks={handleGenerateMocks} />
        ))}
      </div>

      {testingStore.currentResult && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('testing.lastResult', 'תוצאת הרצה אחרונה')}</h2>
          <TestResultsPanel result={testingStore.currentResult} />
        </div>
      )}

      {testingStore.results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('testing.allResults', 'תוצאות הרצת כל המוקים')}</h2>
          {testingStore.results.map((result) => <TestResultsPanel key={result.runId} result={result} />)}
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/pages/SuperAdminPage/components/TestingTab/
git commit -m "feat: add TestingTab with moved sub-components"
```

---

### Task 8: Update routing, sidebar, settings tab bar, i18n

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/SagurSidebar.tsx`
- Modify: `apps/web/src/components/shared/SettingsTabBar.tsx`
- Modify: `apps/web/src/i18n/locales/he/nav.json`
- Modify: `apps/web/src/i18n/locales/en/nav.json`

- [ ] **Step 1: Update App.tsx**

Add SuperAdminPage routes, remove old settings sub-routes:

```tsx
// New imports
import { SuperAdminPage } from './pages/SuperAdminPage/SuperAdminPage';
import { SuperAdminGuard } from './components/layout/SuperAdminGuard';
import { CompaniesTab } from './pages/SuperAdminPage/components/CompaniesTab/CompaniesTab';
import { UsersTab } from './pages/SuperAdminPage/components/UsersTab/UsersTab';
import { PromptsTab } from './pages/SuperAdminPage/components/PromptsTab';
import { StatsTab } from './pages/SuperAdminPage/components/StatsTab';
import { FeedbackTab } from './pages/SuperAdminPage/components/FeedbackTab';
import { TestingTab } from './pages/SuperAdminPage/components/TestingTab/TestingTab';

// Remove imports: AdminPage, UserManagementPage, TestingPage

// Routes: replace /settings/admin, /settings/users, /settings/tests with:
<Route element={<SuperAdminGuard />}>
  <Route path="/super-admin" element={<SuperAdminPage />}>
    <Route index element={<Navigate to="/super-admin/companies" />} />
    <Route path="companies" element={<CompaniesTab />} />
    <Route path="users" element={<UsersTab />} />
    <Route path="prompts" element={<PromptsTab />} />
    <Route path="stats" element={<StatsTab />} />
    <Route path="feedback" element={<FeedbackTab />} />
    <Route path="testing" element={<TestingTab />} />
  </Route>
</Route>
```

- [ ] **Step 2: Update SagurSidebar**

Add Super Admin nav item (Shield icon), shown only when `authStore.isSuperAdmin`:

```tsx
// Add import: Shield from lucide-react
// Add import: useStores to get authStore
// Add const isSuperAdmin check
// Add after Settings NavItem:
{authStore.isSuperAdmin && (
  <NavItem label={t('superAdmin')} icon={<Shield size={18} />} active={isSuperAdmin} onClick={() => navigate('/super-admin')} />
)}
```

- [ ] **Step 3: Update SettingsTabBar**

Remove System Admin, User Management, Testing tabs. Keep only Email, WhatsApp, Agent Training:

```tsx
const TABS = [
  { path: '/settings/email', labelKey: 'settingsTabs.emailScanning', icon: Mail },
  { path: '/settings/whatsapp', labelKey: 'settingsTabs.whatsapp', icon: MessageSquare },
  { path: '/settings/agent-training', labelKey: 'settingsTabs.agentTraining', icon: Brain },
];
```

Remove all role-based filtering logic (no longer needed).

- [ ] **Step 4: Update i18n**

Add to `he/nav.json`:
```json
"superAdmin": "סופר אדמין",
"superAdminTabs": {
  "companies": "חברות",
  "users": "משתמשים",
  "prompts": "פרומפטים",
  "stats": "סטטיסטיקות",
  "feedback": "פידבקים",
  "testing": "טסטים"
}
```

Add to `en/nav.json`:
```json
"superAdmin": "Super Admin",
"superAdminTabs": {
  "companies": "Companies",
  "users": "Users",
  "prompts": "Prompts",
  "stats": "Statistics",
  "feedback": "Feedback",
  "testing": "Testing"
}
```

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/App.tsx apps/web/src/components/layout/SagurSidebar.tsx apps/web/src/components/shared/SettingsTabBar.tsx apps/web/src/i18n/
git commit -m "feat: wire super admin routes, update sidebar and settings"
```

---

### Task 9: Delete old pages

**Files:**
- Delete: `apps/web/src/pages/AdminPage/` (entire directory)
- Delete: `apps/web/src/pages/UserManagementPage/` (entire directory)
- Delete: `apps/web/src/pages/TestingPage/` (entire directory)

- [ ] **Step 1: Delete old directories**

```bash
rm -rf apps/web/src/pages/AdminPage
rm -rf apps/web/src/pages/UserManagementPage
rm -rf apps/web/src/pages/TestingPage
```

- [ ] **Step 2: Verify no broken imports**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "chore: remove old AdminPage, UserManagementPage, TestingPage"
```

---

### Task 10: Verify build

- [ ] **Step 1: Run TypeScript check**
```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run dev build**
```bash
cd apps/web && npx vite build
```

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if fixes needed**
