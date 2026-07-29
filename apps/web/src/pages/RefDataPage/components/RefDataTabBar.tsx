import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, Truck, MapPin } from 'lucide-react';

const TABS = [
  { path: '/ref-data/products', labelKey: 'tabs.products', icon: Package },
  { path: '/ref-data/suppliers', labelKey: 'tabs.suppliers', icon: Truck },
  { path: '/ref-data/cities', labelKey: 'tabs.cities', icon: MapPin },
] as const;

export const RefDataTabBar = () => {
  const { t } = useTranslation('ref-data');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
