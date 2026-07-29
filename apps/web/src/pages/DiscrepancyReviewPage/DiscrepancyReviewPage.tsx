import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { DocumentViewerModal } from '../../components/shared/DocumentViewerModal';
import { DiscrepancyCard } from './components/DiscrepancyCard';
import { fmtQty } from '../../lib/currencyUtils';

export const DiscrepancyReviewPage = observer(() => {
  const { t } = useTranslation('projects');
  const { id, lineItemId } = useParams<{ id: string; lineItemId: string }>();
  const navigate = useNavigate();
  const { projectDashboardStore } = useStores();
  const [docViewerPath, setDocViewerPath] = useState<string | null>(null);

  const item = projectDashboardStore.selectedLineItemForReview
    ?? projectDashboardStore.lineItems.find((li) => li.id === lineItemId)
    ?? null;

  // If no item data, try to load it
  useEffect(() => {
    if (!item && id && projectDashboardStore.projectId !== id) {
      projectDashboardStore.loadProject(id);
      projectDashboardStore.loadVendors(id);
    }
  }, [id, item, projectDashboardStore]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-base-content/30" />
        <p className="text-base-content/40 text-sm">{t('review.loadingItem')}</p>
        <button
          onClick={() => navigate(`/projects/${id}`)}
          className="text-sm text-primary hover:underline"
        >
          {t('review.backToProject')}
        </button>
      </div>
    );
  }

  const invoicedQty = item.invoicedAmount ?? item.orderedQty;
  const receivedQty = item.receivedQty;
  const gap = Math.abs(invoicedQty - receivedQty);
  const poDoc = item.relatedDocuments.find((d) => d.type === 'PO');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              projectDashboardStore.closeReview();
              const vendorId = projectDashboardStore.selectedVendorId;
              navigate(vendorId ? `/projects/${id}/vendors/${vendorId}` : `/projects/${id}`);
            }}
            className="inline-flex items-center gap-1.5 text-base-content/50 hover:text-base-content transition-colors"
          >
            <ArrowRight size={18} />
            <span className="text-sm">{t('review.backToProject')}</span>
          </button>
          <div className="h-6 w-px bg-base-300" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold flex items-baseline gap-1 min-w-0">
              {gap > 0 ? (
                <span className="text-error shrink-0">{t('review.gapDetected')}</span>
              ) : (
                <span className="text-success shrink-0">{t('review.matching')}</span>
              )}
              <span
                className="text-base-content truncate block max-w-[600px]"
                title={item.description}
              >
                {item.description}
              </span>
            </h1>
            <p className="text-xs text-base-content/40 mt-0.5">{t('review.invoiceVsDelivery')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {poDoc?.fileUrl && (
            <button
              onClick={() => setDocViewerPath(poDoc.fileUrl)}
              className="text-sm text-primary hover:underline transition-colors"
            >
              {t('review.viewPO')}
            </button>
          )}
          <button className="btn btn-neutral btn-sm gap-2">
            <span>{t('review.requestCreditNote')}</span>
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      <DiscrepancyCard
        item={item}
        onOpenDocument={(url) => setDocViewerPath(url)}
      />

      {/* Document viewer modal (for opening full documents) */}
      <DocumentViewerModal
        filePath={docViewerPath}
        onClose={() => setDocViewerPath(null)}
      />
    </div>
  );
});
