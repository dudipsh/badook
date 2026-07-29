import { useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';
import { initSocket, disconnectSocket } from '../../lib/initSocket';

export const AuthGuard = observer(() => {
  const rootStore = useStores();
  const { authStore, languageStore } = rootStore;
  const socketInitialised = useRef(false);

  useEffect(() => {
    if (authStore.isAuthenticated && !authStore.user) {
      authStore.loadProfile();
    }
  }, [authStore]);

  // WebSocket lifecycle: connect when token is available, disconnect on logout / unmount.
  // The jobs gateway scopes sockets by companyId, so super admins (no company)
  // skip socket init entirely.
  useEffect(() => {
    const token = authStore.token;
    const companyId = authStore.user?.companyId;
    if (token && companyId) {
      initSocket(rootStore, token);
      socketInitialised.current = true;
    }
    return () => {
      if (socketInitialised.current) {
        disconnectSocket();
        socketInitialised.current = false;
      }
    };
  }, [authStore.token, authStore.user?.companyId, rootStore]);

  // Sync language from user profile once loaded
  useEffect(() => {
    const lang = authStore.user?.language;
    if (lang) {
      languageStore.setFromProfile(lang);
    }
  }, [authStore.user?.language, languageStore]);

  if (!authStore.isAuthenticated) return <Navigate to="/login" />;
  return <Outlet />;
});
