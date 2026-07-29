import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

interface DocumentViewerThumbnailsProps {
  pageCount: number;
  selectedPage: number;
  thumbnails: Map<number, string>;
  onSelectPage: (page: number) => void;
}

export const DocumentViewerThumbnails = ({ pageCount, selectedPage, thumbnails, onSelectPage }: DocumentViewerThumbnailsProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="w-24 sm:w-32 flex-shrink-0 bg-base-200 border-l border-base-300 overflow-y-auto p-2 space-y-2 hidden sm:block">
      <div className="text-xs text-center text-base-content/50 font-medium py-1">
        {pageCount > 0 ? t('documentViewer.pages', { count: pageCount }) : '...'}
      </div>
      {Array.from({ length: pageCount }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelectPage(i)}
          className={`w-full rounded-lg border-2 overflow-hidden transition-colors ${
            selectedPage === i ? 'border-secondary shadow-sm' : 'border-transparent hover:border-base-300'
          }`}
        >
          {thumbnails.has(i) ? (
            <img src={thumbnails.get(i)} alt={t('documentViewer.pageAlt', { page: i + 1 })} className="w-full" />
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center bg-base-300">
              <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />
            </div>
          )}
          <p className="text-xs text-base-content/50 text-center py-0.5">{i + 1}</p>
        </button>
      ))}
    </div>
  );
};
