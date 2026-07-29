import { FolderKanban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectListCardData } from '../../../services/chat.service';
import { ChatCardShell } from './ChatCardShell';
import { CardInitial } from './CardInitial';

interface Props {
  data: ProjectListCardData;
  onDismiss: () => void;
}

const MAX_ROWS = 6;

export const ProjectListCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const shown = data.projects.slice(0, MAX_ROWS);
  const remaining = data.count - shown.length;

  return (
    <ChatCardShell
      title={t('cards.projectList.title')}
      subtitle={t('cards.projectList.count', { count: data.count })}
      Icon={FolderKanban}
      accent="primary"
      onDismiss={onDismiss}
    >
      <div className="flex flex-col gap-1.5">
        {shown.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl bg-base-200/40 px-3 py-2.5"
          >
            <CardInitial name={p.name} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-base-content truncate">{p.name}</p>
              {p.address && (
                <p className="text-[11px] text-base-content/50 truncate mt-0.5">{p.address}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CountBadge value={p.purchaseOrderCount} label={t('cards.abbr.po')} />
              <CountBadge value={p.deliveryNoteCount} label={t('cards.abbr.dn')} />
              <CountBadge value={p.invoiceCount} label={t('cards.abbr.inv')} />
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <p className="text-[12px] text-base-content/40 font-medium text-center pt-1">
            {t('cards.more', { count: remaining })}
          </p>
        )}
      </div>
    </ChatCardShell>
  );
};

const CountBadge = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center justify-center w-9 rounded-lg bg-base-100 border border-base-200 py-1">
    <span className="text-[13px] font-bold text-base-content tabular-nums leading-none">{value}</span>
    <span className="text-[9px] text-base-content/40 font-medium uppercase leading-tight mt-0.5">{label}</span>
  </div>
);
