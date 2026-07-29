import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { RefDataTabBar } from './components/RefDataTabBar';
import { RefDataStats } from './components/RefDataStats';

export const RefDataPage = () => {
  const { t } = useTranslation('ref-data');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-7 h-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('description')}</p>
        </div>
      </div>
      <RefDataStats />
      <RefDataTabBar />
      <Outlet />
    </div>
  );
};
