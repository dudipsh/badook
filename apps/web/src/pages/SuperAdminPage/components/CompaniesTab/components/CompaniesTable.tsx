import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import type { CompanyListItem } from '../../../../../services/admin.service';
import { CompanyStatusBadge } from './CompanyStatusBadge';
import i18n from '../../../../../i18n';

export const CompaniesTable = ({ companies }: { companies: CompanyListItem[] }) => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-gray-400 border-b bg-gray-50">
            <th className="py-3 px-4 font-medium text-start">{t('companies.colName')}</th>
            <th className="py-3 px-4 font-medium text-start">{t('companies.colBusinessId')}</th>
            <th className="py-3 px-4 font-medium text-start">{t('companies.colEmail')}</th>
            <th className="py-3 px-4 font-medium text-start">{t('companies.colUsersCount')}</th>
            <th className="py-3 px-4 font-medium text-start">{t('companies.colStatus')}</th>
            <th className="py-3 px-4 font-medium text-start">{t('companies.colCreated')}</th>
            <th className="py-3 px-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((c) => (
            <tr
              key={c.id}
              onClick={() => navigate(`/super-admin/companies/${c.id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors group"
            >
              <td className="py-3 px-4 font-medium text-gray-900">{c.name}</td>
              <td className="py-3 px-4 text-gray-500">{c.businessId || '-'}</td>
              <td className="py-3 px-4 text-gray-500">{c.email || '-'}</td>
              <td className="py-3 px-4 text-gray-600">{c._count.users}</td>
              <td className="py-3 px-4"><CompanyStatusBadge status={c.status} /></td>
              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString(locale)}</td>
              <td className="py-3 px-2 text-gray-300 group-hover:text-gray-500">
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
