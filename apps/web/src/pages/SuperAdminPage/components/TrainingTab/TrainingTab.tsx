import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import toast from 'react-hot-toast';
import { Brain, Play, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { trainingApi, type TrainingJob } from './api';

const ACTIVE_STATUSES = new Set<TrainingJob['status']>(['PENDING', 'EXPORTING', 'TRAINING']);

const statusColor = (s: TrainingJob['status']): string => {
  switch (s) {
    case 'PENDING':   return 'badge-ghost';
    case 'EXPORTING': return 'badge-info';
    case 'TRAINING':  return 'badge-warning';
    case 'SUCCEEDED': return 'badge-success';
    case 'FAILED':    return 'badge-error';
  }
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('he-IL');
};

const vertexConsoleUrl = (jobName: string | null): string | null => {
  if (!jobName) return null;
  const project = jobName.match(/projects\/([^/]+)/)?.[1];
  if (!project) return null;
  return `https://console.cloud.google.com/vertex-ai/generative/language/tuning?project=${project}`;
};

export const TrainingTab = observer(() => {
  const { t } = useTranslation('nav');
  const { authStore } = useStores();
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await trainingApi.list());
    } catch (e) {
      toast.error(t('training.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while there's an active job
  useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    if (!hasActive) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [jobs, load]);

  const activeJob = jobs.find((j) => ACTIVE_STATUSES.has(j.status));

  const handleStart = async () => {
    if (!confirm(t('training.startConfirm'))) return;
    setStarting(true);
    try {
      await trainingApi.start(authStore.user?.email);
      toast.success(t('training.started'));
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message || t('training.startError');
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Brain className="w-7 h-7 text-purple-600 mt-1" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('training.title')}</h2>
            <p className="text-sm text-gray-500 max-w-2xl">{t('training.description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="btn btn-ghost btn-sm gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('training.refresh')}
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !!activeJob}
            className="btn btn-primary btn-sm gap-1"
          >
            <Play className="w-4 h-4" />
            {starting ? t('training.starting') : t('training.startButton')}
          </button>
        </div>
      </div>

      {activeJob && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
            <span className="font-medium text-amber-900">
              {t('training.activeBanner', { status: t(`training.status.${activeJob.status}`) })}
            </span>
          </div>
          <div className="text-sm text-amber-800">
            {activeJob.sampleCount != null && (
              <span>{t('training.sampleCount', { n: activeJob.sampleCount })} · </span>
            )}
            <span>{t('training.startedAt', { time: formatDateTime(activeJob.createdAt) })}</span>
            {activeJob.vertexJobName && vertexConsoleUrl(activeJob.vertexJobName) && (
              <>
                {' · '}
                <a
                  href={vertexConsoleUrl(activeJob.vertexJobName)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  {t('training.vertexConsole')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500">
                <th className="py-3 px-4 text-start font-medium">{t('training.col.status')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.startedAt')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.startedBy')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.samples')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.epochs')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.completedAt')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('training.col.tunedModel')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && jobs.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">{t('training.loading')}</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">{t('training.empty')}</td></tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="border-b hover:bg-gray-50 transition-colors align-top">
                    <td className="py-2.5 px-4">
                      <span className={`badge badge-sm ${statusColor(j.status)}`}>
                        {t(`training.status.${j.status}`)}
                      </span>
                      {j.error && (
                        <div className="mt-1 flex items-start gap-1 text-xs text-red-600 max-w-xs">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{j.error}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">{formatDateTime(j.createdAt)}</td>
                    <td className="py-2.5 px-4 text-gray-600">{j.startedBy || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-700">{j.sampleCount ?? '—'}</td>
                    <td className="py-2.5 px-4 text-gray-700">{j.epochs}</td>
                    <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">{formatDateTime(j.completedAt)}</td>
                    <td className="py-2.5 px-4 text-gray-700 max-w-xs">
                      {j.tunedModelEndpoint ? (
                        <code className="text-xs break-all">{j.tunedModelEndpoint}</code>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
