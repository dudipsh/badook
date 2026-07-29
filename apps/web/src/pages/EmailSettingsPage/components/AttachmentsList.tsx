import { useState, useEffect, useRef } from 'react';
import {
  Download, Eye, EyeOff, FileText, ImageIcon,
  Loader2, RotateCcw, ChevronRight, ChevronLeft, AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EmailScanLog, EmailScanAttachment } from '../../../services/gmail.service';
import { gmailService } from '../../../services/gmail.service';
import { filesService } from '../../../services/files.service';

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-error flex-shrink-0" />;
  if (['png', 'jpg', 'jpeg'].includes(ext || '')) return <ImageIcon className="w-4 h-4 text-info flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-base-content/40 flex-shrink-0" />;
}

interface AttachmentsListProps {
  log: EmailScanLog;
  previewAttId: string | null;
  onTogglePreview: (attId: string) => void;
  onRetrySuccess: () => void;
}

export const AttachmentsList = ({ log, previewAttId, onTogglePreview, onRetrySuccess }: AttachmentsListProps) => {
  const hasAttachments = log.attachments && log.attachments.length > 0;
  const { t } = useTranslation('settings');

  const attachmentStatusConfig: Record<string, { label: string; className: string }> = {
    PROCESSING: { label: t('gmail.attachmentStatus.processing'), className: 'bg-info/15 text-info' },
    SUCCESS: { label: t('gmail.attachmentStatus.success'), className: 'bg-success/15 text-success' },
    FAILED: { label: t('gmail.attachmentStatus.failed'), className: 'bg-error/15 text-error' },
    SKIPPED: { label: t('gmail.attachmentStatus.skipped'), className: 'bg-base-200 text-base-content' },
  };

  const docTypeLabels: Record<string, string> = {
    delivery_note: t('gmail.docTypes.delivery_note'),
    invoice: t('gmail.docTypes.invoice'),
    purchase_order: t('gmail.docTypes.purchase_order'),
  };

  if (hasAttachments) {
    return (
      <div>
        <p className="text-sm font-medium text-base-content mb-2">{t('gmail.attachments')}</p>
        <div className="space-y-1">
          {log.attachments.map((att) => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              isPreviewOpen={previewAttId === att.id}
              onTogglePreview={() => onTogglePreview(att.id)}
              onRetrySuccess={onRetrySuccess}
              attachmentStatusConfig={attachmentStatusConfig}
              docTypeLabels={docTypeLabels}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fallback: show old errorMessage for scans without attachment records */}
      {log.errorMessage && (
        <div className={`rounded-lg p-3 border ${
          log.status === 'FAILED' || log.status === 'PARTIAL'
            ? 'bg-error/10 border-error/30'
            : 'bg-base-200 border-base-300'
        }`}>
          <p className={`text-sm font-medium mb-1 ${
            log.status === 'FAILED' || log.status === 'PARTIAL'
              ? 'text-error'
              : 'text-base-content'
          }`}>
            {log.status === 'FAILED' || log.status === 'PARTIAL' ? t('gmail.errorDetails') : t('gmail.notes')}
          </p>
          <p className={`text-sm whitespace-pre-wrap ${
            log.status === 'FAILED' || log.status === 'PARTIAL'
              ? 'text-error/80'
              : 'text-base-content/60'
          }`} dir="ltr">
            {log.errorMessage}
          </p>
        </div>
      )}

      {/* Fallback: show deliveryNotes list for old scans */}
      {log.deliveryNotes.length > 0 && (
        <div>
          <p className="text-sm font-medium text-base-content mb-2">{t('gmail.identifiedDocs')}</p>
          <div className="space-y-2">
            {log.deliveryNotes.map((note) => (
              <div key={note.id} className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2 text-sm">
                <span>{note.supplierName}</span>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    attachmentStatusConfig[note.status]?.className || 'bg-base-200 text-base-content'
                  }`}>
                    {attachmentStatusConfig[note.status]?.label || note.status}
                  </span>
                  {note.originalFileUrl && (
                    <button
                      onClick={() => filesService.downloadFile(note.originalFileUrl!)}
                      className="text-base-content/40 hover:text-info"
                      title={t('gmail.downloadFile')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AttachmentRow({ attachment, isPreviewOpen, onTogglePreview, onRetrySuccess, attachmentStatusConfig, docTypeLabels }: {
  attachment: EmailScanAttachment;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  onRetrySuccess: () => void;
  attachmentStatusConfig: Record<string, { label: string; className: string }>;
  docTypeLabels: Record<string, string>;
}) {
  const config = attachmentStatusConfig[attachment.status] || { label: attachment.status, className: 'bg-base-200 text-base-content' };
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { t } = useTranslation('settings');

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await gmailService.retryAttachment(attachment.id);
      setTimeout(onRetrySuccess, 1500);
    } catch {
      setRetrying(false);
    }
  };

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-base-200">
        <FileIcon fileName={attachment.fileName} />
        <span className="text-sm font-medium truncate flex-1" title={attachment.fileName}>
          {attachment.fileName}
        </span>

        {attachment.documentType && (
          <span className="text-xs text-base-content/50 bg-base-300 px-2 py-0.5 rounded-full flex-shrink-0">
            {docTypeLabels[attachment.documentType] || attachment.documentType}
          </span>
        )}

        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${config.className}`}>
          {attachment.status === 'PROCESSING' && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          {config.label}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {attachment.status === 'FAILED' && attachment.filePath && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="p-1 text-base-content/40 hover:text-warning rounded disabled:opacity-50"
              title={t('gmail.rescan')}
            >
              {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            </button>
          )}
          {attachment.filePath && (
            <>
              <button
                onClick={onTogglePreview}
                className="p-1 text-base-content/40 hover:text-info rounded"
                title={isPreviewOpen ? t('gmail.closePreview') : t('gmail.preview')}
              >
                {isPreviewOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => filesService.downloadFile(attachment.filePath!)}
                className="p-1 text-base-content/40 hover:text-info rounded"
                title={t('gmail.downloadFile')}
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {attachment.status === 'FAILED' && attachment.errorMessage && (
        <div className="px-3 py-2 bg-error/10 border-t border-error/20">
          <button
            onClick={() => setErrorExpanded(!errorExpanded)}
            className="flex items-center gap-1 text-xs text-error hover:text-error/80"
          >
            <AlertCircle className="w-3 h-3" />
            <span className="font-medium">{t('gmail.errorLabel')}</span>
          </button>
          {errorExpanded && (
            <p className="mt-1 text-xs text-error whitespace-pre-wrap" dir="ltr">
              {attachment.errorMessage}
            </p>
          )}
        </div>
      )}

      {isPreviewOpen && attachment.filePath && (
        <div className="border-t border-base-300">
          <FilePreview filePath={attachment.filePath} />
        </div>
      )}
    </div>
  );
}

function FilePreview({ filePath }: { filePath: string }) {
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(0);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlsRef = useRef<string[]>([]);
  const { t } = useTranslation('settings');

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    filesService.getFileInfo(filePath).then((info) => {
      setPageCount(info.pageCount);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filePath]);

  useEffect(() => {
    if (pageCount === 0) return;
    setLoading(true);
    setPageUrl(null);
    filesService.getPageUrl(filePath, selectedPage).then((url) => {
      objectUrlsRef.current.push(url);
      setPageUrl(url);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filePath, pageCount, selectedPage]);

  return (
    <div className="flex flex-col">
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-base-300 bg-base-200">
          <button
            onClick={() => setSelectedPage(Math.max(0, selectedPage - 1))}
            disabled={selectedPage === 0}
            className="p-1 rounded hover:bg-base-300 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-base-content/50">
            {t('gmail.pageOf', { current: selectedPage + 1, total: pageCount })}
          </span>
          <button
            onClick={() => setSelectedPage(Math.min(pageCount - 1, selectedPage + 1))}
            disabled={selectedPage === pageCount - 1}
            className="p-1 rounded hover:bg-base-300 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-center p-4 bg-base-200 max-h-[400px] overflow-auto">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-base-content/40 my-8" />
        ) : pageUrl ? (
          <img src={pageUrl} alt={t('gmail.pageAlt', { page: selectedPage + 1 })} className="max-w-full shadow-md rounded" />
        ) : (
          <p className="text-base-content/40 text-sm my-8">{t('gmail.cannotLoadDocument')}</p>
        )}
      </div>
    </div>
  );
}
