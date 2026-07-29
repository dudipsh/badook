import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Mail, MonitorSmartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../../../lib/store-context';
import { ManualUploadCard } from '../../../EmailSettingsPage/components/ManualUploadCard';
import { OcrProviderCard } from '../../../EmailSettingsPage/components/OcrProviderCard';
import { ScanActivityFeed } from '../../../EmailSettingsPage/components/ScanActivityFeed';
import { BlockedEmailRulesCard } from '../../../EmailSettingsPage/components/BlockedEmailRulesCard';
import { ScanLogsTable } from '../../../EmailSettingsPage/components/ScanLogsTable';
import { ScanDetailsModal } from '../../../EmailSettingsPage/components/ScanDetailsModal';
import type { EmailScanLog } from '../../../../services/gmail.service';
import { adminService, CompanyListItem } from '../../../../services/admin.service';

type EmailProvider = 'gmail' | 'outlook';

export const EmailOperationsSection = observer(() => {
  const { t } = useTranslation('settings');
  const { gmailStore, outlookStore, projectsStore } = useStores();
  const [provider, setProvider] = useState<EmailProvider>('gmail');
  const [selectedLog, setSelectedLog] = useState<EmailScanLog | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState<string | null>(null);

  useEffect(() => {
    void adminService.listCompanies().then(setCompanies).catch(() => {});
  }, []);

  const activeStore = provider === 'gmail' ? gmailStore : outlookStore;
  const prevScanningRef = useRef(activeStore.scanning);

  useEffect(() => {
    if (!selectedLog) return;
    const updated = activeStore.logs.find((l) => l.id === selectedLog.id);
    if (updated) setSelectedLog(updated);
  }, [activeStore.logs, selectedLog]);

  useEffect(() => {
    const wasScanning = prevScanningRef.current;
    prevScanningRef.current = activeStore.scanning;
    if (wasScanning && !activeStore.scanning) {
      projectsStore.fetchProjects();
    }
  }, [activeStore.scanning, projectsStore]);

  const handle = async (fn: () => Promise<void>, success?: string, error?: string) => {
    try { await fn(); if (success) toast.success(success); } catch (e: any) { toast.error(e?.message || error || t('common:status.failed')); }
  };

  const providerTabs: Array<{ key: EmailProvider; label: string; icon: typeof Mail }> = [
    { key: 'gmail', label: 'Gmail', icon: Mail },
    { key: 'outlook', label: 'Outlook', icon: MonitorSmartphone },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-base-content">{t('operations.emailSectionTitle')}</h3>
        <div className="flex bg-base-200 rounded-lg p-1">
          {providerTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setProvider(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                provider === key ? 'bg-white shadow text-base-content' : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <OcrProviderCard
        currentProvider={gmailStore.settings.ocrProvider}
        onChange={(p) => handle(() => gmailStore.updateOcrProvider(p), t('emailSettings.settingsSaved'), t('common:status.failed'))}
      />

      <ManualUploadCard
        scanning={activeStore.scanning}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        selectedCompanyId={targetCompanyId}
        onSelectCompany={setTargetCompanyId}
        onUpload={(files, force) => handle(() => gmailStore.uploadManualFiles(files, force, targetCompanyId), t('emailSettings.scanStarted'), t('common:status.failed'))}
      />

      <ScanActivityFeed
        logs={activeStore.scanLogs}
        scanning={activeStore.scanning}
        onClear={() => activeStore.clearScanLogs()}
      />

      <BlockedEmailRulesCard />

      <ScanLogsTable
        logs={activeStore.logs}
        loading={activeStore.loading}
        onSelectLog={setSelectedLog}
        onBlockSender={(email) => handle(
          () => gmailStore.addBlockedRule('sender', email),
          t('emailSettings.senderBlocked', { email }),
          t('emailSettings.senderBlockError'),
        )}
      />

      {selectedLog && (
        <ScanDetailsModal
          log={selectedLog}
          retrying={retrying}
          onRetry={async () => {
            setRetrying(true);
            try { await activeStore.retryScanLog(selectedLog.id); toast.success(t('emailSettings.retryStarted')); }
            catch { toast.error(t('common:status.failed')); }
            finally { setRetrying(false); }
          }}
          onDismiss={() => handle(() => activeStore.dismissScanLog(selectedLog.id), t('emailSettings.scanCancelled'), t('common:status.failed'))}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
});
