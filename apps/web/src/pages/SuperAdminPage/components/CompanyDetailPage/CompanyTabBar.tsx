import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Sparkles, ListTodo } from 'lucide-react';

const TABS = [
  { seg: 'overview', labelKey: 'companyDetail.tabs.overview', icon: LayoutDashboard },
  { seg: 'users', labelKey: 'companyDetail.tabs.users', icon: Users },
  { seg: 'ai', labelKey: 'companyDetail.tabs.ai', icon: Sparkles },
  { seg: 'jobs', labelKey: 'companyDetail.tabs.jobs', icon: ListTodo },
] as const;

export const CompanyTabBar = ({ companyId }: { companyId: string }) => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = `/super-admin/companies/${companyId}`;

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname.startsWith(`${base}/${tab.seg}`);
        return (
          <button
            key={tab.seg}
            onClick={() => navigate(`${base}/${tab.seg}`)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              active ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
