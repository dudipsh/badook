import { useTranslation } from 'react-i18next';
import { X, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useCreatePOForm } from './useCreatePOForm';
import { CreatePOFormLeft } from './CreatePOFormLeft';
import { PODocumentViewer } from './PODocumentViewer';

interface CreatePOModalProps {
  onClose: () => void;
}

export const CreatePOModal = ({ onClose }: CreatePOModalProps) => {
  const { t } = useTranslation('projects');
  const form = useCreatePOForm(onClose);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-base-300 bg-base-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-secondary" />
            <h2 className="text-lg font-bold text-base-content">{t('createPO.title')}</h2>
          </div>
          {form.poNumber && (
            <span className="text-xs font-mono text-secondary border border-secondary/30 bg-secondary/10 px-2 py-0.5 rounded">
              {form.poNumber}
            </span>
          )}
          {form.isExtracted && (
            <span className="inline-flex items-center gap-1.5 bg-success/10 text-success text-xs font-medium px-2.5 py-1 rounded-full">
              <Sparkles size={12} />
              {t('createPO.aiExtracted')}
            </span>
          )}
        </div>
        <button
          onClick={() => form.onSubmitClick(false)}
          disabled={form.submitting || !form.vendorName.trim()}
          className="btn btn-sm btn-primary inline-flex items-center gap-2 disabled:opacity-50 rounded-[.5rem]"
        >
          {form.submitting && <Loader2 size={14} className="animate-spin" />}
          {t('createPO.sendOrder')}
        </button>
      </div>

      {/* Content (50/50 split layout) */}
      <div className="flex flex-1 overflow-hidden">
        <CreatePOFormLeft form={form} />
        <PODocumentViewer
          uploadedFile={form.uploadedFile}
          fileUrl={form.fileUrl}
          localPreviewUrl={form.localPreviewUrl}
          isExtracting={form.isExtracting}
          isExtracted={form.isExtracted}
          zoom={form.zoom}
          isDragging={form.isDragging}
          onZoomChange={form.setZoom}
          onDragStateChange={form.setIsDragging}
          onFileSelect={form.handleFileSelect}
          onRemoveFile={form.resetFile}
          fileInputRef={form.fileInputRef}
        />
      </div>

      {/* Duplicate PO warning — non-blocking */}
      {form.duplicatePO && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={form.dismissDuplicate} />
          <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-md" dir="rtl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-base-content">{t('createPO.duplicateTitle')}</h3>
                <p className="text-sm text-base-content/50 mt-1">{t('createPO.duplicateMessage')}</p>
                <div className="mt-3 bg-base-200 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-base-content/50">{t('createPO.orderNumber')}</span>
                    <span className="font-medium text-base-content font-mono">{form.duplicatePO.poNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/50">{t('createPO.supplierName')}</span>
                    <span className="font-medium text-base-content">{form.duplicatePO.supplierName}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={form.dismissDuplicate}
                className="btn btn-neutral btn-sm"
              >
                {t('createPO.understood')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No-project confirmation dialog */}
      {form.pendingSubmitAsDraft !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => form.setPendingSubmitAsDraft(null)} />
          <div className="relative bg-base-100 rounded-xl shadow-xl p-6 w-full max-w-md" dir="rtl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-base-content">{t('createPO.noProjectConfirmTitle')}</h3>
                <p className="text-sm text-base-content/50 mt-1">{t('createPO.noProjectConfirmMessage')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => form.setPendingSubmitAsDraft(null)}
                className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors"
              >
                {t('createPO.goBack')}
              </button>
              <button
                onClick={() => { form.handleSubmit(false); form.setPendingSubmitAsDraft(null); }}
                className="btn btn-warning btn-sm"
              >
                {t('createPO.continueWithoutProject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
