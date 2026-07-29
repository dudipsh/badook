import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, Ban } from 'lucide-react';
import { adminService, type AdminJob } from '../../../../services/admin.service';
import { CompanyJobsTable } from './components/CompanyJobsTable';
import toast from 'react-hot-toast';

export const CompanyJobsTab = () => {
  const { t } = useTranslation('nav');
  const { companyId } = useParams<{ companyId: string }>();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    if (!companyId) return;
    try {
      setJobs(await adminService.getJobs(companyId));
    } catch {
      toast.error(t('superAdminJobs.loadError'));
    }
  }, [companyId, t]);

  useEffect(() => {
    setLoading(true);
    loadJobs().finally(() => setLoading(false));
  }, [loadJobs]);

  // Auto-refresh while jobs are still running
  const hasActiveJobs = jobs.some((j) => j.status === 'PENDING' || j.status === 'RUNNING');
  useEffect(() => {
    if (hasActiveJobs) intervalRef.current = setInterval(loadJobs, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasActiveJobs, loadJobs]);

  const handleCancel = async () => {
    if (!companyId) return;
    setCancelling(true);
    try {
      const result = await adminService.cancelCompanyJobs(companyId);
      toast.success(`${result.cancelled} ${t('superAdminJobs.jobsCancelled')}`);
      await loadJobs();
    } catch {
      toast.error(t('superAdminJobs.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {hasActiveJobs ? (
          <span className="flex items-center gap-1.5 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('superAdminJobs.activeJobs')}
          </span>
        ) : <span />}
        <div className="flex items-center gap-2">
          {hasActiveJobs && (
            <button onClick={handleCancel} disabled={cancelling} className="btn btn-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 gap-1.5">
              <Ban className="w-3.5 h-3.5" /> {t('superAdminJobs.cancel')}
            </button>
          )}
          <button onClick={loadJobs} disabled={loading} className="btn btn-sm btn-outline gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('superAdminJobs.refresh')}
          </button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : jobs.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500">{t('superAdminJobs.noJobs')}</div>
      ) : (
        <CompanyJobsTable jobs={jobs} />
      )}
    </div>
  );
};
