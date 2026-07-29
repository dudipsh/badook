import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { Mailbox } from '../../../services/mailboxes.service';

interface Props {
  mailbox: Mailbox | null;
  onClose: () => void;
  onSave: (data: { scanDaysBack: number; scanSent: boolean }) => Promise<void>;
}

const SCAN_DAYS_OPTIONS = [1, 3, 7, 14, 30, 60, 90];

export const EditMailboxModal = ({ mailbox, onClose, onSave }: Props) => {
  const { t } = useTranslation('settings');
  const [days, setDays] = useState(7);
  const [scanSent, setScanSent] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mailbox) {
      setDays(mailbox.scanDaysBack);
      setScanSent(mailbox.scanSent);
    }
  }, [mailbox]);

  if (!mailbox) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ scanDaysBack: days, scanSent });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('mailboxes.editTitle')}</h2>
          <button onClick={onClose} className="text-base-content/60 hover:text-base-content">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('mailboxes.email')}</label>
            <input
              type="text"
              value={mailbox.externalId || ''}
              disabled
              className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm bg-base-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('mailboxes.provider')}</label>
            <input
              type="text"
              value={mailbox.type === 'GMAIL' ? 'Gmail' : 'Outlook'}
              disabled
              className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm bg-base-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('mailboxes.scanRange')}</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm bg-base-100"
            >
              {SCAN_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t('mailboxes.daysOption', { count: d })}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanSent}
              onChange={(e) => setScanSent(e.target.checked)}
              className="w-4 h-4 rounded border-base-300"
            />
            <span className="text-sm">{t('mailboxes.scanSent')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t('common:save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
