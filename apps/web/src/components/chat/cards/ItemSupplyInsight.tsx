import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ItemSupplyPriceInsight } from '../../../services/chat.service';
import { formatCurrency } from '../../../lib/currencyUtils';

interface Props {
  insight: ItemSupplyPriceInsight;
}

export const ItemSupplyInsight = ({ insight }: Props) => {
  const { t } = useTranslation('chat');

  if (insight.kind === 'stable') {
    return (
      <div className="mt-3 rounded-xl bg-success/10 border border-success/20 px-3 py-2.5 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
        <p className="text-[14px] leading-relaxed text-base-content/80">
          {t('cards.itemSupply.insightStable', {
            price: insight.avgUnitPrice != null ? formatCurrency(insight.avgUnitPrice) : '',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-warning/10 border border-warning/20 px-3 py-2.5 flex items-start gap-2.5">
      <TriangleAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" />
      <div className="text-[14px] leading-relaxed text-base-content/80">
        <p className="font-bold text-base-content mb-0.5">{t('cards.itemSupply.insightTitle')}</p>
        <p>
          {t('cards.itemSupply.insightVariance', {
            pct: insight.variancePct ?? 0,
            doc: insight.docNumber ?? '',
            supplier: insight.supplierName ?? '',
            price: insight.outlierUnitPrice != null ? formatCurrency(insight.outlierUnitPrice) : '',
            avg: insight.avgUnitPrice != null ? formatCurrency(insight.avgUnitPrice) : '',
            impact: insight.estBudgetImpact != null ? formatCurrency(insight.estBudgetImpact) : '',
          })}
        </p>
      </div>
    </div>
  );
};
