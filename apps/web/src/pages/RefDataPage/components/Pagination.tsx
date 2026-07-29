import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ page, totalPages, total, limit, onPageChange }: PaginationProps) => {
  const { t } = useTranslation('ref-data');

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-sm text-gray-500">
        {t('pagination.showing')} {from}-{to} {t('pagination.of')} {total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn btn-sm btn-ghost disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
          {t('pagination.prev')}
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn btn-sm btn-ghost disabled:opacity-30"
        >
          {t('pagination.next')}
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
