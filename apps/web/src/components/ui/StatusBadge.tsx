import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const WARN_CLS = 'bg-warning/15 text-warning';
const INFO_CLS = 'bg-info/15 text-info';
const ERROR_CLS = 'bg-error/15 text-error';
const SUCCESS_CLS = 'bg-success/15 text-success';
const NEUTRAL_CLS = 'bg-base-200 text-base-content';

const STATUS_KEY_MAP: Record<string, { labelKey: string; className: string; tooltipKey: string }> = {
  PENDING: { labelKey: 'status.pending', className: WARN_CLS, tooltipKey: 'statusTooltip.pending' },
  PARSED: { labelKey: 'status.parsed', className: INFO_CLS, tooltipKey: 'statusTooltip.parsed' },
  PARSE_FAILED: { labelKey: 'status.parseFailed', className: ERROR_CLS, tooltipKey: 'statusTooltip.parseFailed' },
  REVIEWED: { labelKey: 'status.reviewed', className: 'bg-secondary/20 text-secondary', tooltipKey: 'statusTooltip.reviewed' },
  APPROVED: { labelKey: 'status.approved', className: SUCCESS_CLS, tooltipKey: 'statusTooltip.approved' },
  REJECTED: { labelKey: 'status.rejected', className: ERROR_CLS, tooltipKey: 'statusTooltip.rejected' },
  MATCHED: { labelKey: 'status.matched', className: INFO_CLS, tooltipKey: 'statusTooltip.matched' },
  PAID: { labelKey: 'status.paid', className: NEUTRAL_CLS, tooltipKey: 'statusTooltip.paid' },
  DISPUTED: { labelKey: 'status.disputed', className: ERROR_CLS, tooltipKey: 'statusTooltip.disputed' },
  OPEN: { labelKey: 'status.open', className: INFO_CLS, tooltipKey: 'statusTooltip.open' },
  PARTIALLY_FULFILLED: { labelKey: 'status.partiallyFulfilled', className: WARN_CLS, tooltipKey: 'statusTooltip.partiallyFulfilled' },
  FULFILLED: { labelKey: 'status.fulfilled', className: SUCCESS_CLS, tooltipKey: 'statusTooltip.fulfilled' },
  CANCELLED: { labelKey: 'status.cancelled', className: NEUTRAL_CLS, tooltipKey: 'statusTooltip.cancelled' },
  PARTIAL: { labelKey: 'status.partialMatch', className: WARN_CLS, tooltipKey: 'statusTooltip.partialMatch' },
  FULL: { labelKey: 'status.fullMatch', className: SUCCESS_CLS, tooltipKey: 'statusTooltip.fullMatch' },
  DISCREPANCY: { labelKey: 'status.discrepancy', className: ERROR_CLS, tooltipKey: 'statusTooltip.discrepancy' },
  RESOLVED: { labelKey: 'status.resolved', className: SUCCESS_CLS, tooltipKey: 'statusTooltip.resolved' },
  PROCESSING: { labelKey: 'status.processing', className: INFO_CLS, tooltipKey: 'statusTooltip.processing' },
  SUCCESS: { labelKey: 'status.success', className: SUCCESS_CLS, tooltipKey: 'statusTooltip.success' },
  FAILED: { labelKey: 'status.failed', className: ERROR_CLS, tooltipKey: 'statusTooltip.failed' },
  NO_ATTACHMENTS: { labelKey: 'status.noAttachments', className: NEUTRAL_CLS, tooltipKey: 'statusTooltip.noAttachments' },
  BLOCKED: { labelKey: 'status.blocked', className: WARN_CLS, tooltipKey: 'statusTooltip.blocked' },
};

export const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation('common');
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_KEY_MAP[status];
  const label = config ? t(config.labelKey) : status;
  const tooltip = config ? t(config.tooltipKey) : '';
  const className = config?.className || 'bg-base-200 text-base-content';

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help ${className}`}
      >
        {label}
      </span>
      {showTooltip && tooltip && (
        <span className="absolute z-50 bottom-full mb-2 right-1/2 translate-x-1/2 px-3 py-2 text-xs text-neutral-content bg-neutral rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
          {tooltip}
          <span className="absolute top-full right-1/2 translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral" />
        </span>
      )}
    </span>
  );
}
