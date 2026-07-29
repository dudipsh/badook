import { makeAutoObservable, runInAction } from 'mobx';
import { gmailService, type GmailSettings, type EmailScanLog, type LocalFolder, type BlockedEmailRule, type OcrProvider } from '../services/gmail.service';
import { socketService } from '../services/socket.service';
import i18n from '../i18n';

export type ScanLogStatus = 'working' | 'waiting' | 'done' | 'error';

export interface ScanLogEntry {
  timestamp: string;
  agent: 'scanner' | 'ocr' | 'intake' | 'extraction' | 'verification' | 'matching' | 'pipeline' | 'postScan';
  message: string;
  details?: string;
  status?: ScanLogStatus;
}

export class GmailStore {
  settings: GmailSettings = {
    scanDaysBack: 7,
    scanSent: true,
    connected: false,
    gmailEmail: null,
    connectedAt: null,
    ocrProvider: 'OPENAI',
    ocrAutoFixesEnabled: true,
  };
  logs: EmailScanLog[] = [];
  scanLogs: ScanLogEntry[] = [];
  loading = false;
  scanning = false;
  scanSource: 'gmail' | 'local' = 'gmail';
  localFolders: (LocalFolder & { selected: boolean })[] = [];
  blockedRules: BlockedEmailRule[] = [];

  constructor() {
    makeAutoObservable(this);
    const saved = localStorage.getItem('scanSource');
    if (saved === 'local' || saved === 'gmail') {
      this.scanSource = saved;
    }
    try {
      const savedLogs = localStorage.getItem('scanLogs');
      if (savedLogs) this.scanLogs = JSON.parse(savedLogs);
    } catch { /* ignore */ }
  }

  private listenersReady = false;

  setupListeners() {
    if (this.listenersReady) return;
    this.listenersReady = true;

    socketService.on('scan:started', () => {
      runInAction(() => {
        this.scanning = true;
        this.scanLogs = [];
        localStorage.setItem('scanLogs', '[]');
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
        localStorage.setItem('scanLogs', JSON.stringify(this.scanLogs));
      });
    });

    // On WebSocket reconnect, check if a scan finished while we were disconnected
    socketService.onReconnect(async () => {
      if (!this.scanning) return;
      try {
        const { scanning } = await gmailService.getScanStatus();
        if (!scanning) {
          runInAction(() => { this.scanning = false; });
          this.fetchLogs();
        }
      } catch { /* network error — will retry on next reconnect */ }
    });

    // Hydrate scan status from backend on page load / navigation
    this.checkScanStatus();
  }

  async checkScanStatus() {
    try {
      const { scanning } = await gmailService.getScanStatus();
      runInAction(() => { this.scanning = scanning; });
    } catch { /* ignore */ }
  }

  /** Logs whose createdAt falls on the current local calendar day. */
  get todayLogs(): EmailScanLog[] {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return this.logs.filter((log) => {
      const ts = log.createdAt ?? log.receivedAt;
      if (!ts) return false;
      const date = new Date(ts);
      return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
    });
  }

