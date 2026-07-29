import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService, type LoginEvent } from '../../../../services/admin.service';

const PAGE_SIZE = 50;

export const LoginMonitoringTab = () => {
  const { t } = useTranslation('settings');
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminService
      .getLoginEvents(page, PAGE_SIZE)
      .then((res) => {
        setEvents(res.data);
        setTotalPages(res.totalPages || 1);
      })
      .catch(() => toast.error(t('loginMonitoring.loadError')))
      .finally(() => setLoading(false));
  }, [page, t]);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900">{t('loginMonitoring.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('loginMonitoring.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">{t('loginMonitoring.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-start ps-5 py-3">{t('loginMonitoring.time')}</th>
                  <th className="text-start py-3">{t('loginMonitoring.user')}</th>
                  <th className="text-start py-3">{t('loginMonitoring.provider')}</th>
                  <th className="text-start py-3">{t('loginMonitoring.result')}</th>
                  <th className="text-start py-3">{t('loginMonitoring.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="ps-5 py-2.5 text-gray-600 whitespace-nowrap" dir="ltr">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5">
                      <div className="text-gray-800 font-medium" dir="ltr">{e.email}</div>
                      {e.impersonatedByName && (
                        <div className="text-[11px] text-amber-600">
                          {t('loginMonitoring.viaImpersonation', { by: e.impersonatedByName })}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{e.provider}</span>
                    </td>
                    <td className="py-2.5">
                      {e.success ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700"><Check size={12} /> {t('loginMonitoring.success')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600"><X size={12} /> {t('loginMonitoring.failed')}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-500 font-mono text-xs" dir="ltr">{e.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
