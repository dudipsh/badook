import { useEffect, useState, useCallback, useRef } from 'react';
import { filesService } from '../../services/files.service';
import { DocumentViewerTitleBar } from './DocumentViewerTitleBar';
import { DocumentViewerThumbnails } from './DocumentViewerThumbnails';
import { DocumentViewerMainPane } from './DocumentViewerMainPane';

interface DocumentViewerModalProps {
  filePath: string | null;
  onClose: () => void;
}

export const DocumentViewerModal = ({ filePath, onClose }: DocumentViewerModalProps) => {
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [fullPageUrl, setFullPageUrl] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const objectUrlsRef = useRef<string[]>([]);

  const filename = filePath ? filePath.split('/').pop() || filePath : '';

  useEffect(() => {
    return () => { for (const url of objectUrlsRef.current) URL.revokeObjectURL(url); };
  }, []);

  useEffect(() => {
    if (!filePath) return;
    setPageCount(0); setSelectedPage(0); setThumbnails(new Map()); setFullPageUrl(null); setLoadingInfo(true);
    filesService.getFileInfo(filePath).then((info) => { setPageCount(info.pageCount); setLoadingInfo(false); }).catch(() => { setLoadingInfo(false); });
  }, [filePath]);

  useEffect(() => {
    if (!filePath || pageCount === 0) return;
    for (let i = 0; i < pageCount; i++) {
      filesService.getThumbnailUrl(filePath, i).then((url) => {
        objectUrlsRef.current.push(url);
        setThumbnails((prev) => new Map(prev).set(i, url));
      });
    }
  }, [filePath, pageCount]);

  const loadFullPage = useCallback(async (page: number) => {
    if (!filePath) return;
    setLoadingPage(true); setFullPageUrl(null);
    try { const url = await filesService.getPageUrl(filePath, page); objectUrlsRef.current.push(url); setFullPageUrl(url); }
    finally { setLoadingPage(false); }
  }, [filePath]);

  useEffect(() => { if (filePath && pageCount > 0) loadFullPage(selectedPage); }, [filePath, pageCount, selectedPage, loadFullPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!filePath) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <DocumentViewerTitleBar filename={filename} onClose={onClose} />
      <div className="flex flex-1 m-0 sm:m-4 sm:mb-4 bg-base-100 sm:rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <DocumentViewerThumbnails pageCount={pageCount} selectedPage={selectedPage} thumbnails={thumbnails} onSelectPage={setSelectedPage} />
        <DocumentViewerMainPane
          filename={filename} pageCount={pageCount} selectedPage={selectedPage}
          loadingInfo={loadingInfo} loadingPage={loadingPage} fullPageUrl={fullPageUrl}
          onPrevPage={() => setSelectedPage(Math.max(0, selectedPage - 1))}
          onNextPage={() => setSelectedPage(Math.min(pageCount - 1, selectedPage + 1))}
        />
      </div>
    </div>
  );
};
