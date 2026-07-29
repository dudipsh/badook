import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Inbox, FileSpreadsheet } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { NavItem } from './NavItem';
import { SidebarProjectsList } from './SidebarProjectsList';
import { UserMenu } from './UserMenu';
import { SidebarLogo } from './SidebarLogo';
import { SectionLabel } from './SectionLabel';

interface SagurSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SagurSidebar = observer(({ isOpen, onClose }: SagurSidebarProps) => {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const location = useLocation();
  const { projectsStore, orphanStore, languageStore, authStore } = useStores();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Company-scoped data: only load when the user actually belongs to a company.
  // Platform super admins (companyId = null) live in their own console.
  useEffect(() => {
    if (!authStore.user?.companyId) return;
    projectsStore.fetchProjects();
    orphanStore.loadDocs();
  }, [projectsStore, orphanStore, authStore.user?.companyId]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onCloseRef.current();
  }, [location.pathname]);

  const isOverview = location.pathname === '/';
  const isReports = location.pathname.startsWith('/reports');
  const isOrphanedDocs = location.pathname.startsWith('/orphaned-docs');

  const orphanBadge = orphanStore.docs.length > 0 ? (
    <span className="badge badge-sm badge-error text-white">{orphanStore.docs.length}</span>
  ) : undefined;

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
          <SidebarLogo onClick={() => navigate('/')} />

          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
            <SectionLabel text={t('menu')} />
            <NavItem label={t('overview')} icon={<LayoutDashboard size={18} />} active={isOverview} onClick={() => navigate('/')} />
            <NavItem label={t('reports')} icon={<FileSpreadsheet size={18} />} active={isReports} onClick={() => navigate('/reports')} />

            <SectionLabel text={t('system')} className="mt-8" />
            <NavItem label={t('unlinkedDocs')} icon={<Inbox size={18} />} active={isOrphanedDocs} onClick={() => navigate('/orphaned-docs')} badge={orphanBadge} />

            <div className="mt-8">
              <SidebarProjectsList />
            </div>
          </div>

          <UserMenu />
        </aside>
      </div>
    </>
  );
});
