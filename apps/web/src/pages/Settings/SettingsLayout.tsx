import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { SettingsSideNav } from './SettingsSideNav';

export const SettingsLayout = () => {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-base-300">
        <div>
          <h1 className="text-xl font-bold text-base-content">{t('settingsHub.title')}</h1>
          <p className="text-sm text-base-content/60 mt-1">{t('settingsHub.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-outline btn-sm">
            {t('settingsHub.cancelChanges')}
          </button>
          <button className="btn btn-primary btn-sm shadow-md shadow-primary/20">
            <Save className="w-4 h-4" />
            {t('settingsHub.saveSettings')}
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 mt-6 min-h-0">
        <aside className="w-64 shrink-0 overflow-y-auto">
          <SettingsSideNav />
        </aside>
        <main className="flex-1 min-w-0 bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
