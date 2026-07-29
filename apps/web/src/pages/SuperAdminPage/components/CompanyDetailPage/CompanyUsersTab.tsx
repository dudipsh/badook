import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Users, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService } from '../../../../services/admin.service';
import { useStores } from '../../../../lib/store-context';
import { CompanyUsersList } from './components/CompanyUsersList';
import { AddCompanyUserForm } from './components/AddCompanyUserForm';
import toast from 'react-hot-toast';

export const CompanyUsersTab = observer(() => {
  const { t } = useTranslation('settings');
  const { companyId } = useParams<{ companyId: string }>();
  const { superAdminStore } = useStores();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', role: 'ADMIN' });
  const [saving, setSaving] = useState(false);

  if (!companyId) return null;
  const company = superAdminStore.getCompany(companyId);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await adminService.createCompanyUser(companyId, form);
      superAdminStore.adjustUserCount(companyId, 1);
      setForm({ name: '', email: '', role: 'ADMIN' });
      setShowAdd(false);
      setRefreshKey((k) => k + 1);
      toast.success(t('companies.userCreated'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.userCreateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Users size={16} /> {t('companies.users')}
        </h3>
        <button onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <UserPlus size={14} /> {t('companies.addUser')}
        </button>
      </div>

      {showAdd && (
        <AddCompanyUserForm
          companyName={company?.name ?? ''}
          form={form}
          saving={saving}
          onFormChange={setForm}
          onSubmit={handleCreate}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <CompanyUsersList
        companyId={companyId}
        refreshKey={refreshKey}
        onUserCountChange={(d) => superAdminStore.adjustUserCount(companyId, d)}
      />
    </div>
  );
});
