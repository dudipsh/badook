import { useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { ArrowRight, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { CompanyTabBar } from './CompanyTabBar';
import { CompanyStatusBadge } from '../CompaniesTab/components/CompanyStatusBadge';

export const CompanyDetailPage = observer(() => {
  const { t } = useTranslation('settings');
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { superAdminStore } = useStores();

  useEffect(() => { superAdminStore.fetchCompanies(); }, [superAdminStore]);

  if (!companyId) return null;
  const company = superAdminStore.getCompany(companyId);

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/super-admin/companies')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowRight size={16} /> {t('companyDetail.backToCompanies')}
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <Building2 className="w-6 h-6 text-gray-700" />
        <h1 className="text-xl font-bold text-gray-900">{company?.name ?? '…'}</h1>
        {company && <CompanyStatusBadge status={company.status} />}
        {company?.businessId && (
          <span className="text-sm text-gray-500">{t('companies.businessId')}: {company.businessId}</span>
        )}
      </div>

      <CompanyTabBar companyId={companyId} />
      <Outlet />
    </div>
  );
});
