import { Mail, FolderOpen } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { GmailConnectionCard } from './GmailConnectionCard';
import { ScanSettingsCard } from './ScanSettingsCard';
import { LocalFoldersCard } from './LocalFoldersCard';

interface Props {
  selectedDays: number;
  onDaysChange: (days: number) => void;
  scanSent: boolean;
  onScanSentChange: (val: boolean) => void;
  onSave: () => void;
  onScan: () => void;
  onStop: () => void;
}

export const GmailSettingsTab = observer(({ selectedDays, onDaysChange, scanSent, onScanSentChange, onSave, onScan, onStop }: Props) => {
  const { gmailStore } = useStores();
  const { t } = useTranslation('settings');
  const { connected, gmailEmail, connectedAt } = gmailStore.settings;

  const handle = async (fn: () => Promise<void>, success?: string, error?: string) => {
    const toast = (await import('react-hot-toast')).default;
    try { await fn(); if (success) toast.success(success); } catch (e: any) { toast.error(e?.message || error || t('gmail.error')); }
  };

  return (
    <>
      <div className="flex bg-base-200 rounded-lg p-1 w-fit">
        <button
          onClick={() => gmailStore.setScanSource('gmail')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            gmailStore.scanSource === 'gmail' ? 'bg-base-100 shadow text-base-content' : 'text-base-content/50 hover:text-base-content'
          }`}
        >
          <Mail className="w-4 h-4" />
          Gmail
        </button>
        <button
          onClick={() => gmailStore.setScanSource('local')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            gmailStore.scanSource === 'local' ? 'bg-base-100 shadow text-base-content' : 'text-base-content/50 hover:text-base-content'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          {t('gmail.localFolders')}
        </button>
      </div>

      {gmailStore.scanSource === 'local' && (
        <LocalFoldersCard
          folders={gmailStore.localFolders}
          scanning={gmailStore.scanning}
          onToggleFolder={(n) => gmailStore.toggleFolder(n)}
          onToggleAll={(s) => gmailStore.toggleAllFolders(s)}
          onRefresh={() => gmailStore.fetchLocalFolders()}
          onScan={() => handle(() => gmailStore.triggerLocalScan(), t('gmail.localScanStarted'), t('gmail.error'))}
        />
      )}

      <div className={gmailStore.scanSource === 'local' ? 'hidden' : 'space-y-6'}>
        <GmailConnectionCard
          connected={connected}
          gmailEmail={gmailEmail}
          connectedAt={connectedAt}
          onConnect={() => handle(() => gmailStore.connectGmail(), undefined, t('gmail.connectError'))}
          onDisconnect={() => handle(() => gmailStore.disconnectGmail(), t('gmail.gmailDisconnected'), t('gmail.disconnectError'))}
        />
        <ScanSettingsCard
          selectedDays={selectedDays}
          onDaysChange={onDaysChange}
          scanSent={scanSent}
          onScanSentChange={onScanSentChange}
          onSave={onSave}
          onScan={onScan}
          onStop={onStop}
          scanning={gmailStore.scanning}
          connected={connected}
        />
      </div>
    </>
  );
});
