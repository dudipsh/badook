import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { MatchingPhaseDisplay } from './MatchingPhaseDisplay';

const RemotionLoaderPlayer = lazy(() => import('./RemotionLoaderPlayer'));

export const MatchingLoaderModal = observer(() => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore, jobsStore } = useStores();
  const projectId = projectDashboardStore.projectId;

  const activeJobs = projectId ? jobsStore.getJobsForProject(projectId) : [];
  const processingJobs = activeJobs.filter((j) => j.status === 'PENDING' || j.status === 'RUNNING');
  const isOpen = projectDashboardStore.matching || processingJobs.length > 0;

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const phases = [
    t('loader.ingestingDocs'),
    t('loader.isolatingDiscrepancies'),
    t('loader.executingProtocols'),
    t('loader.reconcilingLedgers'),
  ];

  const dismiss = useCallback(() => {
    if (projectId) jobsStore.clearStaleProjectJobs(projectId);
    projectDashboardStore.setMatching(false);
  }, [projectId, jobsStore, projectDashboardStore]);

  useEffect(() => {
    if (!isOpen) { setPhaseIndex(0); return; }
    const interval = setInterval(() => { setPhaseIndex((prev) => (prev + 1) % phases.length); }, 1200);
    return () => clearInterval(interval);
  }, [isOpen, phases.length]);

  useEffect(() => {
    if (!isOpen) { setDisplayProgress(0); return; }
    const duration = 2800;
    const start = Date.now();
    let raf: number;
    const animate = () => {
      const elapsed = Date.now() - start;
      if (elapsed < duration) {
        const t = elapsed / duration;
        setDisplayProgress(Math.floor(Math.sin((t * Math.PI) / 2) * 100));
        raf = requestAnimationFrame(animate);
      } else { setDisplayProgress(100); }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Safety: auto-dismiss after 60 seconds to prevent permanently stuck modal
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(dismiss, 60_000);
    return () => clearTimeout(timeout);
  }, [isOpen, dismiss]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-base-300/80 backdrop-blur-md cursor-pointer" onClick={dismiss}>
      <div className="bg-base-100 rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full p-8 flex flex-col items-center cursor-default matching-loader-scale-in" onClick={(e) => e.stopPropagation()}>
        <div dir="ltr" className="w-[480px] h-[270px] mb-8 relative overflow-hidden flex items-center justify-center bg-base-100 rounded-2xl shadow-inner">
          <Suspense fallback={<div className="loading loading-spinner text-[var(--color-primary)] opacity-50" />}>
            <RemotionLoaderPlayer />
          </Suspense>
        </div>
        <MatchingPhaseDisplay phases={phases} phaseIndex={phaseIndex} displayProgress={displayProgress} />
      </div>
    </div>
  );
});
