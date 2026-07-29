import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService, type GlobalUser } from '../../../../services/admin.service';
import { useStores } from '../../../../lib/store-context';

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

export const UserSearchTab = () => {
  const { t } = useTranslation('settings');
  const { authStore } = useStores();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Debounced search across all companies.
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      adminService
        .searchUsers(query.trim())
        .then(setUsers)
        .catch(() => toast.error(t('userSearch.loadError')))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, t]);

  const handleImpersonate = async (userId: string) => {
    setImpersonatingId(userId);
    try {
      await authStore.impersonate(userId);
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.impersonateError'));
      setImpersonatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900">{t('userSearch.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('userSearch.subtitle')}</p>
      </div>

      <div className="relative w-full sm:w-96">
        <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoFocus
          placeholder={t('userSearch.placeholder')}
          className="w-full border border-gray-300 rounded-lg ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          dir="auto"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">{t('userSearch.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-start ps-5 py-3">{t('userSearch.name')}</th>
                  <th className="text-start py-3">{t('userSearch.email')}</th>
                  <th className="text-start py-3">{t('userSearch.role')}</th>
                  <th className="text-start py-3">{t('userSearch.company')}</th>
                  <th className="text-start py-3">{t('userSearch.status')}</th>
                  <th className="w-32 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const canImpersonate = u.id !== authStore.user?.id && !!u.companyId && u.isActive;
                  return (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="ps-5 py-2.5 font-medium text-gray-800">{u.name}</td>
                      <td className="py-2.5 text-gray-600 font-mono text-xs" dir="ltr">{u.email}</td>
                      <td className="py-2.5">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t(`common:roles.${roleKeyFor(u.role)}`)}</span>
                      </td>
                      <td className="py-2.5 text-gray-600">{u.company?.name || <span className="text-gray-400">{t('userSearch.noCompany')}</span>}</td>
                      <td className="py-2.5">
                        {u.isActive ? (
                          <span className="text-xs text-green-700">{t('userSearch.active')}</span>
                        ) : (
                          <span className="text-xs text-gray-400">{t('userSearch.inactive')}</span>
                        )}
                      </td>
                      <td className="py-2.5 pe-5 text-end">
                        {canImpersonate && (
                          <button
                            onClick={() => handleImpersonate(u.id)}
                            disabled={impersonatingId === u.id}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 disabled:opacity-50"
                          >
                            {impersonatingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserCog size={12} />}
                            {t('common:impersonate')}
                          </button>
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
};
