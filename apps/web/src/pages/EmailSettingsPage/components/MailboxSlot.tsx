import { Mail, Edit2, Unlink, RefreshCw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { Mailbox } from '../../../services/mailboxes.service';

interface Props {
  mailbox: Mailbox;
  onConnect: (provider: 'GMAIL' | 'OUTLOOK') => void;
  onEdit: (mailbox: Mailbox) => void;
  onDisconnect: (mailbox: Mailbox) => void;
  onScan: (mailbox: Mailbox) => void;
  scanning: boolean;
}

export const MailboxSlot = observer(({ mailbox, onConnect, onEdit, onDisconnect, onScan, scanning }: Props) => {
  const { t } = useTranslation('settings');
  const isConnected = mailbox.status === 'CONNECTED' && mailbox.id;

  if (!isConnected) {
    return (
      <div className="bg-base-100 rounded-xl border border-dashed border-base-300 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-base-content/40" />
          <h3 className="text-sm font-medium text-base-content/60">
            {t('mailboxes.slot', { number: mailbox.slot })}
          </h3>
        </div>
        <p className="text-sm text-base-content/60 mb-4">{t('mailboxes.notConnected')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onConnect('GMAIL')}>
            {t('mailboxes.connectGmail')}
          </Button>
          <Button variant="secondary" onClick={() => onConnect('OUTLOOK')}>
            {t('mailboxes.connectOutlook')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium">
            {t('mailboxes.slot', { number: mailbox.slot })} · {mailbox.type === 'GMAIL' ? 'Gmail' : 'Outlook'}
          </h3>
        </div>
        <span className="bg-success/15 text-success text-xs font-medium px-2 py-0.5 rounded">
          {t('mailboxes.connected')}
        </span>
      </div>
      <p className="text-sm text-base-content mb-1">{mailbox.externalId}</p>
      <p className="text-xs text-base-content/60 mb-4">
        {t('mailboxes.scanDays', { count: mailbox.scanDaysBack })}
        {mailbox.scanSent && ` · ${t('mailboxes.scansSent')}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onEdit(mailbox)}>
          <Edit2 className="w-4 h-4" />
          {t('common:edit')}
        </Button>
        <Button variant="secondary" onClick={() => onScan(mailbox)} disabled={scanning}>
          <RefreshCw className="w-4 h-4" />
          {t('mailboxes.scanNow')}
        </Button>
        <Button variant="danger" onClick={() => onDisconnect(mailbox)}>
          <Unlink className="w-4 h-4" />
          {t('common:disconnect')}
        </Button>
      </div>
    </div>
  );
});
