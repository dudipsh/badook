import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, AlertTriangle, Ban } from 'lucide-react';
import { adminService, type AdminJob, type CompanyListItem } from '../../../services/admin.service';
import toast from 'react-hot-toast';
import { StatusBadge } from './JobStatusBadge';
import { StageBadge } from './JobStageBadge';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(iso);
};

export const JobsTab = () => {
  const { t } = useTranslation('nav');
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const result = await adminService.getJobs(selectedCompanyId || undefined);
      setJobs(result);
    } catch {
      toast.error(t('superAdminJobs.loadError'));
    }
  }, [selectedCompanyId, t]);

  const loadCompanies = async () => {
    try {
      const result = await adminService.listCompanies();
      setCompanies(result);
    } catch {
      // Non-critical — selector will just be empty
    }
  };

  const handleCancel = async (companyId: string, companyName: string) => {
    setCancelling(true);
    try {
      const result = await adminService.cancelCompanyJobs(companyId);
      toast.success(`${result.cancelled} ${t('superAdminJobs.jobsCancelled')} (${companyName})`);
      await loadJobs();
    } catch {
      toast.error(t('superAdminJobs.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadJobs().finally(() => setLoading(false));
  }, [loadJobs]);

  // Auto-refresh when there are active jobs
  const hasActiveJobs = jobs.some((j) => j.status === 'PENDING' || j.status === 'RUNNING');
  useEffect(() => {
    if (hasActiveJobs) {
      intervalRef.current = setInterval(loadJobs, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasActiveJobs, loadJobs]);

  const activeCompanyIds = [...new Set(jobs.filter((j) => j.status === 'PENDING' || j.status === 'RUNNING').map((j) => j.companyId))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/300 focus:border-primary/200"
          >
            <option value="">{t('superAdminJobs.allCompanies')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {hasActiveJobs && (
            <span className="flex items-center gap-1.5 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              {activeCompanyIds.length} {t('superAdminJobs.activeJobs')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCompanyIds.length > 0 && (
            <div className="flex gap-1">
              {activeCompanyIds.map((cId) => {
                const companyName = jobs.find((j) => j.companyId === cId)?.company.name ?? cId;
                return (
                  <button
                    key={cId}
                    onClick={() => handleCancel(cId, companyName)}
                    disabled={cancelling}
                    className="btn btn-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {t('superAdminJobs.cancel')} ({companyName})
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={loadJobs} disabled={loading} className="btn btn-sm btn-outline gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('superAdminJobs.refresh')}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          {t('superAdminJobs.noJobs')}
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-gray-400 border-b bg-gray-50">
                  <th className="py-3 px-4">{t('superAdminJobs.fileName')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.company')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.status')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.stage')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.docType')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.error')}</th>
                  <th className="py-3 px-4">{t('superAdminJobs.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className={job.status === 'FAILED' ? 'bg-red-50/30' : ''}>
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate" title={job.fileName}>
                      {job.fileName}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{job.company.name}</td>
                    <td className="py-3 px-4"><StatusBadge status={job.status} /></td>
                    <td className="py-3 px-4"><StageBadge stage={job.stage} stageStatus={job.stageStatus} /></td>
                    <td className="py-3 px-4 text-gray-600">{job.documentType ?? '-'}</td>
                    <td className="py-3 px-4 max-w-[250px]">
                      {job.errorMessage ? (
                        <span className="flex items-start gap-1 text-red-600 text-xs" title={job.errorMessage}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="truncate">{job.errorMessage}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
