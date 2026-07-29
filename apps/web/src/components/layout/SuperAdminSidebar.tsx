import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Building2, Users, UserSearch, ShieldCheck,
  Sparkles, Bot, Brain, FlaskConical, Database, GraduationCap, TestTube2,
  Megaphone, LogIn, BarChart3, ListTodo, Stethoscope, Wrench,
} from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { NavItem } from './NavItem';
import { UserMenu } from './UserMenu';
import { SidebarLogo } from './SidebarLogo';
import { SectionLabel } from './SectionLabel';

interface SuperAdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const GROUPS = [
  {
    labelKey: 'superAdminGroups.management',
    items: [
      { path: '/super-admin/companies', labelKey: 'superAdminTabs.companies', icon: Building2 },
      { path: '/super-admin/users', labelKey: 'superAdminTabs.users', icon: Users },
      { path: '/super-admin/user-search', labelKey: 'superAdminTabs.userSearch', icon: UserSearch },
      { path: '/super-admin/super-admins', labelKey: 'superAdminTabs.superAdmins', icon: ShieldCheck },
    ],
  },
  {
    labelKey: 'superAdminGroups.ai',
    items: [
      { path: '/super-admin/chat-agents', labelKey: 'superAdminTabs.chatAgents', icon: Sparkles },
      { path: '/super-admin/prompts', labelKey: 'superAdminTabs.prompts', icon: Bot },
      { path: '/super-admin/feedback', labelKey: 'superAdminTabs.feedback', icon: Brain },
      { path: '/training-lab', labelKey: 'trainingLab', icon: FlaskConical },
      { path: '/ref-data', labelKey: 'refData', icon: Database },
      { path: '/super-admin/training', labelKey: 'superAdminTabs.training', icon: GraduationCap },
      { path: '/super-admin/testing', labelKey: 'superAdminTabs.testing', icon: TestTube2 },
    ],
  },
  {
    labelKey: 'superAdminGroups.monitoring',
    items: [
      { path: '/super-admin/system-messages', labelKey: 'superAdminTabs.systemMessages', icon: Megaphone },
      { path: '/super-admin/login-monitoring', labelKey: 'superAdminTabs.loginMonitoring', icon: LogIn },
      { path: '/super-admin/stats', labelKey: 'superAdminTabs.stats', icon: BarChart3 },
      { path: '/super-admin/jobs', labelKey: 'superAdminTabs.jobs', icon: ListTodo },
      { path: '/super-admin/diagnostics', labelKey: 'superAdminTabs.diagnostics', icon: Stethoscope },
      { path: '/super-admin/operations', labelKey: 'superAdminTabs.operations', icon: Wrench },
    ],
  },
] as const;

export const SuperAdminSidebar = observer(({ isOpen, onClose }: SuperAdminSidebarProps) => {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const location = useLocation();
  const { languageStore } = useStores();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onCloseRef.current();
  }, [location.pathname]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <>
      {/* Overlay – mobile only */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar wrapper */}
      <div
        className={`
          fixed top-0 ${languageStore.isRtl ? 'right-0' : 'left-0'} z-50 h-screen
          lg:static lg:z-auto
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : languageStore.isRtl ? 'translate-x-full' : '-translate-x-full'} lg:translate-x-0
          p-4 flex-shrink-0
        `}
      >
        <aside className="w-64 h-[calc(100vh-2rem)] rounded-2xl shadow-lg border border-base-300 bg-base-100 flex flex-col overflow-hidden">
          <SidebarLogo onClick={() => navigate('/super-admin')} />

          <div className="px-5 pt-4 pb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary">
              <ShieldCheck size={14} />
              {t('superAdminConsoleSubtitle')}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {GROUPS.map((group, gi) => (
              <div key={group.labelKey}>
                <SectionLabel text={t(group.labelKey)} className={gi > 0 ? 'mt-6' : ''} />
                {group.items.map((item) => (
                  <NavItem
                    key={item.path}
                    label={t(item.labelKey)}
                    icon={<item.icon size={18} />}
                    active={isActive(item.path)}
                    onClick={() => navigate(item.path)}
                  />
                ))}
              </div>
            ))}
          </div>

          <UserMenu />
        </aside>
      </div>
    </>
  );
});
