import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Loader2, ZoomIn, ZoomOut, ChevronRight, ChevronLeft } from 'lucide-react';
import { filesService } from '../../../services/files.service';

interface InlineDocumentViewerProps {
  fileUrl: string | null;
  filename: string;
}

export const InlineDocumentViewer = ({ fileUrl, filename }: InlineDocumentViewerProps) => {
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const objectUrlsRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!fileUrl) { setLoading(false); return; }

    setLoading(true);
    setError(false);
    setPages(new Map());
    setPageCount(0);
    setCurrentPage(0);

    filesService.getFileInfo(fileUrl)
      .then((info) => {
        setPageCount(info.pageCount);
        // Load all pages
        const promises = Array.from({ length: info.pageCount }, (_, i) =>
          filesService.getPageUrl(fileUrl, i).then((url) => {
            objectUrlsRef.current.push(url);
            return { page: i, url };
          })
        );
        return Promise.allSettled(promises);
      })
      .then((results) => {
        const newPages = new Map<number, string>();
        for (const r of results) {
          if (r.status === 'fulfilled') {
            newPages.set(r.value.page, r.value.url);
          }
        }
        setPages(newPages);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [fileUrl]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.5)), []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    const el = document.getElementById(`evidence-page-${fileUrl}-${page}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [fileUrl]);

  if (!fileUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-base-content/40 bg-base-200">
        <FileText size={48} className="mb-3 opacity-30" />
        <p className="text-sm">No document available</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base-200">
        <Loader2 size={32} className="animate-spin text-base-content/40 mb-2" />
        <p className="text-xs text-base-content/40">Loading document...</p>
      </div>
    );
  }

  if (error || pages.size === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-base-content/40 bg-base-200">
        <FileText size={48} className="mb-3 opacity-30" />
        <p className="text-sm">Failed to load document</p>
        <p className="text-xs mt-1 opacity-60 truncate max-w-full px-4">{filename}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-200 border-b border-base-300 shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={handleZoomOut} disabled={zoom <= 0.5} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-mono text-base-content/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} disabled={zoom >= 3} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
            <ZoomIn size={14} />
          </button>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
            <span className="text-xs font-medium text-base-content/50">{currentPage + 1} / {pageCount}</span>
            <button onClick={() => goToPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1} className="p-1 rounded hover:bg-base-300 disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
          </div>
        )}

        <p className="text-xs text-base-content/40 truncate max-w-[120px]" title={filename}>{filename}</p>
      </div>

      {/* Pages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-base-200 p-4"
      >
        <div className="flex flex-col items-center gap-4" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <div key={i} id={`evidence-page-${fileUrl}-${i}`} className="bg-base-100 shadow-lg rounded-sm">
              {pages.has(i) ? (
                <img
                  src={pages.get(i)}
                  alt={`Page ${i + 1}`}
                  className="max-w-full"
                  onLoad={() => { if (i === 0 && scrollRef.current) scrollRef.current.scrollTop = 0; }}
                />
              ) : (
                <div className="w-[500px] aspect-[3/4] flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-base-content/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
