import { useTranslation } from 'react-i18next';
import { DocumentDetailLine } from '../../services/documents.service';
import { formatCurrency, fmtQty } from '../../lib/currencyUtils';

interface Props {
  lines: DocumentDetailLine[];
  highlightItem?: string | null;
}

/** Best-effort highlight: every query token (quotes stripped) appears in the description. */
const matchesQuery = (description: string, query: string): boolean => {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const desc = description.toLowerCase();
  return tokens.every((tk) => desc.includes(tk) || desc.includes(tk.replace(/["״'׳]/g, '')));
};

export const DocumentLineItemsTable = ({ lines, highlightItem }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="overflow-x-auto rounded-xl border border-base-200">
      <table className="table table-sm">
        <thead>
          <tr className="text-[11px] text-base-content/50">
            <th className="text-start font-medium">{t('docModal.colDescription')}</th>
            <th className="text-start font-medium">{t('docModal.colCatalog')}</th>
            <th className="text-start font-medium tabular-nums">{t('docModal.colQty')}</th>
            <th className="text-start font-medium tabular-nums">{t('docModal.colUnitPrice')}</th>
            <th className="text-start font-medium tabular-nums">{t('docModal.colTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const hit = highlightItem ? matchesQuery(l.description, highlightItem) : false;
            return (
              <tr key={l.id} className={`text-[12.5px] ${hit ? 'bg-primary/[0.06]' : ''}`}>
                <td className="font-medium text-base-content">
                  <span className="line-clamp-2">{l.description}</span>
                </td>
                <td className="text-base-content/60 tabular-nums">{l.catalogNumber ?? '—'}</td>
                <td className="tabular-nums whitespace-nowrap">
                  {l.quantity != null ? fmtQty(l.quantity) : '—'}
                  {l.unit ? <span className="text-base-content/40"> {l.unit}</span> : null}
                </td>
                <td className="tabular-nums">{l.unitPrice != null ? formatCurrency(l.unitPrice) : '—'}</td>
                <td className="tabular-nums font-semibold">
                  {l.totalPrice != null ? formatCurrency(l.totalPrice) : '—'}
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-base-content/40 py-5 text-[12.5px]">
                {t('docModal.noLines')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
