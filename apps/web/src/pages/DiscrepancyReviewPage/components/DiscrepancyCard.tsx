import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { ReconciliationLineItem } from '../../../types/reconciliation';
import { filesService } from '../../../services/files.service';
import i18n from '../../../i18n';
import { fmtQty } from '../../../lib/currencyUtils';

interface DiscrepancyCardProps {
  item: ReconciliationLineItem;
  onOpenDocument: (fileUrl: string) => void;
}

export const DiscrepancyCard = ({ item, onOpenDocument }: DiscrepancyCardProps) => {
  const { t } = useTranslation('projects');
  const invoicedQty = item.invoicedAmount ?? item.orderedQty;
  const receivedQty = item.receivedQty;
  const gap = Math.abs(invoicedQty - receivedQty);

  const invoiceDoc = item.relatedDocuments.find((d) => d.type === 'INV');
  const [selectedDnIndex, setSelectedDnIndex] = useState(0);
  const relevantDn = item.deliveryHistory.length > 0
    ? item.deliveryHistory[selectedDnIndex] || item.deliveryHistory[0]
    : null;
  const dcFileUrl = relevantDn?.fileUrl ?? item.relatedDocuments.find((d) => d.type === 'DC')?.fileUrl ?? null;
  const dcLabel = relevantDn
    ? t('discrepancy.dnLabel', { number: relevantDn.noteNumber })
    : item.relatedDocuments.find((d) => d.type === 'DC')?.name || t('discrepancy.deliveryNote');

  return (
    <>
      {/* Summary bar */}
      <div className="px-6 py-3 bg-base-200 border-b border-base-300 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="text-base-content/50">{t('discrepancy.order')} <strong className="text-base-content">{item.poNumber}</strong></span>
          <span className="text-base-content/50">{t('discrepancy.ordered')} <strong className="text-base-content">{fmtQty(item.orderedQty)}</strong></span>
          {item.unitPrice > 0 && (
            <span className="text-base-content/50">{t('discrepancy.unitPrice')} <strong className="text-base-content">{item.unitPrice.toFixed(2)}</strong></span>
          )}
        </div>
        {gap > 0 ? (
          <span className="text-error font-bold text-base">{t('discrepancy.gap')} {fmtQty(gap)} {item.unit || t('lineItems.unit')}</span>
        ) : (
          <span className="text-success font-bold text-base">{t('discrepancy.noGap')}</span>
        )}
      </div>

      {/* Main comparison -- two columns */}
      <div className="flex-1 grid grid-cols-2 min-h-0">
        {/* Left: Invoice (Billed) */}
        <div className="flex flex-col border-l border-base-300">
          <div className="flex items-center justify-between px-6 py-3 bg-error/10 border-b-2 border-error/40">
            <span className="text-xs font-semibold text-error uppercase tracking-wider">
              {t('discrepancy.invoiceCharged')}
            </span>
            <span className="text-sm font-bold text-error">{fmtQty(invoicedQty)} {item.unit || t('lineItems.unit')}</span>
          </div>
          <div className="flex-1 min-h-0">
            <ZoomableDocument
              fileUrl={invoiceDoc?.fileUrl ?? null}
              label={invoiceDoc?.name || t('discrepancy.invoiceLabel')}
              onOpenFull={invoiceDoc?.fileUrl ? () => onOpenDocument(invoiceDoc.fileUrl!) : undefined}
            />
          </div>
        </div>

        {/* Right: Delivery Certificate (Received) */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-success/10 border-b-2 border-success/40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-success uppercase tracking-wider">
                {t('discrepancy.receivedOnSite')}
              </span>
              {item.deliveryHistory.length > 1 && (
                <div className="flex gap-1">
                  {item.deliveryHistory.map((dh, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDnIndex(i)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        i === selectedDnIndex
                          ? 'bg-success text-success-content border-success'
                          : 'bg-base-100 text-success border-success/30 hover:bg-success/10'
                      }`}
                    >
                      #{dh.noteNumber} ({fmtQty(dh.quantity)})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-sm font-bold text-success">
              {fmtQty(relevantDn ? relevantDn.quantity : receivedQty)} {item.unit || t('lineItems.unit')}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ZoomableDocument
              fileUrl={dcFileUrl}
              label={dcLabel}
              onOpenFull={dcFileUrl ? () => onOpenDocument(dcFileUrl) : undefined}
            />
          </div>
        </div>
      </div>

      {/* Delivery history footer */}
      {item.deliveryHistory.length > 0 && (
        <div className="px-6 py-3 bg-base-100 border-t border-base-300">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">{t('discrepancy.deliveryHistory')}</span>
            <div className="flex gap-2 flex-wrap">
              {item.deliveryHistory.map((dh, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDnIndex(i)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    i === selectedDnIndex
                      ? 'border-success/40 bg-success/10 ring-1 ring-success/20'
                      : dh.fileUrl
                        ? 'border-base-300 bg-base-100 hover:bg-base-200 cursor-pointer'
                        : 'border-base-300 bg-base-200 cursor-default'
                  }`}
                >
                  <span className="text-base-content">{t('discrepancy.dnLabel', { number: dh.noteNumber })}</span>
                  <span className="text-base-content/40 mx-1">|</span>
                  <span className="text-base-content/50">{fmtQty(dh.quantity)} {item.unit || t('lineItems.unit')}</span>
                  {dh.date && (
                    <>
                      <span className="text-base-content/40 mx-1">|</span>
                      <span className="text-base-content/40">{new Date(dh.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ZoomableDocument({
  fileUrl,
  label,
  onOpenFull,
}: {
  fileUrl: string | null;
  label: string;
  onOpenFull?: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;
    setLoading(true);
    filesService
      .getPageUrl(fileUrl, 0)
      .then((url) => {
        objectUrlRef.current = url;
        setThumbnailUrl(url);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [fileUrl]);

  const { t } = useTranslation('projects');

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-base-content/40">
        <p className="text-sm">{t('discrepancy.noDocument')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Zoom controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200">
        <span className="text-sm text-base-content/60">{label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded hover:bg-base-300 text-base-content/50"
            title={t('discrepancy.shrink')}
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-base-content/40 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 rounded hover:bg-base-300 text-base-content/50"
            title={t('discrepancy.enlarge')}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded hover:bg-base-300 text-base-content/50"
            title={t('discrepancy.resetZoom')}
          >
            <RotateCcw size={14} />
          </button>
          {onOpenFull && (
            <button
              onClick={onOpenFull}
              className="mr-2 text-xs text-primary hover:underline"
            >
              {t('discrepancy.openFullDoc')}
            </button>
          )}
        </div>
      </div>

      {/* Document area */}
      <div className="flex-1 overflow-auto bg-base-200 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-base-content/30" />
          </div>
        ) : thumbnailUrl ? (
          <div className="flex justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
            <img
              src={thumbnailUrl}
              alt={label}
              className="rounded shadow-sm border border-base-300 max-w-full"
              onClick={onOpenFull}
              style={{ cursor: onOpenFull ? 'pointer' : 'default' }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-base-content/40">
            <p className="text-sm">{t('discrepancy.cannotLoadPreview')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