  async fetchSettings() {
    this.loading = true;
    try {
      const data = await gmailService.getSettings();
      runInAction(() => { this.settings = data; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async updateSettings(scanDaysBack: number, scanSent?: boolean) {
    const data = await gmailService.updateSettings({ scanDaysBack, scanSent });
    runInAction(() => { this.settings = data; });
  }

  async connectGmail() {
    const { url } = await gmailService.getAuthUrl();
    window.location.href = url;
  }

  async disconnectGmail() {
    await gmailService.disconnect();
    runInAction(() => {
      this.settings = { ...this.settings, connected: false, gmailEmail: null, connectedAt: null };
    });
  }

  async triggerScan() {
    this.scanning = true;
    try {
      await gmailService.triggerScan();
    } catch (err: any) {
      const is409 = err?.response?.status === 409;
      if (is409) {
        // Lock is held — keep scanning=true so stop button appears
        runInAction(() => { this.scanning = true; });
        throw new Error(i18n.t('settings:store.scanAlreadyActive'));
      }
      runInAction(() => { this.scanning = false; });
      throw new Error(i18n.t('settings:store.scanStartError'));
    }
  }

  async stopScan() {
    try {
      await gmailService.cancelAllJobs();
    } catch {
      // Scan may have already finished
    } finally {
      runInAction(() => { this.scanning = false; });
      this.fetchLogs();
    }
  }

  async updateOcrProvider(provider: OcrProvider) {
    const data = await gmailService.updateOcrProvider(provider);
    runInAction(() => {
      this.settings = { ...this.settings, ocrProvider: data.ocrProvider };
    });
  }

  async updateOcrAutoFixes(enabled: boolean) {
    const data = await gmailService.updateOcrAutoFixes(enabled);
    runInAction(() => {
      this.settings = { ...this.settings, ocrAutoFixesEnabled: data.ocrAutoFixesEnabled };
    });
  }

  async fetchLogs() {
    this.loading = true;
    try {
      const data = await gmailService.getLogs();
      runInAction(() => { this.logs = data; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async retryScanLog(scanLogId: string) {
    this.scanning = true;
    try {
      await gmailService.retryScanLog(scanLogId);
      runInAction(() => {
        const log = this.logs.find((l) => l.id === scanLogId);
        if (log) {
          log.status = 'PROCESSING';
          log.errorMessage = null;
        }
      });
      // scan:complete WebSocket event will reset scanning when done.
      // Safety timeout for retries (not a full scan cycle)
      setTimeout(() => {
        this.fetchLogs();
        runInAction(() => { if (this.scanning) this.scanning = false; });
      }, 30000);
    } catch {
      runInAction(() => { this.scanning = false; });
    }
  }

  async dismissScanLog(scanLogId: string) {
    await gmailService.dismissScanLog(scanLogId);
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

  async uploadManualFiles(files: File[], force: boolean, companyId?: string | null) {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (force) {
      formData.append('force', 'true');
    }
    if (companyId) {
      formData.append('companyId', companyId);
    }

    this.scanning = true;
    try {
      await gmailService.uploadManualScan(formData);
      // WebSocket scan:started / scan:complete events will manage the scanning state
    } catch {
      runInAction(() => { this.scanning = false; });
      throw new Error(i18n.t('settings:store.uploadError'));
    }
  }

  async fetchBlockedRules() {
    try {
      const { rules } = await gmailService.getBlockedRules();
      runInAction(() => { this.blockedRules = rules; });
    } catch { /* ignore */ }
  }

  async addBlockedRule(type: 'sender' | 'subject', pattern: string) {
    const { rules } = await gmailService.addBlockedRule(type, pattern);
    runInAction(() => { this.blockedRules = rules; });
  }

  async removeBlockedRule(index: number) {
    const { rules } = await gmailService.removeBlockedRule(index);
    runInAction(() => { this.blockedRules = rules; });
  }

  clearScanLogs() {
    this.scanLogs = [];
    localStorage.removeItem('scanLogs');
  }

  setScanSource(source: 'gmail' | 'local') {
    this.scanSource = source;
    localStorage.setItem('scanSource', source);
    if (source === 'local') {
      this.fetchLocalFolders();
    }
  }

  async fetchLocalFolders() {
    try {
      const folders = await gmailService.getLocalFolders();
      runInAction(() => {
        this.localFolders = folders.map((f) => ({ ...f, selected: true }));
      });
    } catch {
      runInAction(() => { this.localFolders = []; });
    }
  }

  toggleFolder(name: string) {
    const folder = this.localFolders.find((f) => f.name === name);
    if (folder) folder.selected = !folder.selected;
  }

  toggleAllFolders(selected: boolean) {
    this.localFolders.forEach((f) => { f.selected = selected; });
  }

  async triggerLocalScan() {
    const selectedFolders = this.localFolders.filter((f) => f.selected).map((f) => f.name);
    if (selectedFolders.length === 0) return;

    this.scanning = true;
    try {
      await gmailService.triggerLocalScan(selectedFolders);
    } catch {
      runInAction(() => { this.scanning = false; });
    }
  }
}
