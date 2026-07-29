import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader2, FileClock } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { MailboxSlot } from '../../../EmailSettingsPage/components/MailboxSlot';
import { EditMailboxModal } from '../../../EmailSettingsPage/components/EditMailboxModal';
import { RecentDocumentsModal } from './RecentDocumentsModal';
import type { Mailbox } from '../../../../services/mailboxes.service';

export const EmailIntegrationTab = observer(() => {
  const { t } = useTranslation('settings');
  const { mailboxesStore, gmailStore } = useStores();
  const [editing, setEditing] = useState<Mailbox | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);

  useEffect(() => {
    mailboxesStore.fetchSlots();
    gmailStore.checkScanStatus();
    gmailStore.fetchLogs();
  }, [mailboxesStore, gmailStore]);

  const handleConnect = async (slot: number, provider: 'GMAIL' | 'OUTLOOK') => {
    try {
      if (provider === 'GMAIL') await mailboxesStore.connectGmail(slot);
      else await mailboxesStore.connectOutlook(slot);
    } catch (e: any) {
      toast.error(e?.message || t('mailboxes.error'));
    }
  };

  const handleDisconnect = async (mailbox: Mailbox) => {
    if (!mailbox.id) return;
    if (!window.confirm(t('mailboxes.confirmDisconnect'))) return;
    try {
      await mailboxesStore.disconnect(mailbox.id);
      toast.success(t('mailboxes.disconnected'));
    } catch (e: any) {
      toast.error(e?.message || t('mailboxes.error'));
    }
  };

  const handleScan = async (mailbox: Mailbox) => {
    try {
      await mailboxesStore.triggerScan(mailbox);
      toast.success(t('mailboxes.scanStarted'));
    } catch (e: any) {
      toast.error(e?.message || t('mailboxes.error'));
    }
  };

  const handleSave = async (data: { scanDaysBack: number; scanSent: boolean }) => {
    if (!editing?.id) return;
    try {
      await mailboxesStore.updateMailbox(editing.id, data);
      toast.success(t('mailboxes.saved'));
    } catch (e: any) {
      toast.error(e?.message || t('mailboxes.error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-base-content/50">{t('integrations.emailDesc')}</p>
        <button
          type="button"
          onClick={() => setRecentOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-base-content bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
        >
          <FileClock className="w-4 h-4" />
          {t('recentDocs.recentDocsButton')}
        </button>
      </div>

      {gmailStore.scanning && (
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-xl px-4 py-2 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('recentDocs.scanningNow')}
        </div>
      )}

      <div className="space-y-3">
        {mailboxesStore.slots.map((slot) => (
          <MailboxSlot
            key={slot.slot}
            mailbox={slot}
            onConnect={(p) => handleConnect(slot.slot, p)}
            onEdit={setEditing}
            onDisconnect={handleDisconnect}
            onScan={handleScan}
            scanning={gmailStore.scanning}
          />
        ))}
      </div>

      <EditMailboxModal
        mailbox={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />

      <RecentDocumentsModal open={recentOpen} onClose={() => setRecentOpen(false)} />
    </div>
  );
});
