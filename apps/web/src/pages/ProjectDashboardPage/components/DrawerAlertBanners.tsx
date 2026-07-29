import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DrawerAlertBannersProps {
  hasMismatch: boolean;
  hasShortDelivery: boolean;
  hasOverDelivery: boolean;
  mismatchReason: string | null;
  remaining: number | null;
}

export const DrawerAlertBanners = ({
  hasMismatch,
  hasShortDelivery,
  hasOverDelivery,
  mismatchReason,
  remaining,
}: DrawerAlertBannersProps) => {
  const { t } = useTranslation('projects');

  return (
    <>
      {hasMismatch && (
        <div className="flex items-start gap-2.5 p-3 bg-error/10 border border-error/30 rounded-xl">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-error">{t('drawer.mismatchDetected')}</p>
            {mismatchReason && <p className="text-xs text-error/80 mt-0.5">{mismatchReason}</p>}
          </div>
        </div>
      )}
      {hasShortDelivery && (
        <div className="flex items-start gap-2.5 p-3 bg-warning/10 border border-warning/30 rounded-xl">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-warning">{t('drawer.shortDelivery')}</p>
            <p className="text-xs text-warning mt-0.5">{t('drawer.remainingUnits', { count: parseFloat((remaining ?? 0).toFixed(2)) })}</p>
          </div>
        </div>
      )}
      {hasOverDelivery && (
        <div className="flex items-start gap-2.5 p-3 bg-warning/10 border border-warning/30 rounded-xl">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-warning">{t('drawer.overDeliveryDetected')}</p>
            <p className="text-xs text-warning mt-0.5">{t('drawer.surplusUnits', { count: parseFloat(Math.abs(remaining ?? 0).toFixed(2)) })}</p>
          </div>
        </div>
      )}
    </>
  );
};
