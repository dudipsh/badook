import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../../../lib/store-context';
import { EmailOperationsSection } from './EmailOperationsSection';
import { WhatsAppOperationsSection } from './WhatsAppOperationsSection';
import { CompanySettingsSection } from '../shared/CompanySettingsSection';

export const OperationsTab = observer(() => {
  const { adminStore, gmailStore, outlookStore, whatsappStore } = useStores();

  useEffect(() => {
    adminStore.fetchCompanySettings();
    gmailStore.fetchSettings();
    gmailStore.fetchLogs();
    gmailStore.fetchBlockedRules();
    outlookStore.fetchSettings();
    outlookStore.fetchLogs();
    outlookStore.setupListeners();
    whatsappStore.fetchSettings();
    whatsappStore.fetchLogs();
    whatsappStore.fetchAllowedPhones();
  }, []);

  return (
    <div className="space-y-6">
      <CompanySettingsSection
        settings={adminStore.companySettings}
        onSave={(dto) => adminStore.updateCompanySettings(dto)}
        autoFixesEnabled={gmailStore.settings.ocrAutoFixesEnabled}
        onAutoFixesChange={(enabled) => gmailStore.updateOcrAutoFixes(enabled)}
      />
      <EmailOperationsSection />
      <WhatsAppOperationsSection />
    </div>
  );
});
