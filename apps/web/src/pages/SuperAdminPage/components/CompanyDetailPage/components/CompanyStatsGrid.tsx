import { useTranslation } from 'react-i18next';
import type { CompanyOverview } from '../../../../../services/admin.service';

export const CompanyStatsGrid = ({ stats }: { stats: CompanyOverview }) => {
  const { t } = useTranslation('settings');

  const tiles = [
    { label: t('companies.statUsers'), value: stats.counts.users },
    { label: t('companies.statProjects'), value: stats.counts.projects },
    { label: t('companies.statDeliveryNotes'), value: stats.counts.deliveryNotes },
    { label: t('companies.statInvoices'), value: stats.counts.invoices },
    { label: t('companies.statPurchaseOrders'), value: stats.counts.purchaseOrders },
    { label: t('companies.statSuppliers'), value: stats.counts.suppliers },
    { label: t('companies.statMatches'), value: stats.counts.matches },
    { label: t('companies.statAiCalls'), value: stats.ai.calls },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-gray-900" dir="ltr">{tile.value.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">{tile.label}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {t('companies.statAiCost')}: <span dir="ltr">${stats.ai.costUsd.toFixed(2)}</span> · <span dir="ltr">{stats.ai.tokens.toLocaleString()}</span> {t('companies.statTokens')}
      </p>
    </div>
  );
};
