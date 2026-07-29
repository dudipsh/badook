import { useState } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Menu } from 'lucide-react';
import { SagurSidebar } from './SagurSidebar';
import { BadookBot } from '../chat/BadookBot';
import { ImpersonationBanner } from './ImpersonationBanner';
import { SystemMessageBanner } from './SystemMessageBanner';
import { useStores } from '../../lib/store-context';

export const SagurLayout = observer(() => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { languageStore, authStore } = useStores();

  // Platform super admins (no company, not impersonating) belong in their own
  // console — never inside the company shell.
  if (
    authStore.user &&
    authStore.isSuperAdmin &&
    !authStore.user.companyId &&
    !authStore.isImpersonating
  ) {
    return <Navigate to="/super-admin" replace />;
  }

  return (
    <div dir={languageStore.direction} className="flex flex-col h-screen bg-base-200">
      <ImpersonationBanner />
      <SystemMessageBanner />
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
      {/* Mobile Navbar */}
      <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-base-100 border-b border-base-300 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-base-200 transition-colors"
        >
          <Menu size={24} />
        </button>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logos/SagurMark.svg" alt="Sagur Logo" className="w-7 h-7 object-contain" />
          <span className="text-lg font-bold text-base-content">Sagur</span>
        </button>
      </div>

      {/* Sidebar */}
      <SagurSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden p-4 lg:p-4 ${languageStore.isRtl ? 'lg:pr-4' : 'lg:pl-4'}`}>
        <div className="w-full mx-auto flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </main>

        <BadookBot />
      </div>
    </div>
  );
});
