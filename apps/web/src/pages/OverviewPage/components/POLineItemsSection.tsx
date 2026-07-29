import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { LineItem } from './po-utils';
import { POSectionTitle } from './POSectionTitle';
import { POLineItemCard } from './POLineItemCard';

interface POLineItemsSectionProps {
  lineItems: LineItem[];
  onUpdate: (index: number, field: keyof LineItem, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const POLineItemsSection = ({ lineItems, onUpdate, onAdd, onRemove }: POLineItemsSectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <POSectionTitle icon="📋" title={t('createPO.items')} />
        <span className="text-xs text-base-content/40 bg-base-200 px-2 py-0.5 rounded-full font-medium">
          {lineItems.length}
        </span>
      </div>

      <div className="border border-base-300 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lineItems.map((item, index) => (
            <POLineItemCard
              key={index}
              item={item}
              index={index}
              onUpdate={(field, value) => onUpdate(index, field, value)}
              onRemove={() => onRemove(index)}
              canRemove={lineItems.length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 text-secondary text-sm font-medium py-2.5 border-t border-base-300 hover:bg-base-200 transition-colors"
        >
          <Plus size={16} />
          {t('createPO.addRow')}
        </button>
      </div>
    </div>
  );
};
