import { useTranslation } from 'react-i18next';
import { Upload, FileText, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import { InlineDocumentViewer } from '../../ProjectDashboardPage/components/InlineDocumentViewer';
import type { RefObject, DragEvent, ChangeEvent } from 'react';

interface PODocumentViewerProps {
  uploadedFile: File | null;
  fileUrl: string | null;
  localPreviewUrl: string | null;
  isExtracting: boolean;
  isExtracted: boolean;
  zoom: number;
  isDragging: boolean;
  onZoomChange: (zoom: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  docType?: string;
}

const formatFileSize = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`;

const isImageFile = (file: File): boolean => file.type.startsWith('image/');

export const PODocumentViewer = ({
  uploadedFile,
  fileUrl,
  localPreviewUrl,
  isExtracting,
  isExtracted,
  zoom,
  isDragging,
  onZoomChange,
  onDragStateChange,
  onFileSelect,
  onRemoveFile,
  fileInputRef,
  docType,
}: PODocumentViewerProps) => {
  const { t } = useTranslation('projects');

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    onDragStateChange(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  const renderUploadZone = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={(e) => { e.preventDefault(); onDragStateChange(true); }}
        onDragLeave={() => onDragStateChange(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 w-full max-w-md flex flex-col items-center gap-4 cursor-pointer transition-all
          ${isDragging ? 'border-secondary/50 bg-secondary/5 scale-[1.02]' : 'border-base-300 hover:border-secondary/50 hover:bg-secondary/5'}`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDragging ? 'bg-secondary/20' : 'bg-base-200'}`}>
          <Upload size={24} className={isDragging ? 'text-secondary' : 'text-base-content/40'} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-base-content">{t(docType ? `upload.uploadFile_${docType}` : 'createPO.uploadQuote')}</p>
          <p className="text-xs text-base-content/40 mt-1">{t('createPO.uploadSubtitle')}</p>
        </div>
        <p className="text-xs text-base-content/40">{t('createPO.supportedFormats')}</p>
      </div>
    </div>
  );

  const renderExtracting = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-secondary/30" />
          <div className="absolute inset-0 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
          <FileText size={28} className="text-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm text-base-content/60 font-medium">{t('createPO.extracting')}</p>
        <p className="text-xs text-base-content/40">{t('createPO.aiReadingDetails')}</p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  const displayName = uploadedFile?.name ?? fileUrl?.split('/').pop() ?? '';
  const hasDocument = uploadedFile || fileUrl;

  const renderViewer = () => (
    <>
      {/* Toolbar header */}
      <div className="px-4 py-2 border-b border-base-300 bg-base-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm text-base-content/60 min-w-0">
          <FileText size={16} className="shrink-0 text-secondary" />
          <span className="truncate font-medium">{displayName}</span>
          {uploadedFile && <span className="text-xs text-base-content/40 font-mono shrink-0">{formatFileSize(uploadedFile.size)}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onZoomChange(Math.max(50, zoom - 25))} className="p-1 rounded hover:bg-base-200 text-base-content/40 hover:text-base-content/60 transition-colors">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono text-base-content/50 w-10 text-center">{zoom}%</span>
          <button onClick={() => onZoomChange(Math.min(200, zoom + 25))} className="p-1 rounded hover:bg-base-200 text-base-content/40 hover:text-base-content/60 transition-colors">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => onZoomChange(100)} className="p-1 rounded hover:bg-base-200 text-base-content/40 hover:text-base-content/60 transition-colors">
            <RotateCcw size={16} />
          </button>
          {uploadedFile && (
            <>
              <div className="w-px h-4 bg-base-300 mx-1" />
              <button onClick={onRemoveFile} className="p-1 rounded hover:bg-error/10 text-base-content/40 hover:text-error transition-colors">
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document preview */}
      {fileUrl ? (
        <InlineDocumentViewer fileUrl={fileUrl} filename={displayName} />
      ) : localPreviewUrl && uploadedFile && isImageFile(uploadedFile) ? (
        <div className="flex-1 overflow-auto p-4 bg-base-200">
          <img
            src={localPreviewUrl}
            alt={displayName}
            className="mx-auto rounded-lg shadow-lg"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-base-200">
          <FileText size={48} className="text-base-content/30" />
          <p className="text-sm font-medium text-base-content/50">{t('createPO.pdfDocument')}</p>
          <p className="text-xs text-base-content/40">{displayName}</p>
          {isExtracted && <p className="text-xs text-success">{t('createPO.dataExtracted')}</p>}
        </div>
      )}
    </>
  );

  return (
    <div className="w-1/2 border-l border-base-300 bg-base-200 flex flex-col">
      {!hasDocument && !isExtracting && renderUploadZone()}
      {isExtracting && renderExtracting()}
      {hasDocument && !isExtracting && renderViewer()}
      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
    </div>
  );
};
