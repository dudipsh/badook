import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Menu, ShieldCheck } from 'lucide-react';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { useStores } from '../../lib/store-context';

export const SuperAdminLayout = observer(() => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { languageStore } = useStores();

  // No ImpersonationBanner here by design: impersonation always targets a
  // non-super-admin (the API rejects impersonating a SUPER_ADMIN), so while
  // impersonating `isSuperAdmin` is false and SuperAdminGuard keeps the user in
  // the company shell (SagurLayout) — never in this console.
  return (
    <div dir={languageStore.direction} className="flex flex-col lg:flex-row h-screen bg-base-200">
      {/* Mobile Navbar */}
      <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-base-100 border-b border-base-300 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-base-200 transition-colors"
        >
          <Menu size={24} />
        </button>
        <button onClick={() => navigate('/super-admin')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ShieldCheck className="w-6 h-6 text-secondary" />
          <span className="text-lg font-bold text-base-content">Badook</span>
        </button>
      </div>

      {/* Sidebar */}
      <SuperAdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden p-4 lg:p-4 ${languageStore.isRtl ? 'lg:pr-4' : 'lg:pl-4'}`}>
        <div className="w-full mx-auto flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
});
