import { useTranslation } from 'react-i18next';
import { ReportLayout } from './ReportLayout';
import { BudgetControlRow } from './BudgetControlRow';
import { BudgetControlSummary } from './BudgetControlSummary';
import { MOCK_REPORT_DATA } from '../data';

export const BudgetControlReport = () => {
  const { t } = useTranslation('reports');
  const totalPoAmount = MOCK_REPORT_DATA.reduce((sum, r) => sum + r.amount, 0);

  return (
    <ReportLayout title={t('cards.budgetControl.title')}>
      {() => (
        <>
          <div className="flex-1 bg-base-200/20 p-6 flex flex-col min-h-0">
            <div className="bg-base-100 rounded-box border border-base-300 shadow-sm flex-1 overflow-auto">
              <table className="table table-sm table-pin-rows">
                <thead>
                  <tr className="bg-base-200">
                    <th>{t('columns.recipient')}</th>
                    <th>{t('columns.vendorName')}</th>
                    <th>{t('columns.paidToDate')}</th>
                    <th>{t('columns.finalInvoice')}</th>
                    <th>{t('columns.remainingBalance')}</th>
                    <th>{t('columns.notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_REPORT_DATA.map((row, i) => (
                    <BudgetControlRow key={i} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <BudgetControlSummary totalPoAmount={totalPoAmount} />
        </>
      )}
    </ReportLayout>
  );
};
