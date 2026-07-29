import { useTranslation } from 'react-i18next';
import { Mail, ShieldOff, Ban } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../../lib/store-context';
import toast from 'react-hot-toast';

export const BlockedSendersTab = observer(() => {
  const { t } = useTranslation(['projects', 'settings']);
  const { gmailStore } = useStores();

  const handleUnblock = async (index: number, email: string) => {
    if (!confirm(t('settings:orphan.contextMenu.confirmUnblock', { email }))) return;
    try {
      await gmailStore.removeBlockedRule(index);
      toast.success(t('settings:orphan.unblockSuccess'));
    } catch {
      toast.error(t('settings:orphan.unblockError'));
    }
  };

  const senderRules = gmailStore.blockedRules
    .map((rule, index) => ({ ...rule, index }))
    .filter((rule) => rule.type === 'sender');

  if (senderRules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-40">
        <Ban className="w-12 h-12 mb-3" />
        <p className="font-bold text-base">{t('projects:orphan.noBlockedSenders', 'אין שולחים חסומים')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-visible flex flex-col">
      <table className="table table-sm table-pin-rows w-full text-sm">
        <thead>
          <tr className="bg-base-200/50 text-base-content/60 uppercase text-xs">
            <th className="w-[60%]">{t('projects:orphan.blockedEmail', 'אימייל חסום')}</th>
            <th className="w-[40%] text-left pl-6">{t('projects:orphan.action')}</th>
          </tr>
        </thead>
        <tbody>
          {senderRules.map(({ pattern, index }) => (
            <BlockedSenderRow
              key={index}
              email={pattern}
              onUnblock={() => handleUnblock(index, pattern)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* ── Single blocked sender row ── */
const BlockedSenderRow = ({ email, onUnblock }: { email: string; onUnblock: () => void }) => {
  const { t } = useTranslation('settings');

  return (
    <tr className="hover:bg-base-200/40 border-b border-base-100 last:border-0">
      <td className="py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-error/10 flex items-center justify-center text-error/60">
            <Mail className="w-4 h-4" />
          </div>
          <span className="font-mono text-sm">{email}</span>
        </div>
      </td>
      <td className="py-4 text-right pr-6">
        <button onClick={onUnblock} className="btn btn-ghost btn-xs gap-1 text-success hover:bg-success/10">
          <ShieldOff className="w-3.5 h-3.5" />
          {t('orphan.contextMenu.unblock', 'בטל חסימה')}
        </button>
      </td>
    </tr>
  );
};
