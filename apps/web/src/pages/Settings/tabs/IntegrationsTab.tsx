import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntegrationsSubNav } from './integrations/IntegrationsSubNav';

export const IntegrationsTab = () => {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-base-200 pb-6">
        <h2 className="text-2xl font-bold text-base-content">{t('integrations.tabTitle')}</h2>
        <p className="text-sm text-base-content/60 mt-2">{t('integrations.tabSubtitle')}</p>
      </div>
      <IntegrationsSubNav />
      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
};
