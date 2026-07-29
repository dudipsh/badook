import { useTranslation } from 'react-i18next';
import type { EmailScanLog } from '../../../services/gmail.service';
import { Loader2 } from 'lucide-react';

interface EmailPreviewProps {
  log: EmailScanLog;
}

export const EmailPreview = ({ log }: EmailPreviewProps) => {
  const { t } = useTranslation('settings');

  return (
    <>
      {/* Email info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-base-content/50">{t('gmail.emailSubject')}</span>
          <p className="font-medium">{log.subject || '-'}</p>
        </div>
        <div>
          <span className="text-base-content/50">{t('gmail.emailSender')}</span>
          <p className="font-medium">{log.senderEmail || '-'}</p>
        </div>
        <div>
          <span className="text-base-content/50">{t('gmail.emailFiles')}</span>
          <p className="font-medium">{log.attachmentCount}</p>
        </div>
        <div>
          <span className="text-base-content/50">{t('gmail.emailProcessed')}</span>
          <p className="font-medium">{log.processedCount}</p>
        </div>
      </div>

      {/* Processing banner */}
      {log.status === 'PROCESSING' && (
        <div className="bg-info/10 border border-info/30 rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-info animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-info">{t('gmail.aiProcessing')}</p>
            <p className="text-xs text-info/80">{t('gmail.aiProcessingDetail')}</p>
          </div>
        </div>
      )}
    </>
  );
}
