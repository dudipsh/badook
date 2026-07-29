import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Loader2, Check, UserCog, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyUser } from '../../../../../services/admin.service';
import { USER_ROLE_OPTIONS } from '../../../../../services/users.service';
import { useStores } from '../../../../../lib/store-context';
import toast from 'react-hot-toast';

interface Props {
  user: CompanyUser;
  companyId: string;
  onUserUpdated: (user: CompanyUser) => void;
  onUserDeleted: (id: string) => void;
}

const roleKeyFor = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'superAdmin';
    case 'ADMIN':
      return 'admin';
    case 'ACCOUNTANT':
      return 'accountant';
    case 'CONTRACTOR':
      return 'contractor';
    default:
      return 'fieldWorker';
  }
};

export const CompanyUserRow = ({ user, companyId, onUserUpdated, onUserDeleted }: Props) => {
  const { t } = useTranslation('settings');
  const { authStore } = useStores();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSelf = user.id === authStore.user?.id;

  const handleDelete = async () => {
    if (!confirm(t('companies.deleteUserConfirm', { name: user.name }))) return;
    setDeleting(true);
    try {
      await adminService.deleteCompanyUser(companyId, user.id);
      toast.success(t('companies.userDeleted'));
      onUserDeleted(user.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.deleteUserError'));
      setDeleting(false);
    }
  };

  const startEdit = () => {
    setEditing(true);
    setEditForm({ name: user.name, email: user.email, role: user.role });
  };

  const handleImpersonate = async () => {
    setImpersonating(true);
    try {
      await authStore.impersonate(user.id);
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.impersonateError'));
      setImpersonating(false);
    }
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    setSaving(true);
    try {
      const updated = await adminService.updateCompanyUser(companyId, user.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      });
      onUserUpdated(updated);
      setEditing(false);
      toast.success(t('companies.userUpdated'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.userUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
        <input className="border border-gray-300 rounded px-2 py-1 text-sm w-36" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="border border-gray-300 rounded px-2 py-1 text-sm w-48" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} type="email" />
        {user.role !== 'SUPER_ADMIN' && (
          <select className="border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
            {USER_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        )}
        <button onClick={handleSave} disabled={saving} className="text-xs bg-primary text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} {t('common:save')}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">{t('common:cancel')}</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-800">{user.name}</span>
        <span className="text-xs text-gray-500">{user.email}</span>
        <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{t(`common:roles.${roleKeyFor(user.role)}`)}</span>
      </div>
      <div className="flex items-center gap-1">
        {!isSelf && user.isActive && (
          <button onClick={handleImpersonate} disabled={impersonating} className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-50 disabled:opacity-50">
            {impersonating ? <Loader2 size={12} className="animate-spin" /> : <UserCog size={12} />} {t('common:impersonate')}
          </button>
        )}
        <button onClick={startEdit} className="text-xs text-primary hover:text-primary flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10">
          <Pencil size={12} /> {t('common:edit')}
        </button>
        {!isSelf && user.role !== 'SUPER_ADMIN' && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
            title={t('companies.deleteUser')}
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        )}
      </div>
    </div>
  );
};
