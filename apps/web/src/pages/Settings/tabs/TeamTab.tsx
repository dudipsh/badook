import { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Shield,
  Mail,
  Loader2,
  Check,
  X,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';
import { usersService, USER_ROLE_OPTIONS, type User, type UserRole } from '../../../services/users.service';

type RoleStyle = { badge: string; avatar: string };

const roleStyleFor = (role: string): RoleStyle => {
  switch (role) {
    case 'SUPER_ADMIN':
      return { badge: 'badge-accent', avatar: 'bg-accent text-accent-content' };
    case 'ADMIN':
      return { badge: 'badge-primary', avatar: 'bg-neutral text-neutral-content' };
    case 'ACCOUNTANT':
      return { badge: 'badge-secondary', avatar: 'bg-primary/20 text-primary' };
    case 'CONTRACTOR':
      return { badge: 'badge-info', avatar: 'bg-info/20 text-info' };
    default:
      return { badge: 'badge-ghost', avatar: 'bg-base-300 text-base-content/70' };
  }
};

const roleLabelKey = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'common:roles.superAdmin';
    case 'ADMIN':
      return 'common:roles.admin';
    case 'ACCOUNTANT':
      return 'common:roles.accountant';
    case 'CONTRACTOR':
      return 'common:roles.contractor';
    default:
      return 'common:roles.fieldWorker';
  }
};

const initialsFrom = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '?';
};

export const TeamTab = observer(() => {
  const { t } = useTranslation('settings');
  const { authStore } = useStores();
  const companyId = authStore.user?.companyId;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: UserRole }>({
    name: '',
    email: '',
    role: 'ADMIN',
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    usersService
      .listUsers()
      .then(setUsers)
      .catch(() => toast.error(t('companies.usersLoadError')))
      .finally(() => setLoading(false));
  }, [companyId, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const handleInvite = async () => {
    if (!companyId || !inviteForm.email.trim() || !inviteForm.name.trim()) return;
    setInviting(true);
    try {
      const created = await usersService.createUser(inviteForm);
      setUsers((prev) => [...prev, created]);
      setInviteForm({ name: '', email: '', role: 'ADMIN' });
      setShowInvite(false);
      toast.success(t('companies.userCreated'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.userCreateError'));
    } finally {
      setInviting(false);
    }
  };

  if (!companyId) {
    return <div className="text-sm text-base-content/60">{t('team.noCompany')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-base-200 pb-4 mb-6">
        <h2 className="text-xl font-bold text-base-content">{t('team.tabTitle')}</h2>
        <p className="text-sm text-base-content/60 mt-1">{t('team.tabSubtitle')}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
          <input
            type="text"
            placeholder={t('team.searchPlaceholder')}
            className="input input-sm w-full border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all !ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="auto"
          />
        </div>
        <button
          className="btn btn-sm bg-base-100 border-base-300 text-base-content hover:bg-base-200 hover:border-base-300 font-semibold shrink-0"
          onClick={() => setShowInvite((v) => !v)}
        >
          <Plus className="w-4 h-4" />
          {t('team.inviteUser')}
        </button>
      </div>

      {showInvite && (
        <InviteUserPanel
          form={inviteForm}
          saving={inviting}
          onChange={setInviteForm}
          onSubmit={handleInvite}
          onCancel={() => setShowInvite(false)}
        />
      )}

      <div className="bg-base-100 rounded-box border border-base-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-base-content/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-base-content/50">
            {users.length === 0 ? t('team.noUsersYet') : t('team.noUsersMatch')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full text-sm">
              <thead className="bg-base-200/30 text-base-content/60 uppercase text-xs">
                <tr>
                  <th className="ps-6 py-3">{t('team.userName')}</th>
                  <th className="py-3">{t('team.rolePermissions')}</th>
                  <th className="py-3">{t('team.contact')}</th>
                  <th className="py-3">{t('team.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const style = roleStyleFor(user.role);
                  return (
                    <tr key={user.id} className="border-b border-base-100 last:border-0 hover:bg-base-200/40 transition-colors">
                      <td className="ps-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className={`${style.avatar} w-8 rounded-full flex items-center justify-center text-xs`}>
                              <span className="font-bold">{initialsFrom(user.name)}</span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-sm ${style.badge} badge-outline gap-1.5 font-bold`}>
                          <Shield className="w-3 h-3" />
                          {t(roleLabelKey(user.role))}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-xs text-base-content/70" dir="ltr">
                          <Mail className="w-3.5 h-3.5 opacity-50 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </td>
                      <td>
                        {user.isActive ? (
                          <span className="badge badge-sm badge-success gap-1 bg-success/10 text-success border-0 font-semibold">
                            {t('team.statusActive')}
                          </span>
                        ) : (
                          <span className="badge badge-sm badge-warning gap-1 bg-warning/10 text-warning border-0 font-semibold">
                            {t('team.statusInactive')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

interface InvitePanelProps {
  form: { name: string; email: string; role: UserRole };
  saving: boolean;
  onChange: (f: InvitePanelProps['form']) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const InviteUserPanel = ({ form, saving, onChange, onSubmit, onCancel }: InvitePanelProps) => {
  const { t } = useTranslation('settings');
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-base-200/40 border-b border-base-300">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-base-content">{t('team.inviteUser')}</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 rounded-md flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-300/60 transition-colors"
          title={t('teamTab.cancel')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="form-control w-full">
            <span className="label-text text-xs font-medium text-base-content/60 pb-1.5">{t('teamTab.fullName')}</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full bg-base-100 border-base-300 focus:border-primary focus:outline-none transition-colors"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder={t('teamTab.fullNamePlaceholder')}
              dir="auto"
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text text-xs font-medium text-base-content/60 pb-1.5">{t('teamTab.email')}</span>
            <input
              type="email"
              className="input input-bordered input-sm w-full bg-base-100 border-base-300 focus:border-primary focus:outline-none transition-colors font-mono"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              placeholder="name@company.com"
              dir="ltr"
            />
          </label>
          <label className="form-control w-full md:col-span-2">
            <span className="label-text text-xs font-medium text-base-content/60 pb-1.5">{t('teamTab.role')}</span>
            <select
              className="select select-bordered select-sm w-full bg-base-100 border-base-300 focus:border-primary focus:outline-none transition-colors"
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value as UserRole })}
            >
              {USER_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-200">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t('teamTab.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSubmit}
            disabled={saving || !form.email || !form.name}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('teamTab.create')}
          </button>
        </div>
      </div>
    </div>
  );
};
