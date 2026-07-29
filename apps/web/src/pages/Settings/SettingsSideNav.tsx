import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Plug, CreditCard, ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';

const TABS = [
  { path: '/settings/company', labelKey: 'settingsHub.tabs.company', icon: Building2, match: '/settings/company' },
  { path: '/settings/team', labelKey: 'settingsHub.tabs.team', icon: Users, match: '/settings/team' },
  { path: '/settings/integrations', labelKey: 'settingsHub.tabs.integrations', icon: Plug, match: '/settings/integrations' },
  { path: '/settings/billing', labelKey: 'settingsHub.tabs.billing', icon: CreditCard, match: '/settings/billing' },
] as const;

export const SettingsSideNav = observer(() => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-2">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.match);
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center justify-between w-full p-4 rounded-xl text-start transition-all duration-200 border ${
              active
                ? 'bg-base-100 border-primary/30 shadow-sm text-primary font-bold'
                : 'bg-transparent border-transparent text-base-content/70 hover:bg-base-300/50 hover:text-base-content font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'opacity-60'}`} />
              <span>{t(tab.labelKey)}</span>
            </span>
            <ChevronRight
              className={`w-4 h-4 rtl-flip transition-transform duration-200 ${
                active ? 'translate-x-1 opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
});
