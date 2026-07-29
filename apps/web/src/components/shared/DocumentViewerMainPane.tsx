import { useTranslation } from 'react-i18next';
import { Loader2, ChevronRight, ChevronLeft, FileText } from 'lucide-react';

interface DocumentViewerMainPaneProps {
  filename: string;
  pageCount: number;
  selectedPage: number;
  loadingInfo: boolean;
  loadingPage: boolean;
  fullPageUrl: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export const DocumentViewerMainPane = ({
  filename, pageCount, selectedPage, loadingInfo, loadingPage, fullPageUrl, onPrevPage, onNextPage,
}: DocumentViewerMainPaneProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-300 flex-shrink-0 bg-base-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/50 font-medium">
            {t('documentViewer.pageOf', { current: selectedPage + 1, total: pageCount })}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={onPrevPage} disabled={selectedPage === 0} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={onNextPage} disabled={selectedPage === pageCount - 1} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <span className="text-xs text-base-content/40 hidden sm:inline">{filename}</span>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-4 sm:p-8 bg-base-200">
        {loadingInfo || loadingPage ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-base-content/40" /></div>
        ) : fullPageUrl ? (
          <img src={fullPageUrl} alt={t('documentViewer.pageAlt', { page: selectedPage + 1 })} className="max-w-full shadow-xl rounded-sm" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <FileText size={48} className="mb-3 opacity-40" />
            <p className="text-sm">{t('documentViewer.cannotLoadPage')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
