import { useTranslation } from 'react-i18next';
import { AlertTriangle, Eye, HelpCircle, Building2 } from 'lucide-react';
import type { OrphanReason } from '../../../types/orphan';

const ICON_CONFIG: Record<OrphanReason, { icon: typeof AlertTriangle; className: string }> = {
  MISSING_PO: { icon: AlertTriangle, className: 'badge-error badge-outline' },
  PARSING_ERROR: { icon: Eye, className: 'badge-warning badge-outline' },
  MISSING_PROJECT: { icon: HelpCircle, className: 'badge-ghost badge-outline' },
  UNKNOWN_VENDOR: { icon: Building2, className: 'badge-info badge-outline' },
};

const LABEL_KEYS: Record<OrphanReason, string> = {
  MISSING_PO: 'orphan.missingPO',
  PARSING_ERROR: 'orphan.manualTriage',
  MISSING_PROJECT: 'orphan.unknownProject',
  UNKNOWN_VENDOR: 'orphan.newSupplier',
};

export const OrphanReasonBadge = ({ reason }: { reason: OrphanReason }) => {
  const { t } = useTranslation('projects');
  const { icon: Icon, className } = ICON_CONFIG[reason];

  return (
    <span className={`badge gap-1 font-bold text-xs ${className}`}>
      <Icon className="w-3 h-3" />
      {t(LABEL_KEYS[reason])}
    </span>
  );
}
