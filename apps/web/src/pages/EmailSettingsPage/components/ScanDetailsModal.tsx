import { useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { EmailScanLog } from '../../../services/gmail.service';
import { EmailPreview } from './EmailPreview';
import { AttachmentsList } from './AttachmentsList';

interface ScanDetailsModalProps {
  log: EmailScanLog;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

export const ScanDetailsModal = ({ log, retrying, onRetry, onDismiss, onClose }: ScanDetailsModalProps) => {
  const [previewAttId, setPreviewAttId] = useState<string | null>(null);
  const hasAttachments = log.attachments && log.attachments.length > 0;
  const { t } = useTranslation('settings');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 flex-shrink-0">
          <h3 className="text-lg font-semibold">{t('gmail.scanDetails')}</h3>
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <EmailPreview log={log} />

          <AttachmentsList
            log={log}
            previewAttId={previewAttId}
            onTogglePreview={(attId) => setPreviewAttId(previewAttId === attId ? null : attId)}
            onRetrySuccess={onRetry}
          />

          {!log.errorMessage && log.deliveryNotes.length === 0 && !hasAttachments && log.status === 'NO_ATTACHMENTS' && (
            <p className="text-sm text-base-content/50 text-center py-2">
              {t('gmail.noAttachmentsMessage')}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 flex justify-between flex-shrink-0">
          <div className="flex gap-2">
            {(log.status === 'FAILED' || log.status === 'PARTIAL') && (
              <Button
                variant="primary"
                size="sm"
                onClick={onRetry}
                disabled={retrying}
              >
                {retrying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {retrying ? t('gmail.retrying') : t('gmail.retry')}
              </Button>
            )}
            {log.status === 'PROCESSING' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onDismiss}
              >
                <X className="w-4 h-4" />
                {t('gmail.cancelScan')}
              </Button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common:close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
