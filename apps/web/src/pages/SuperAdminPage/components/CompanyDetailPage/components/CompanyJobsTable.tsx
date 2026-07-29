import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { AdminJob } from '../../../../../services/admin.service';
import { StatusBadge } from '../../JobStatusBadge';
import { StageBadge } from '../../JobStageBadge';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return time;
  return `${d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} ${time}`;
};

export const CompanyJobsTable = ({ jobs }: { jobs: AdminJob[] }) => {
  const { t } = useTranslation('nav');

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-xs text-gray-400 border-b bg-gray-50">
              <th className="py-3 px-4">{t('superAdminJobs.fileName')}</th>
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
                <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate" title={job.fileName}>{job.fileName}</td>
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
  );
};
