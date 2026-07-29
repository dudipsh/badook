import type { MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ItemDocumentRow, ItemDocumentsCardData } from '../../../services/chat.service';
import { formatCurrency, fmtQty } from '../../../lib/currencyUtils';
import { formatDate } from '../../../lib/formatters';
import { useStores } from '../../../lib/store-context';
import { DOC_TYPE_BADGE } from '../docType';

interface Props {
  data: ItemDocumentsCardData;
  onDismiss: () => void;
}

export const ItemDocumentsCard = ({ data, onDismiss }: Props) => {
  const { t } = useTranslation('chat');
  const { chatStore } = useStores();
  const navigate = useNavigate();
  const { filters } = data;

  const meta = [
    t('cards.itemSupply.metaItem', { item: data.itemQuery }),
    filters.projectName ? t('cards.itemDocuments.metaProject', { project: filters.projectName }) : null,
    filters.supplierName ? t('cards.itemDocuments.metaSupplier', { supplier: filters.supplierName }) : null,
    filters.dateFrom || filters.dateTo
      ? t('cards.itemSupply.metaPeriod', { from: filters.dateFrom ?? '…', to: filters.dateTo ?? '…' })
      : null,
  ].filter(Boolean) as string[];

  const openDoc = (row: ItemDocumentRow) => {
    chatStore.openDocument({
      type: row.type,
      id: row.docId,
      projectId: row.projectId,
      projectName: row.projectName,
      highlightItem: data.itemQuery,
    });
  };

  const goToProject = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    chatStore.close();
    navigate(`/projects/${id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[820px] rounded-2xl border border-base-200 bg-base-100 shadow-[0_4px_24px_rgb(0,0,0,0.06)] overflow-hidden"
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
          <FileText className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-[15px] text-base-content leading-tight truncate">
              {t('cards.itemDocuments.title', { item: data.itemQuery })}
            </h4>
            <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0" />
          </div>
          {meta.length > 0 && (
            <p className="text-[11px] text-base-content/50 font-medium mt-1 line-clamp-2">
              {meta.join('  ·  ')}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label={t('close')}
          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        {data.documents.length === 0 ? (
          <p className="text-[13px] text-base-content/50">{t('cards.itemDocuments.noResults')}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-1.5 px-0.5">
              <span className="text-[12px] font-bold text-base-content">
                {t('cards.itemDocuments.tableTitle')}
              </span>
              <span className="text-[10.5px] text-base-content/40">
                {t('cards.itemDocuments.metaCount', { count: data.totalDocuments })}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-base-200">
              <table className="table table-xs">
                <thead>
                  <tr className="text-[10.5px] text-base-content/50">
                    <th className="text-start font-medium">{t('cards.itemDocuments.colDoc')}</th>
                    <th className="text-start font-medium">{t('cards.itemDocuments.colDate')}</th>
                    <th className="text-start font-medium">{t('cards.itemDocuments.colProject')}</th>
                    <th className="text-start font-medium">{t('cards.itemDocuments.colSupplier')}</th>
                    <th className="text-start font-medium tabular-nums">{t('cards.itemDocuments.colQty')}</th>
                    <th className="text-start font-medium tabular-nums">{t('cards.itemDocuments.colUnitPrice')}</th>
                    <th className="text-start font-medium tabular-nums">{t('cards.itemDocuments.colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((row) => {
                    const badge = DOC_TYPE_BADGE[row.type];
                    return (
                      <tr
                        key={row.docId}
                        className="text-[12px] cursor-pointer hover:bg-base-200/50 transition-colors"
                        onClick={() => openDoc(row)}
                        title={t('cards.itemDocuments.openHint')}
                      >
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${badge.cls}`}>
                              {t(badge.labelKey)}
                            </span>
                            <span className="font-medium text-base-content tabular-nums">
                              {row.docNumber ?? '—'}
                            </span>
                          </span>
                        </td>
                        <td className="text-[11px] text-base-content/60 whitespace-nowrap">
                          {row.docDate ? formatDate(row.docDate) : '—'}
                        </td>
                        <td className="text-base-content/70 max-w-[140px]">
                          {row.projectId && row.projectName ? (
                            <button
                              onClick={(e) => goToProject(e, row.projectId as string)}
                              className="hover:text-primary hover:underline truncate text-start"
                            >
                              {row.projectName}
                            </button>
                          ) : (
                            <span className="truncate">{row.projectName ?? '—'}</span>
                          )}
                        </td>
                        <td className="text-base-content/70 max-w-[140px]">
                          <span className="truncate">{row.supplierName ?? '—'}</span>
                        </td>
                        <td className="tabular-nums whitespace-nowrap">
                          {fmtQty(row.totalQuantity)}
                          {row.unit ? <span className="text-base-content/40"> {row.unit}</span> : null}
                        </td>
                        <td className="tabular-nums">
                          {row.avgUnitPrice != null ? formatCurrency(row.avgUnitPrice) : '—'}
                        </td>
                        <td className="tabular-nums font-semibold">{formatCurrency(row.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.truncated && (
              <p className="mt-2 text-[11px] text-base-content/40">
                {t('cards.itemDocuments.truncated', { shown: data.documents.length, total: data.totalDocuments })}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
