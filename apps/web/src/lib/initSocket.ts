import { socketService } from '../services/socket.service';
import type { RootStore } from '../stores/root.store';

export const initSocket = (rootStore: RootStore, token: string) => {
  socketService.connect(token);
  rootStore.jobsStore.setupListeners();
  rootStore.gmailStore.setupListeners();
  rootStore.whatsappStore.setupListeners();
  rootStore.jobsStore.loadActive().then(() => {
    rootStore.jobsStore.cleanupStaleJobs();
  });

  socketService.on('data:changed', (payload: { entity: string; data?: any }) => {
    if (payload.entity === 'project') {
      rootStore.projectsStore.fetchProjects();
      rootStore.projectDashboardStore.invalidateAndReload(payload.data?.id);
    }
  });

  socketService.on('matching:started', (payload: { projectId?: string }) => {
    const store = rootStore.projectDashboardStore;
    if (!payload.projectId || store.projectId === payload.projectId) {
      store.setMatching(true);
    }
  });

  socketService.on('matching:complete', (payload: { projectId?: string }) => {
    const store = rootStore.projectDashboardStore;
    if (!payload.projectId || store.projectId === payload.projectId) {
      store.onMatchingComplete();
      // Clear stale processing jobs that might keep the loader modal open
      if (store.projectId) {
        rootStore.jobsStore.clearStaleProjectJobs(store.projectId);
      }
    }
    rootStore.projectsStore.fetchProjects();
  });

  socketService.on('job:complete', (data: { jobId: string }) => {
    const job = rootStore.jobsStore.activeJobs.get(data.jobId);
    if (job?.projectId && rootStore.projectDashboardStore.projectId === job.projectId) {
      rootStore.projectDashboardStore.invalidateAndReload(job.projectId);
    }
  });

  socketService.on('scan:complete', () => {
    rootStore.projectsStore.fetchProjects();
    rootStore.projectDashboardStore.invalidateAndReload();
  });

  // On reconnect, refresh active jobs to clear stale state
  socketService.onReconnect(() => {
    rootStore.jobsStore.loadActive().then(() => {
      rootStore.jobsStore.cleanupStaleJobs();
    });
  });
};

export const disconnectSocket = () => {
  socketService.disconnect();
};
