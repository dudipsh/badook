import {
  Check,
  Loader2,
  Phone,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WhatsAppMessageLog } from '../../../services/whatsapp.service';
import i18n from '../../../i18n';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />;
    case 'FAILED':
      return <XCircle className="w-5 h-5 text-error flex-shrink-0" />;
    case 'PROCESSING':
      return (
        <Loader2 className="w-5 h-5 text-info animate-spin flex-shrink-0" />
      );
    default:
      return (
        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
      );
  }
}

interface WhatsAppLogsTableProps {
  logs: WhatsAppMessageLog[];
  loading: boolean;
}

export const WhatsAppLogsTable = ({ logs, loading }: WhatsAppLogsTableProps) => {
  const { t } = useTranslation('settings');

  if (loading && logs.length === 0) {
    return (
      <div className="bg-base-100 rounded-xl border border-base-300 p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-base-content/40" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-base-100 rounded-xl border border-base-300 p-8 text-center">
        <Phone className="w-8 h-8 mx-auto text-base-content/30 mb-2" />
        <p className="text-sm text-base-content/50">{t('whatsapp.noMessages')}</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300">
        <h3 className="text-sm font-semibold text-base-content">
          {t('whatsapp.receivedMessages', { count: logs.length })}
        </h3>
      </div>
      <div className="divide-y divide-base-200">
        {logs.map((log) => (
          <div key={log.id} className="px-4 py-3 flex items-center gap-3">
            <StatusIcon status={log.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-base-content">
                  {log.senderName || log.senderPhone}
                </span>
                {log.senderName && (
                  <span className="text-xs text-base-content/40" dir="ltr">
                    {log.senderPhone}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-base-content/50 mt-0.5">
                <span>{log.messageType === 'image' ? t('whatsapp.image') : t('whatsapp.document')}</span>
                {log.caption && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-xs">{log.caption}</span>
                  </>
                )}
                {log.deliveryNotes.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-success">
                      {log.deliveryNotes.map((d) => d.supplierName).join(', ')}
                    </span>
                  </>
                )}
              </div>
              {log.errorMessage && (
                <p className="text-xs text-error mt-0.5">{log.errorMessage}</p>
              )}
            </div>
            <div className="text-xs text-base-content/40 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {new Date(log.createdAt).toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {log.replySent && (
              <span className="text-xs text-success flex-shrink-0" title={t('whatsapp.replySent')}>
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
