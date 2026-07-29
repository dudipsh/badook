import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, FileText, ExternalLink, Loader2, TriangleAlert, Building2 } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { DocumentDetail, fetchDocumentDetail } from '../../services/documents.service';
import { formatCurrency } from '../../lib/currencyUtils';
import { formatDate } from '../../lib/formatters';
import { DOC_TYPE_BADGE } from './docType';
import { DocumentLineItemsTable } from './DocumentLineItemsTable';

/**
 * Opens on chatStore.viewingDocument — fetches a single document (DN/invoice/PO)
 * and shows its header + line items above the chat (z-[150]). Lets the user jump
 * straight to the owning project.
 */
export const DocumentDetailModal = observer(() => {
  const { chatStore, languageStore } = useStores();
  const { t } = useTranslation('chat');
  const navigate = useNavigate();
  const doc = chatStore.viewingDocument;
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setStatus('loading');
    setDetail(null);
    fetchDocumentDetail(doc.type, doc.id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [doc?.type, doc?.id]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chatStore.closeDocument();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, chatStore]);

  const close = () => chatStore.closeDocument();
  const projectId = detail?.projectId ?? doc?.projectId ?? null;
  const projectName = detail?.projectName ?? doc?.projectName ?? null;

  const goToProject = () => {
    if (!projectId) return;
    chatStore.closeDocument();
    chatStore.close();
    navigate(`/projects/${projectId}`);
  };

  const badge = doc ? DOC_TYPE_BADGE[doc.type] : null;
  const subtitle = detail
    ? [detail.supplierName, detail.date ? formatDate(detail.date) : null].filter(Boolean).join('  ·  ')
    : t('docModal.loading');

  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div
          key="doc-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-base-300/50 backdrop-blur-sm p-4"
          dir={languageStore.direction}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-base-100 rounded-2xl shadow-[0_20px_60px_rgb(0,0,0,0.2)] border border-base-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-base-200">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  badge?.cls ?? 'bg-primary/10 text-primary'
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
                      {t(badge.labelKey)}
                    </span>
                  )}
                  <h4 className="font-bold text-[16px] text-base-content truncate">
                    {detail?.number ?? '…'}
                  </h4>
                </div>
                <p className="text-[12px] text-base-content/55 font-medium mt-1 truncate">{subtitle}</p>
              </div>
              <button
                onClick={close}
                aria-label={t('close')}
                className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {status === 'loading' && (
                <div className="flex items-center justify-center py-16 text-base-content/40">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-error bg-error/10 rounded-xl px-4 py-3 text-[13px] font-medium">
                  <TriangleAlert className="w-4 h-4 shrink-0" /> {t('docModal.error')}
                </div>
              )}
              {status === 'idle' && detail && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {projectName && (
                      <span className="px-2.5 py-1 rounded-lg bg-base-200/70 text-[12px] text-base-content/70 font-medium">
                        {projectName}
                      </span>
                    )}
                    {detail.totalAmount != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-base-200/70 text-[12px] text-base-content/70 font-medium tabular-nums">
                        {t('docModal.total')}: {formatCurrency(detail.totalAmount, detail.currency)}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-base-content mb-1.5 px-0.5">
                    {t('docModal.lineItems')}
                  </p>
                  <DocumentLineItemsTable lines={detail.lineItems} highlightItem={doc.highlightItem} />
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-base-200">
              {detail?.originalFileUrl ? (
                <a
                  href={detail.originalFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
                >
                  <ExternalLink className="w-4 h-4" /> {t('docModal.viewOriginal')}
                </a>
              ) : (
                <span />
              )}
              {projectId && (
                <button onClick={goToProject} className="btn btn-primary btn-sm gap-1.5">
                  <Building2 className="w-4 h-4" /> {t('docModal.openProject')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
