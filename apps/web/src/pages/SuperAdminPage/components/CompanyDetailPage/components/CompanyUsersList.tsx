import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyUser } from '../../../../../services/admin.service';
import { CompanyUserRow } from './CompanyUserRow';
import toast from 'react-hot-toast';

interface Props {
  companyId: string;
  refreshKey: number;
  onUserCountChange: (delta: number) => void;
}

export const CompanyUsersList = ({ companyId, refreshKey, onUserCountChange }: Props) => {
  const { t } = useTranslation('settings');
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminService.listCompanyUsers(companyId)
      .then((data) => setUsers(data))
      .catch(() => toast.error(t('companies.usersLoadError')))
      .finally(() => setLoading(false));
  }, [companyId, refreshKey, t]);

  const handleUserUpdated = (updated: CompanyUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleUserDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    onUserCountChange(-1);
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>;
  }

  if (users.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">{t('companies.noUsersInCompany')}</p>;
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <CompanyUserRow key={user.id} user={user} companyId={companyId} onUserUpdated={handleUserUpdated} onUserDeleted={handleUserDeleted} />
      ))}
    </div>
  );
};
