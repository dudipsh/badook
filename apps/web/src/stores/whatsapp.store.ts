import { makeAutoObservable, runInAction } from 'mobx';
import {
  whatsappService,
  type WhatsAppSettings,
  type WhatsAppMessageLog,
  type WhatsAppAllowedPhone,
} from '../services/whatsapp.service';
import { socketService } from '../services/socket.service';

export class WhatsAppStore {
  settings: WhatsAppSettings = {
    connected: false,
    whatsappNumber: null,
    hasCredentials: false,
  };
  allowedPhones: WhatsAppAllowedPhone[] = [];
  logs: WhatsAppMessageLog[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  private listenersReady = false;

  setupListeners() {
    if (this.listenersReady) return;
    this.listenersReady = true;

    socketService.on('data:changed', (payload: { entity: string }) => {
      if (payload.entity === 'whatsappMessageLog') {
        this.fetchLogs();
      }
    });
  }

  async fetchSettings() {
    this.loading = true;
    try {
      const data = await whatsappService.getSettings();
      runInAction(() => {
        this.settings = data;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async fetchLogs() {
    this.loading = true;
    try {
      const data = await whatsappService.getLogs();
      runInAction(() => {
        this.logs = data;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async sendTest(phoneNumber?: string) {
    return whatsappService.sendTest(phoneNumber);
  }

  async fetchAllowedPhones() {
    try {
      const data = await whatsappService.getAllowedPhones();
      runInAction(() => {
        this.allowedPhones = data;
      });
    } catch (err) {
      console.error('Failed to fetch allowed phones:', err);
    }
  }

  async addAllowedPhone(phoneNumber: string, contactName?: string) {
    const phone = await whatsappService.addAllowedPhone({ phoneNumber, contactName });
    runInAction(() => {
      this.allowedPhones.unshift(phone);
    });
  }

  async updateAllowedPhone(id: string, data: { contactName?: string; isActive?: boolean }) {
    const updated = await whatsappService.updateAllowedPhone(id, data);
    runInAction(() => {
      const idx = this.allowedPhones.findIndex((p) => p.id === id);
      if (idx !== -1) this.allowedPhones[idx] = updated;
    });
  }

  async removeAllowedPhone(id: string) {
    await whatsappService.removeAllowedPhone(id);
    runInAction(() => {
      this.allowedPhones = this.allowedPhones.filter((p) => p.id !== id);
    });
  }
}
