import { useTranslation } from 'react-i18next';
import type { CompanyListItem } from '../../../../../services/admin.service';

type Status = CompanyListItem['status'];

const STYLES: Record<Status, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
  DELETED: 'bg-red-50 text-red-700 border-red-200',
};

const LABEL_KEYS: Record<Status, string> = {
  ACTIVE: 'companies.statusActive',
  SUSPENDED: 'companies.statusSuspended',
  DELETED: 'companies.statusDeleted',
};

export const CompanyStatusBadge = ({ status }: { status: Status }) => {
  const { t } = useTranslation('settings');
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STYLES[status]}`}>
      {t(LABEL_KEYS[status])}
    </span>
  );
};
