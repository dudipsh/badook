import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Loader2 } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { SystemStatsGrid } from './shared/SystemStatsGrid';
import { AIUsageSection } from './shared/AIUsageSection';
import { CompanySettingsSection } from './shared/CompanySettingsSection';

export const StatsTab = observer(() => {
  const { adminStore, gmailStore } = useStores();

  useEffect(() => {
    adminStore.fetchAll();
    gmailStore.fetchSettings();
  }, [adminStore, gmailStore]);

  if (adminStore.loading && !adminStore.systemStats) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SystemStatsGrid stats={adminStore.systemStats} />
      <AIUsageSection usageStats={adminStore.usageStats} />
      <CompanySettingsSection
        settings={adminStore.companySettings}
        onSave={(dto) => adminStore.updateCompanySettings(dto)}
        autoFixesEnabled={gmailStore.settings.ocrAutoFixesEnabled}
        onAutoFixesChange={(enabled) => gmailStore.updateOcrAutoFixes(enabled)}
      />
    </div>
  );
});
