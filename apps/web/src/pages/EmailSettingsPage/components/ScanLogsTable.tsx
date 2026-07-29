import { Info, Loader2, FileText, FileDown, ShieldBan } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../components/ui/Spinner';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatDateTime } from '../../../lib/formatters';
import { exportAsText, exportAsPdf } from '../../../lib/export-scan-logs';
import type { EmailScanLog } from '../../../services/gmail.service';

interface ScanLogsTableProps {
  logs: EmailScanLog[];
  loading: boolean;
  onSelectLog: (log: EmailScanLog) => void;
  onBlockSender?: (email: string) => void;
}

export const ScanLogsTable = ({ logs, loading, onSelectLog, onBlockSender }: ScanLogsTableProps) => {
  const { t } = useTranslation('settings');

  return (
    <div className="bg-base-100 rounded-xl border border-base-300">
      <div className="p-4 border-b border-base-300 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('gmail.scanHistory')}</h3>
        {logs.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => exportAsText(logs)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-base-content bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
              title={t('gmail.exportText')}
            >
              <FileText className="w-3.5 h-3.5" />
              {t('gmail.text')}
            </button>
            <button
              onClick={() => exportAsPdf(logs)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-info bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
              title={t('gmail.exportPdf')}
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <Spinner className="h-64" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-300 text-base-content/50">
              <th className="text-right py-3 px-4 font-medium">{t('gmail.date')}</th>
              <th className="text-right py-3 px-4 font-medium">{t('gmail.subject')}</th>
              <th className="text-right py-3 px-4 font-medium">{t('gmail.sender')}</th>
              <th className="text-right py-3 px-4 font-medium">{t('gmail.status')}</th>
              <th className="text-right py-3 px-4 font-medium">{t('gmail.files')}</th>
              <th className="text-right py-3 px-4 font-medium">{t('gmail.processed')}</th>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-base-300 hover:bg-base-200"
              >
                <td className="py-3 px-4 text-base-content/50">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="py-3 px-4 font-medium">
                  {log.subject || '-'}
                </td>
                <td className="py-3 px-4 text-base-content/60">
                  {log.senderEmail || '-'}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1">
                    {log.status === 'PROCESSING' && (
                      <Loader2 className="w-3 h-3 animate-spin text-info" />
                    )}
                    <StatusBadge status={log.status} />
                  </span>
                </td>
                <td className="py-3 px-4 text-base-content/70">
                  {log.attachmentCount}
                </td>
                <td className="py-3 px-4 text-base-content/70">
                  {log.processedCount}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    {(log.errorMessage || log.deliveryNotes.length > 0 || log.status === 'PROCESSING' || (log.attachments && log.attachments.length > 0)) && (
                      <button
                        onClick={() => onSelectLog(log)}
                        className="text-primary hover:text-primary/80"
                        title={t('gmail.details')}
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    )}
                    {onBlockSender && log.senderEmail && log.status !== 'BLOCKED' && (
                      <button
                        onClick={() => onBlockSender(log.senderEmail!)}
                        className="text-warning/70 hover:text-warning transition-colors"
                        title={t('gmail.blockSender', { email: log.senderEmail })}
                      >
                        <ShieldBan className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-base-content/40"
                >
                  {t('gmail.noScansFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
