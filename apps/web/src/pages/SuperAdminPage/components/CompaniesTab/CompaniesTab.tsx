import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Building2, Plus, Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { CreateCompanyForm } from './components/CreateCompanyForm';
import { CompaniesTable } from './components/CompaniesTable';

export const CompaniesTab = observer(() => {
  const { t } = useTranslation('settings');
  const { superAdminStore } = useStores();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { superAdminStore.fetchCompanies(); }, [superAdminStore]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? superAdminStore.companies.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.businessId?.toLowerCase().includes(q) ?? false))
    : superAdminStore.companies;

  const { loading, loaded } = superAdminStore;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('companies.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => superAdminStore.fetchCompanies(true)} disabled={loading} className="text-sm text-primary hover:underline">
            {t('common:refresh')}
          </button>
          <button onClick={() => setShowCreate((s) => !s)} className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary">
            <Plus size={14} /> {t('companies.createCompany')}
          </button>
        </div>
      </div>

      {showCreate && <CreateCompanyForm onCreated={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />}

      <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('companies.search')}
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>

      {loading && !loaded ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t('companies.noCompanies')}</p>
      ) : (
        <CompaniesTable companies={filtered} />
      )}
    </div>
  );
});
