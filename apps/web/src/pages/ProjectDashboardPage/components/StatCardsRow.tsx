import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../lib/currencyUtils';
import type { ProjectStats } from '../../../types/reconciliation';

interface StatCardsRowProps {
  stats: ProjectStats | null;
  loading?: boolean;
}

export const StatCardsRow = ({ stats, loading }: StatCardsRowProps) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-base-100 rounded-xl border border-base-300 shadow-sm p-4 h-24 animate-pulse">
            <div className="h-2.5 bg-base-200 rounded w-16 mb-3" />
            <div className="h-7 bg-base-200 rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  const { t } = useTranslation('projects');

  const percentage = stats.reconciliationPercentage;

  const reconciliationColor =
    percentage >= 80 ? 'text-success' :
      percentage >= 50 ? 'text-warning' : 'text-error';

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
      {/* Reconciliation */}
      <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm p-4 h-24 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between opacity-60 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider">{t('stats.reconciliation')}</span>
          <CheckCircle2 size={16} className="text-success" />
        </div>
        <span className={`text-2xl font-bold font-mono tabular-nums ${reconciliationColor}`}>
          {Math.round(percentage)}%
        </span>
        <progress className="progress progress-success w-full h-1 mt-2" value={percentage} max="100" />
      </div>

      {/* Total Ordered */}
      <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm p-4 h-24 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between opacity-60 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider">{t('stats.totalOrdered')}</span>
          <FileText size={16} className="text-primary" />
        </div>
        <span className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(stats.purchaseOrderAmount, stats.currency)}</span>
        <p className="text-xs opacity-60 mt-0.5">{stats.purchaseOrderCount} {t('header.purchaseOrders')}</p>
      </div>

      {/* Total Invoiced */}
      <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm p-4 h-24 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between opacity-60 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider">{t('stats.totalInvoiced')}</span>
          <TrendingUp size={16} className="text-error" />
        </div>
        <span className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(stats.invoiceAmount, stats.currency)}</span>
        <p className="text-xs opacity-60 mt-0.5">{stats.invoiceCount} {t('header.invoices')}</p>
      </div>

      {/* Delivery Notes */}
      <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm p-4 h-24 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between opacity-60 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider">{t('stats.deliveryNotes')}</span>
          <FileText size={16} className="text-warning" />
        </div>
        <span className="text-2xl font-bold font-mono tabular-nums text-warning">{stats.deliveryCertCount}</span>
        <p className="text-xs opacity-60 mt-0.5">{t('stats.receivedOnSite')}</p>
      </div>
    </div>
  );
}
