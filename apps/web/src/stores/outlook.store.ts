import { makeAutoObservable, runInAction } from 'mobx';
import { outlookService, type OutlookSettings } from '../services/outlook.service';
import { socketService } from '../services/socket.service';
import type { EmailScanLog } from '../services/gmail.service';
import type { ScanLogEntry } from './gmail.store';
import i18n from '../i18n';

export class OutlookStore {
  settings: OutlookSettings = {
    scanDaysBack: 7,
    scanSent: true,
    connected: false,
    outlookEmail: null,
    connectedAt: null,
    ocrProvider: 'GEMINI',
    ocrAutoFixesEnabled: true,
  };
  logs: EmailScanLog[] = [];
  scanLogs: ScanLogEntry[] = [];
  loading = false;
  scanning = false;

  constructor() {
    makeAutoObservable(this);
  }

  private listenersReady = false;

  setupListeners() {
    if (this.listenersReady) return;
    this.listenersReady = true;

    socketService.on('scan:started', () => {
      runInAction(() => {
        this.scanning = true;
        this.scanLogs = [];
      });
    });

    socketService.on('scan:complete', () => {
      runInAction(() => { this.scanning = false; });
      this.fetchLogs();
    });

    socketService.on('data:changed', (payload: { entity: string }) => {
      if (payload.entity === 'emailScanLog') {
        this.fetchLogs();
      }
    });

    socketService.on('scan:log', (entry: ScanLogEntry) => {
      runInAction(() => {
        this.scanLogs.push(entry);
        if (this.scanLogs.length > 200) {
          this.scanLogs = this.scanLogs.slice(-200);
        }
      });
    });

    socketService.onReconnect(async () => {
      if (!this.scanning) return;
      try {
        const { scanning } = await outlookService.getScanStatus();
        if (!scanning) {
          runInAction(() => { this.scanning = false; });
          this.fetchLogs();
        }
      } catch { /* network error */ }
    });

    this.checkScanStatus();
  }

  private async checkScanStatus() {
    try {
      const { scanning } = await outlookService.getScanStatus();
      runInAction(() => { this.scanning = scanning; });
    } catch { /* ignore */ }
  }

  async fetchSettings() {
    this.loading = true;
    try {
      const data = await outlookService.getSettings();
      runInAction(() => { this.settings = data; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async updateSettings(scanDaysBack: number, scanSent?: boolean) {
    const data = await outlookService.updateSettings({ scanDaysBack, scanSent });
    runInAction(() => { this.settings = { ...this.settings, ...data }; });
  }

  async connectOutlook() {
    const { url } = await outlookService.getAuthUrl();
    window.location.href = url;
  }

  async disconnectOutlook() {
    await outlookService.disconnect();
    runInAction(() => {
      this.settings = { ...this.settings, connected: false, outlookEmail: null, connectedAt: null };
    });
  }

  async triggerScan() {
    this.scanning = true;
    try {
      await outlookService.triggerScan();
    } catch (err: any) {
      const is409 = err?.response?.status === 409;
      if (is409) {
        runInAction(() => { this.scanning = true; });
        throw new Error(i18n.t('settings:store.scanAlreadyActive'));
      }
      runInAction(() => { this.scanning = false; });
      throw new Error(i18n.t('settings:store.scanStartError'));
    }
  }

  async stopScan() {
    try {
      await outlookService.cancelAllJobs();
    } catch {
      // Scan may have already finished
    } finally {
      runInAction(() => { this.scanning = false; });
      this.fetchLogs();
    }
  }

  async fetchLogs() {
    this.loading = true;
    try {
      const data = await outlookService.getLogs();
      runInAction(() => { this.logs = data; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async retryScanLog(scanLogId: string) {
    this.scanning = true;
    try {
      await outlookService.retryScanLog(scanLogId);
      runInAction(() => {
        const log = this.logs.find((l) => l.id === scanLogId);
        if (log) {
          log.status = 'PROCESSING';
          log.errorMessage = null;
        }
      });
      setTimeout(() => {
        this.fetchLogs();
        runInAction(() => { if (this.scanning) this.scanning = false; });
      }, 30000);
    } catch {
      runInAction(() => { this.scanning = false; });
    }
  }

  async dismissScanLog(scanLogId: string) {
    await outlookService.dismissScanLog(scanLogId);
    runInAction(() => {
      const log = this.logs.find((l) => l.id === scanLogId);
      if (log) {
        log.status = 'FAILED';
        const cancelled = i18n.t('settings:store.cancelledManually');
        log.errorMessage = (log.errorMessage ? `${log.errorMessage} (${cancelled})` : cancelled);
      }
      this.scanning = false;
    });
  }

  clearScanLogs() {
    this.scanLogs = [];
  }
}
