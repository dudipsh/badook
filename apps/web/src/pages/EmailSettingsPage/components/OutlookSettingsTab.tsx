import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, MonitorSmartphone, Unlink, RefreshCw, Save, Square } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { Button } from '../../../components/ui/Button';
import { formatDateTime } from '../../../lib/formatters';

interface Props {
  selectedDays: number;
  onDaysChange: (days: number) => void;
  scanSent: boolean;
  onScanSentChange: (val: boolean) => void;
  onSave: () => void;
  onScan: () => void;
  onStop: () => void;
}

export const OutlookSettingsTab = observer(({ selectedDays, onDaysChange, scanSent, onScanSentChange, onSave, onScan, onStop }: Props) => {
  const { outlookStore } = useStores();
  const { t } = useTranslation('settings');
  const { connected, outlookEmail, connectedAt } = outlookStore.settings;

  const handle = async (fn: () => Promise<void>, success?: string, error?: string) => {
    const toast = (await import('react-hot-toast')).default;
    try { await fn(); if (success) toast.success(success); } catch (e: any) { toast.error(e?.message || error || t('gmail.error')); }
  };

  const SCAN_DAYS_OPTIONS = [
    { value: 1, label: t('gmail.scanDays.1') },
    { value: 3, label: t('gmail.scanDays.3') },
    { value: 7, label: t('gmail.scanDays.7') },
    { value: 14, label: t('gmail.scanDays.14') },
    { value: 30, label: t('gmail.scanDays.30') },
    { value: 60, label: t('gmail.scanDays.60') },
    { value: 90, label: t('gmail.scanDays.90') },
  ];

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <div className="bg-base-100 rounded-xl border border-base-300 p-6">
        <h3 className="text-lg font-semibold mb-4">{t('outlookConnection.title')}</h3>
        {connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-base-content">{outlookEmail}</p>
                <p className="text-sm text-base-content/50">
                  {t('outlookConnection.connectedSince')}{connectedAt ? formatDateTime(connectedAt) : ''}
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => handle(() => outlookStore.disconnectOutlook(), t('outlookConnection.disconnected'), t('outlookConnection.disconnectError'))}>
              <Unlink className="w-4 h-4" />
              {t('outlookConnection.disconnect')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-base-content/50">
              {t('outlookConnection.helperText')}
            </p>
            <Button onClick={() => handle(() => outlookStore.connectOutlook(), undefined, t('outlookConnection.connectError'))}>
              <MonitorSmartphone className="w-4 h-4" />
              {t('outlookConnection.connect')}
            </Button>
          </div>
        )}
      </div>

      {/* Scan Settings Card */}
      <div className={`bg-base-100 rounded-xl border border-base-300 p-6 ${!connected ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-lg font-semibold mb-4">{t('emailSettings.title')}</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-base-content mb-1">
              {t('gmail.scanRange')}
            </label>
            <select
              value={selectedDays}
              onChange={(e) => onDaysChange(Number(e.target.value))}
              className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm bg-base-100 focus:border-primary focus:ring-1 focus:ring-primary/40"
            >
              {SCAN_DAYS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={onSave}>
            <Save className="w-4 h-4" />
            {t('common:save')}
          </Button>
          {outlookStore.scanning ? (
            <Button variant="danger" onClick={onStop}>
              <Square className="w-4 h-4" />
              {t('gmail.stopScan')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onScan}>
              <RefreshCw className="w-4 h-4" />
              {t('gmail.scanNow')}
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={scanSent}
            onChange={(e) => onScanSentChange(e.target.checked)}
            className="w-4 h-4 rounded border-base-300 text-primary focus:ring-primary/40"
          />
          <span className="text-sm text-base-content">{t('gmail.scanAlsoSent')}</span>
        </label>
      </div>
    </div>
  );
});
