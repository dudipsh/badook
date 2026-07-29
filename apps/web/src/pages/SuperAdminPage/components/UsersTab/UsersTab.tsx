import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { UserPlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../../lib/store-context';
import { UsersTable } from './components/UsersTable';
import { AddUserModal } from './components/AddUserModal';
import toast from 'react-hot-toast';
import type { CreateUserPayload, UserRole } from '../../../../services/users.service';

export const UsersTab = observer(() => {
  const { t } = useTranslation('settings');
  const { usersStore } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { usersStore.fetchUsers(); }, [usersStore]);

  const handleAddUser = async (dto: CreateUserPayload) => {
    try {
      await usersStore.createUser(dto);
      toast.success(t('userManagement.userCreated'));
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('userManagement.userCreateError'));
    }
  };

  const handleToggleActive = async (id: string, currentIsActive: boolean) => {
    try {
      await usersStore.toggleActive(id, currentIsActive);
      toast.success(currentIsActive ? t('userManagement.userDisabled') : t('userManagement.userEnabled'));
    } catch {
      toast.error(t('userManagement.statusError'));
    }
  };

  const handleChangeRole = async (id: string, role: UserRole) => {
    try {
      await usersStore.changeRole(id, role);
      toast.success(t('userManagement.roleUpdated'));
    } catch {
      toast.error(t('userManagement.roleUpdateError'));
    }
  };

  if (usersStore.loading && usersStore.users.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary text-sm font-medium transition-colors">
          <UserPlus className="w-4 h-4" />
          {t('userManagement.addUser')}
        </button>
      </div>
      <UsersTable users={usersStore.users} onToggleActive={handleToggleActive} onChangeRole={handleChangeRole} />
      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddUser} />
    </div>
  );
});
