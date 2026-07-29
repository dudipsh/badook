import { Brain, Pencil, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FeedbackItem } from '../../../../services/admin.service';
import i18n from '../../../../i18n';

const DOC_TYPE_KEYS: Record<string, string> = {
  DELIVERY_NOTE: 'common:docTypes.deliveryNote',
  PURCHASE_ORDER: 'common:docTypes.purchaseOrder',
  INVOICE: 'common:docTypes.invoice',
};

interface FeedbackTableProps {
  list: FeedbackItem[];
  page: number;
  totalPages: number;
  onEdit: (item: FeedbackItem) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
}

export const FeedbackTable = ({ list, page, totalPages, onEdit, onDelete, onPageChange }: FeedbackTableProps) => {
  const { t } = useTranslation('settings');
  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Brain className="w-5 h-5" />
        {t('feedback.title')}
      </h2>
      {list.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-right py-2 px-2">{t('feedback.descriptionA')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.descriptionB')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.catalogA')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.catalogB')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.sourceTarget')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.date')}</th>
                  <th className="text-right py-2 px-2">{t('feedback.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 max-w-[200px] truncate" title={item.descriptionA}>{item.descriptionA}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={item.descriptionB}>{item.descriptionB}</td>
                    <td className="py-2 px-2 text-gray-500">{item.catalogNumberA || '-'}</td>
                    <td className="py-2 px-2 text-gray-500">{item.catalogNumberB || '-'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">
                      {(DOC_TYPE_KEYS[item.sourceDocType] ? t(DOC_TYPE_KEYS[item.sourceDocType]) : item.sourceDocType)} → {(DOC_TYPE_KEYS[item.targetDocType] ? t(DOC_TYPE_KEYS[item.targetDocType]) : item.targetDocType)}
                    </td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{new Date(item.createdAt).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}</td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        <button onClick={() => onEdit(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title={t('common:edit')}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title={t('common:delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">{t('common:pageOf').split(' ')[0]} {page} {t('common:pageOf').split(' ').slice(1).join(' ')} {totalPages}</span>
              <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm">{t('feedback.noFeedbacks')}</p>
      )}
    </div>
  );
}
