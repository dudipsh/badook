import { useTranslation } from 'react-i18next';
import { ReportLayout } from './ReportLayout';
import { MOCK_REPORT_DATA } from '../data';
import { formatCurrency } from '../utils';

export const VendorReport = () => {
  const { t } = useTranslation('reports');

  return (
    <ReportLayout title={t('cards.vendor.title')}>
      {() => (
        <div className="flex-1 bg-base-200/20 p-6 flex flex-col min-h-0">
          <div className="bg-base-100 rounded-box border border-base-300 shadow-sm flex-1 overflow-auto">
            <table className="table table-sm table-pin-rows">
              <thead>
                <tr className="bg-base-200">
                  <th>{t('columns.vendorName')}</th>
                  <th>{t('columns.poAmount')}</th>
                  <th>{t('columns.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_REPORT_DATA.map((row, i) => (
                  <tr key={i} className="hover">
                    <td className="font-medium text-xs max-w-[200px] truncate" title={row.vendorName}>
                      {row.vendorName}
                    </td>
                    <td className="font-mono text-xs">{formatCurrency(row.amount)}</td>
                    <td className="p-1 min-w-[200px]">
                      <input
                        type="text"
                        defaultValue={row.notes}
                        placeholder={t('placeholders.enterNote')}
                        className="input input-sm input-ghost w-full bg-base-200/50 focus:bg-base-100 font-normal opacity-70 hover:opacity-100 focus:opacity-100 rtl:text-right ltr:text-left h-7 text-xs"
                        dir="auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportLayout>
  );
};
