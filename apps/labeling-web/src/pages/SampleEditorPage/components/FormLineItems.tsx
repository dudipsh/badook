import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { LineItem } from '@/types/sample.types';

interface FormLineItemsProps {
  lineItems: LineItem[];
  onChange: (index: number, field: keyof LineItem, value: string | number | null) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  geminiLineItems?: LineItem[] | null;
}

const emptyLineItem: LineItem = {
  description: '',
  catalogNumber: '',
  quantity: null,
  unit: '',
  unitPrice: null,
  totalPrice: null,
  discountPercent: null,
  discountAmount: null,
  priceBeforeDiscount: null,
  remarks: '',
};

const FormLineItems = ({ lineItems, onChange, onAdd, onRemove, geminiLineItems }: FormLineItemsProps) => {
  const { t } = useTranslation();

  const isChanged = (index: number, field: keyof LineItem): boolean => {
    if (!geminiLineItems || !geminiLineItems[index]) return false;
    return String(lineItems[index][field] ?? '') !== String(geminiLineItems[index][field] ?? '');
  };

  const cellClass = (index: number, field: keyof LineItem) =>
    `input input-bordered input-xs w-full ${isChanged(index, field) ? 'border-warning bg-warning/5' : ''}`;

  const handleNumberChange = (index: number, field: keyof LineItem, value: string) => {
    if (value === '') {
      onChange(index, field, null);
    } else {
      const num = parseFloat(value);
      onChange(index, field, isNaN(num) ? null : num);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('form.lineItems')}</h3>
        <button className="btn btn-xs btn-ghost text-primary" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" />
          {t('buttons.addRow')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-xs">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="min-w-[180px]">{t('form.description')}</th>
              <th className="min-w-[100px]">{t('form.catalogNumber')}</th>
              <th className="min-w-[70px]">{t('form.quantity')}</th>
              <th className="min-w-[60px]">{t('form.unit')}</th>
              <th className="min-w-[90px]">{t('form.unitPrice')}</th>
              <th className="min-w-[90px]">{t('form.totalPrice')}</th>
              <th className="min-w-[120px]">{t('form.remarks')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={index}>
                <td className="text-center text-xs text-base-content/50">{index + 1}</td>
                <td>
                  <input
                    className={cellClass(index, 'description')}
                    value={item.description}
                    onChange={(e) => onChange(index, 'description', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'catalogNumber')}
                    value={item.catalogNumber}
                    onChange={(e) => onChange(index, 'catalogNumber', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'quantity')}
                    type="number"
                    value={item.quantity ?? ''}
                    onChange={(e) => handleNumberChange(index, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'unit')}
                    value={item.unit}
                    onChange={(e) => onChange(index, 'unit', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'unitPrice')}
                    type="number"
                    step="0.01"
                    value={item.unitPrice ?? ''}
                    onChange={(e) => handleNumberChange(index, 'unitPrice', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'totalPrice')}
                    type="number"
                    step="0.01"
                    value={item.totalPrice ?? ''}
                    onChange={(e) => handleNumberChange(index, 'totalPrice', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={cellClass(index, 'remarks')}
                    value={item.remarks}
                    onChange={(e) => onChange(index, 'remarks', e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => onRemove(index)}
                    title={t('buttons.removeRow')}
                  >
                    <Trash2 className="w-3 h-3 text-error" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lineItems.length === 0 && (
        <div className="text-center py-4 text-base-content/40 text-sm">
          {t('table.noSamples')}
        </div>
      )}
    </div>
  );
};

export { emptyLineItem };
export default FormLineItems;
