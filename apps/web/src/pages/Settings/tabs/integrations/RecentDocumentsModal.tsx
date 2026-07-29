import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { ScanLogsTable } from '../../../EmailSettingsPage/components/ScanLogsTable';
import { ScanDetailsModal } from '../../../EmailSettingsPage/components/ScanDetailsModal';
import type { EmailScanLog } from '../../../../services/gmail.service';

type Status = EmailScanLog['status'];

const STATUS_CHIPS: Array<{ status: Status; cls: string }> = [
  { status: 'PROCESSING', cls: 'bg-primary/10 text-primary' },
  { status: 'SUCCESS', cls: 'bg-success/10 text-success' },
  { status: 'PARTIAL', cls: 'bg-warning/10 text-warning' },
  { status: 'FAILED', cls: 'bg-error/10 text-error' },
  { status: 'NO_ATTACHMENTS', cls: 'bg-base-200 text-base-content/60' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RecentDocumentsModal = observer(({ open, onClose }: Props) => {
  const { gmailStore, languageStore } = useStores();
  const { t } = useTranslation('settings');
  const [selected, setSelected] = useState<EmailScanLog | null>(null);

  const logs = gmailStore.todayLogs;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const counts = STATUS_CHIPS.map((chip) => ({
    ...chip,
    count: logs.filter((l) => l.status === chip.status).length,
  })).filter((c) => c.count > 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="recent-docs-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-base-300/50 backdrop-blur-sm p-4"
          dir={languageStore.direction}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-base-100 rounded-2xl shadow-[0_20px_60px_rgb(0,0,0,0.2)] border border-base-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-base-200">
              <h4 className="font-bold text-[16px] text-base-content flex-1 min-w-0 truncate">
                {t('recentDocs.recentDocsTitle')}
              </h4>
              {gmailStore.scanning && (
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('recentDocs.scanningPill')}
                </span>
              )}
              <button
                onClick={onClose}
                aria-label={t('recentDocs.close')}
                className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {logs.length === 0 ? (
                <p className="text-sm text-base-content/50 text-center py-12">
                  {t('recentDocs.emptyToday')}
                </p>
              ) : (
                <>
                  {counts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {counts.map((c) => (
                        <span
                          key={c.status}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}
                        >
                          {t(`recentDocs.statusLabel.${c.status}`)}
                          <span className="tabular-nums font-bold">{c.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <ScanLogsTable
                    logs={logs}
                    loading={false}
                    onSelectLog={setSelected}
                  />
                </>
              )}
            </div>
          </motion.div>

          {selected && (
            <ScanDetailsModal
              log={selected}
              retrying={gmailStore.scanning}
              onRetry={() => {
                void gmailStore.retryScanLog(selected.id);
                setSelected(null);
              }}
              onDismiss={() => {
                void gmailStore.dismissScanLog(selected.id);
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
