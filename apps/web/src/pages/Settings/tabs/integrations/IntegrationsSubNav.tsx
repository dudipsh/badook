import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, MessageSquare, Database } from 'lucide-react';

const SUB_TABS = [
  { path: '/settings/integrations/email', labelKey: 'integrations.emailTab', icon: Mail },
  { path: '/settings/integrations/whatsapp', labelKey: 'integrations.whatsappTab', icon: MessageSquare },
  { path: '/settings/integrations/erp', labelKey: 'integrations.erpTab', icon: Database },
] as const;

export const IntegrationsSubNav = () => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 border-b border-base-200">
      {SUB_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              isActive
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-base-content/50 hover:text-base-content/80 hover:border-base-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
