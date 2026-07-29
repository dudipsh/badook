import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportRow } from '../types';
import { formatCurrency } from '../utils';

interface BudgetControlRowProps {
  row: ReportRow;
}

export const BudgetControlRow = ({ row }: BudgetControlRowProps) => {
  const { t } = useTranslation('reports');
  const [paidAmount, setPaidAmount] = useState<number | string>('');
  const balance = row.amount - (Number(paidAmount) || 0);

  return (
    <tr className="hover">
      <td className="p-1 min-w-[150px]">
        <input
          type="text"
          placeholder={t('placeholders.whoTransferred')}
          className="input input-sm input-ghost w-full bg-base-200/50 focus:bg-base-100 font-normal focus:opacity-100 opacity-70 rtl:text-right ltr:text-left h-7 text-xs"
          dir="auto"
        />
      </td>
      <td className="font-medium text-xs max-w-[200px] truncate" title={row.vendorName}>
        {row.vendorName}
      </td>
      <td className="p-1 min-w-[150px]">
        <div className="relative">
          <span className="absolute right-2 top-1.5 bottom-1.5 text-xs opacity-50">₪</span>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder={t('placeholders.amount')}
            className="input input-sm input-ghost w-full bg-accent/5 focus:bg-accent/10 border border-accent/20 focus:border-accent text-accent font-mono focus:opacity-100 placeholder:text-accent/40 rtl:text-left ltr:text-right rtl:pr-6 ltr:pl-6 h-7 text-xs"
            dir="ltr"
          />
        </div>
      </td>
      <td className="font-mono text-xs opacity-80">{formatCurrency(row.amount)}</td>
      <td className={`font-mono text-xs font-bold ${balance > 0 ? 'text-error' : balance < 0 ? 'text-success' : 'opacity-80'}`}>
        {formatCurrency(balance)}
      </td>
      <td className="p-1 min-w-[200px]">
        <input
          type="text"
          defaultValue={row.notes}
          placeholder={t('placeholders.additionalNotes')}
          className="input input-sm input-ghost w-full bg-base-200/50 focus:bg-base-100 font-normal opacity-70 hover:opacity-100 focus:opacity-100 rtl:text-right ltr:text-left h-7 text-xs"
          dir="auto"
        />
      </td>
    </tr>
  );
};
