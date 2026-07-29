import { useTranslation } from 'react-i18next';
import { formatNumber } from './po-utils';

interface POFinancialSummaryProps {
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  vatRate?: number;
}

export const POFinancialSummary = ({ subtotal, vatAmount, grandTotal, vatRate = 18 }: POFinancialSummaryProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="bg-base-200 rounded-lg border border-base-300 p-4 space-y-2">
      <div className="flex justify-between text-sm text-base-content/60">
        <span>{t('createPO.subtotal')}</span>
        <span>{formatNumber(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm text-base-content/60">
        <span>{t('createPO.vat', { rate: vatRate })}</span>
        <span>{formatNumber(vatAmount)}</span>
      </div>
      <div className="border-t border-base-300 my-2" />
      <div className="flex justify-between text-base font-bold text-base-content pt-2">
        <span>{t('createPO.totalPayment')}</span>
        <span>{formatNumber(grandTotal)}</span>
      </div>
    </div>
  );
};
