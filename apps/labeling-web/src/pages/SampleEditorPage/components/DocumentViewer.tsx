import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { getFileUrl } from '@/api/samples.api';
import type { Sample } from '@/types/sample.types';

interface DocumentViewerProps {
  sample: Sample;
}

const DocumentViewer = ({ sample }: DocumentViewerProps) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const fileUrl = getFileUrl(sample.id);
  const isPdf = sample.originalFileName.toLowerCase().endsWith('.pdf');

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < sample.pageCount) setCurrentPage((p) => p + 1);
  };

  return (
    <div className="flex flex-col h-full bg-base-200 rounded-box">
      {isPdf && sample.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 p-2 bg-base-100 border-b border-base-300">
          <button className="btn btn-xs btn-ghost" onClick={handlePrevPage} disabled={currentPage <= 1}>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs">
            {t('editor.pageOf', { current: currentPage, total: sample.pageCount })}
          </span>
          <button
            className="btn btn-xs btn-ghost"
            onClick={handleNextPage}
            disabled={currentPage >= sample.pageCount}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {isPdf ? (
          <iframe
            src={`${fileUrl}#page=${currentPage}`}
            className="w-full h-full border-0"
            title={sample.originalFileName}
          />
        ) : (
          <img
            src={fileUrl}
            alt={sample.originalFileName}
            className="w-full h-full object-contain p-2"
          />
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
