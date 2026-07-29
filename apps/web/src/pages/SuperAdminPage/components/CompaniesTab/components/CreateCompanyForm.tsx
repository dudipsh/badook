import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../../lib/store-context';
import toast from 'react-hot-toast';

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export const CreateCompanyForm = ({ onCreated, onCancel }: Props) => {
  const { t } = useTranslation('settings');
  const { superAdminStore } = useStores();
  const [form, setForm] = useState({ name: '', email: '', businessId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await superAdminStore.createCompany({
        name: form.name,
        email: form.email || undefined,
        businessId: form.businessId || undefined,
      });
      toast.success(t('companies.companyCreated', { name: created.name }));
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.companyCreateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-1 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <h3 className="font-medium text-gray-800 text-sm">{t('companies.newCompany')}</h3>
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`${t('companies.companyName')} *`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('companies.email')} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('companies.businessId')} value={form.businessId} onChange={(e) => setForm((p) => ({ ...p, businessId: e.target.value }))} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="bg-primary text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('common:create')}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-2">{t('common:cancel')}</button>
      </div>
    </div>
  );
};
