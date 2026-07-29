import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiggyBank } from 'lucide-react';
import { formatCurrency } from '../utils';

interface BudgetControlSummaryProps {
  totalPoAmount: number;
}

export const BudgetControlSummary = ({ totalPoAmount }: BudgetControlSummaryProps) => {
  const { t } = useTranslation('reports');
  const [contractAmount, setContractAmount] = useState<number | string>(53910694);
  const [exceptions, setExceptions] = useState<number | string>(2089701);
  const [salaryExpenses, setSalaryExpenses] = useState<number | string>(2026840);
  const [overheads, setOverheads] = useState<number | string>(2475019);

  const revenue = (Number(contractAmount) || 0) + (Number(exceptions) || 0);
  const grossProfit = revenue - totalPoAmount;
  const totalOverheads = (Number(salaryExpenses) || 0) + (Number(overheads) || 0);
  const netProfit = grossProfit - totalOverheads;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return (
    <div className="bg-base-100 border-t-2 border-primary/20 p-6 flex-shrink-0 z-20 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-2 mb-4">
        <PiggyBank className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">{t('budgetSummary.title')}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Revenue Block */}
        <div className="bg-base-200/50 rounded-xl p-4 border border-base-300 text-sm">
          <h4 className="font-bold mb-3 opacity-60 text-xs tracking-wide">{t('budgetSummary.revenue')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="opacity-70">{t('budgetSummary.contractAmount')}</span>
              <div className="relative w-28">
                <span className="absolute right-2 top-1 text-xs opacity-40">₪</span>
                <input type="number" dir="ltr" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} className="input input-xs bg-base-100 w-full text-left rtl:pr-5 ltr:pl-5 font-mono" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-70">{t('budgetSummary.exceptions')}</span>
              <div className="relative w-28">
                <span className="absolute right-2 top-1 text-xs opacity-40">₪</span>
                <input type="number" dir="ltr" value={exceptions} onChange={(e) => setExceptions(e.target.value)} className="input input-xs bg-base-100 w-full text-left rtl:pr-5 ltr:pl-5 font-mono" />
              </div>
            </div>
            <div className="divider my-1 opacity-20" />
            <div className="flex justify-between items-center font-bold text-success">
              <span>{t('budgetSummary.totalRevenue')}</span>
              <span className="font-mono">{formatCurrency(revenue)}</span>
            </div>
          </div>
        </div>

        {/* Direct Expenses Block */}
        <div className="bg-base-200/50 rounded-xl p-4 border border-base-300 text-sm">
          <h4 className="font-bold mb-3 opacity-60 text-xs tracking-wide">{t('budgetSummary.directExpenses')}</h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-error font-bold text-lg mt-2">
              <span>{t('budgetSummary.totalVendorExpenses')}</span>
              <span className="font-mono">{formatCurrency(totalPoAmount)}</span>
            </div>
            <div className="divider my-1 opacity-20" />
            <div className="flex justify-between items-center font-bold">
              <span>{t('budgetSummary.grossProfit')}</span>
              <span className="font-mono">{formatCurrency(grossProfit)}</span>
            </div>
          </div>
        </div>

        {/* Overheads Block */}
        <div className="bg-base-200/50 rounded-xl p-4 border border-base-300 text-sm">
          <h4 className="font-bold mb-3 opacity-60 text-xs tracking-wide">{t('budgetSummary.overheads')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="opacity-70">{t('budgetSummary.salaryExpenses')}</span>
              <div className="relative w-28">
                <span className="absolute right-2 top-1 text-xs opacity-40">₪</span>
                <input type="number" dir="ltr" value={salaryExpenses} onChange={(e) => setSalaryExpenses(e.target.value)} className="input input-xs bg-base-100 w-full text-left rtl:pr-5 ltr:pl-5 font-mono" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-70">{t('budgetSummary.companyOverheads')}</span>
              <div className="relative w-28">
                <span className="absolute right-2 top-1 text-xs opacity-40">₪</span>
                <input type="number" dir="ltr" value={overheads} onChange={(e) => setOverheads(e.target.value)} className="input input-xs bg-base-100 w-full text-left rtl:pr-5 ltr:pl-5 font-mono" />
              </div>
            </div>
            <div className="divider my-1 opacity-20" />
            <div className="flex justify-between items-center font-bold text-warning">
              <span>{t('budgetSummary.totalOverheads')}</span>
              <span className="font-mono">{formatCurrency(totalOverheads)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit Block */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 text-sm flex flex-col justify-center">
          <h4 className="font-bold mb-2 text-primary opacity-80 text-xs tracking-wide text-center">{t('budgetSummary.bottomLine')}</h4>
          <div className="text-center font-mono font-black text-2xl text-primary mb-1">
            {formatCurrency(netProfit)}
          </div>
          <div className="text-center font-bold opacity-60 font-mono text-sm bg-base-100 rounded-lg inline-block mx-auto px-3 py-1 border border-base-300">
            {margin.toFixed(2)}% <span className="text-xs">{t('budgetSummary.profit')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
