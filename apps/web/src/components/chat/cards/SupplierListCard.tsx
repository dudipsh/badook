import { Truck, Phone, Mail, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SupplierListCardData, SupplierListItem } from '../../../services/chat.service';
import { ChatCardShell } from './ChatCardShell';
import { CardInitial } from './CardInitial';

interface Props {
  data: SupplierListCardData;
  onDismiss: () => void;
}

const MAX_ROWS = 6;

const secondaryLine = (s: SupplierListItem): { Icon: typeof Phone; text: string } | null => {
  if (s.phone) return { Icon: Phone, text: s.phone };
  if (s.email) return { Icon: Mail, text: s.email };
  if (s.businessId) return { Icon: Hash, text: s.businessId };
  return null;
};

export const SupplierListCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const shown = data.suppliers.slice(0, MAX_ROWS);
  const remaining = data.count - shown.length;

  return (
    <ChatCardShell
      title={t('cards.supplierList.title')}
      subtitle={t('cards.supplierList.count', { count: data.count })}
      Icon={Truck}
      accent="info"
      onDismiss={onDismiss}
    >
      <div className="flex flex-col gap-1.5">
        {shown.map((s) => {
          const secondary = secondaryLine(s);
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-base-200/40 px-3 py-2.5">
              <CardInitial name={s.name} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-base-content truncate">{s.name}</p>
                {secondary && (
                  <span className="flex items-center gap-1 mt-0.5 text-[11px] text-base-content/50 truncate">
                    <secondary.Icon className="w-3 h-3 shrink-0" />
                    {secondary.text}
                  </span>
                )}
              </div>
              {s.purchaseOrderCount > 0 && (
                <span className="shrink-0 text-[11px] font-semibold text-base-content/70 bg-base-100 border border-base-200 rounded-full px-2.5 py-1">
                  {t('cards.supplierList.orders', { count: s.purchaseOrderCount })}
                </span>
              )}
            </div>
          );
        })}
        {remaining > 0 && (
          <p className="text-[12px] text-base-content/40 font-medium text-center pt-1">
            {t('cards.more', { count: remaining })}
          </p>
        )}
      </div>
    </ChatCardShell>
  );
};
