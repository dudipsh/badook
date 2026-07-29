import { useTranslation } from 'react-i18next';
import type { SampleStatus, DocumentType } from '@/types/sample.types';

const statusColors: Record<SampleStatus, string> = {
  PENDING: 'badge-warning',
  AUTO_EXTRACTED: 'badge-info',
  LABELED: 'badge-success',
  VERIFIED: 'badge-accent',
};

const typeColors: Record<DocumentType, string> = {
  DELIVERY_NOTE: 'badge-primary',
  INVOICE: 'badge-secondary',
  PURCHASE_ORDER: 'badge-neutral',
};

interface StatusBadgeProps {
  status: SampleStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useTranslation();
  return <span className={`badge ${statusColors[status]} badge-sm`}>{t(`status.${status}`)}</span>;
};

interface TypeBadgeProps {
  type: DocumentType;
}

export const TypeBadge = ({ type }: TypeBadgeProps) => {
  const { t } = useTranslation();
  return <span className={`badge ${typeColors[type]} badge-sm`}>{t(`documentType.${type}`)}</span>;
};
