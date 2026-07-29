import { Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { USER_ROLE_OPTIONS } from '../../../../../services/users.service';

interface Props {
  companyName: string;
  form: { name: string; email: string; role: string };
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
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm col-span-2" value={form.role} onChange={(e) => onFormChange({ ...form, role: e.target.value })}>
          {USER_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={onSubmit} disabled={saving || !form.email || !form.name} className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t('companies.createUser')}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-2">{t('common:cancel')}</button>
      </div>
    </div>
  );
};
