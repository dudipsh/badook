import { useTranslation } from 'react-i18next';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import type { User, UserRole } from '../../../../../services/users.service';
import { USER_ROLE_OPTIONS } from '../../../../../services/users.service';
import i18n from '../../../../../i18n';

interface UsersTableProps {
  users: User[];
  onToggleActive: (id: string, currentIsActive: boolean) => void;
  onChangeRole: (id: string, role: UserRole) => void;
}

const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  SUPER_ADMIN: 'common:roles.superAdmin',
  ADMIN: 'common:roles.admin',
  ACCOUNTANT: 'common:roles.accountant',
  FIELD_WORKER: 'common:roles.fieldWorker',
  CONTRACTOR: 'common:roles.contractor',
};

export const UsersTable = ({
  users,
  onToggleActive,
  onChangeRole,
}: UsersTableProps) => {
  const { t } = useTranslation('settings');

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
        {t('users.noUsers')}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-500 text-right">
              <th className="py-3 px-4 font-medium">{t('users.name')}</th>
              <th className="py-3 px-4 font-medium">{t('users.email')}</th>
              <th className="py-3 px-4 font-medium">{t('users.role')}</th>
              <th className="py-3 px-4 font-medium">{t('users.status')}</th>
              <th className="py-3 px-4 font-medium">{t('users.joinDate')}</th>
              <th className="py-3 px-4 font-medium">{t('users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b last:border-0 hover:bg-gray-50"
              >
                <td className="py-3 px-4 font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="py-3 px-4 text-gray-600" dir="ltr">
                  {user.email}
                </td>
                <td className="py-3 px-4">
                  {user.role === 'SUPER_ADMIN' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {t(ROLE_LABEL_KEYS[user.role])}
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) =>
                        onChangeRole(user.id, e.target.value as UserRole)
                      }
                      className="border rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/300"
                    >
                      {USER_ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {t(r.labelKey)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.isActive ? t('common:status.active') : t('common:status.disabled')}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">
                  {new Date(user.createdAt).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}
                </td>
                <td className="py-3 px-4">
                  {user.role !== 'SUPER_ADMIN' && (
                    <button
                      onClick={() => onToggleActive(user.id, user.isActive)}
                      title={user.isActive ? t('users.disableUser') : t('users.enableUser')}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      {user.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
