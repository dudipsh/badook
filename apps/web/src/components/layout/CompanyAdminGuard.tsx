import { Navigate, Outlet } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';

export const CompanyAdminGuard = observer(() => {
  const { authStore } = useStores();
  if (!authStore.user) return null;
  if (!authStore.isAdmin) return <Navigate to="/" />;
  return <Outlet />;
});
