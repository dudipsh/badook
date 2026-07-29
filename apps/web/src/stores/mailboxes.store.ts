import { makeAutoObservable, runInAction } from 'mobx';
import { mailboxesService, type Mailbox } from '../services/mailboxes.service';

export class MailboxesStore {
  slots: Mailbox[] = [];
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchSlots() {
    this.loading = true;
    try {
      const data = await mailboxesService.list();
      runInAction(() => {
        this.slots = data.slots;
        this.error = null;
      });
    } catch (e: any) {
      runInAction(() => { this.error = e?.message || 'Failed to load'; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async connectGmail(slot: number) {
    const { url } = await mailboxesService.getGmailAuthUrl(slot);
    window.location.href = url;
  }

  async connectOutlook(slot: number) {
    const { url } = await mailboxesService.getOutlookAuthUrl(slot);
    window.location.href = url;
  }

  async updateMailbox(id: string, data: { scanDaysBack?: number; scanSent?: boolean }) {
    await mailboxesService.update(id, data);
    await this.fetchSlots();
  }

  async disconnect(id: string) {
    await mailboxesService.disconnect(id);
    await this.fetchSlots();
  }

  async triggerScan(mailbox: Mailbox) {
    if (!mailbox.id) return;
    if (mailbox.type === 'GMAIL') await mailboxesService.triggerGmailScan(mailbox.id);
    else if (mailbox.type === 'OUTLOOK') await mailboxesService.triggerOutlookScan(mailbox.id);
  }
}
