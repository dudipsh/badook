import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { LineItem, UOM_OPTIONS, calcLineTotal, formatNumber } from './po-utils';
import { MetricField } from './MetricField';

interface POLineItemCardProps {
  item: LineItem;
  index: number;
  onUpdate: (field: keyof LineItem, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const inputClass =
  'px-2 py-1 text-xs border border-base-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary/20 w-full';

export const POLineItemCard = ({ item, index, onUpdate, onRemove, canRemove }: POLineItemCardProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="p-3 hover:bg-base-200 transition-colors group space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-6 pt-2 text-base-content/40 font-mono text-xs text-center shrink-0">{index + 1}</div>

        <div className="flex-1 flex flex-col gap-3">
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            placeholder={t('createPO.itemDescPlaceholder')}
            className="w-full px-2 py-1.5 border border-base-300 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-secondary/20"
          />

          <div className="flex items-end gap-3 pb-1">
            <div className="flex-1 grid grid-cols-5 gap-3">
              <MetricField label={t('createPO.catalogNumber')}>
                <input type="text" value={item.catalogNumber} onChange={(e) => onUpdate('catalogNumber', e.target.value)} className={inputClass} />
              </MetricField>

              <MetricField label={t('createPO.unitOfMeasure')}>
                <select value={item.unit} onChange={(e) => onUpdate('unit', e.target.value)} className={inputClass}>
                  <option value="" disabled>{t('createPO.selectUom')}</option>
                  {UOM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </MetricField>

              <MetricField label={t('createPO.quantity')}>
                <input type="number" value={item.quantity} onChange={(e) => onUpdate('quantity', e.target.value)} className={`${inputClass} text-right font-mono`} />
              </MetricField>

              <MetricField label={t('createPO.unitPrice')}>
                <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => onUpdate('unitPrice', e.target.value)} className={`${inputClass} text-right font-mono`} />
              </MetricField>

              <MetricField label={t('createPO.discountPercent')}>
                <input type="number" value={item.discountPercent} onChange={(e) => onUpdate('discountPercent', e.target.value)} className={`${inputClass} text-right font-mono`} />
              </MetricField>
            </div>

            <div className="w-[80px] flex flex-col justify-end">
              <div className="text-xs text-base-content/50 px-1 mb-1 text-left">{t('createPO.total')}</div>
              <div className="text-left font-mono font-bold text-sm bg-base-200 px-2 py-0.5 rounded border border-base-300 h-6 flex items-center justify-end">
                {formatNumber(calcLineTotal(item))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-8 shrink-0 flex items-start justify-end pt-2">
          <button
            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-error transition-opacity text-base-content/30"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
