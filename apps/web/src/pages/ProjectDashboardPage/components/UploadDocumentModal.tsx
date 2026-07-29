import { useTranslation } from 'react-i18next';
import { X, FileSpreadsheet, Loader2, CheckCircle2, Save, Sparkles, AlertTriangle } from 'lucide-react';
import { useUploadDocumentForm } from '../hooks/useUploadDocumentForm';
import { UploadFormLeft } from './UploadFormLeft';
import { PODocumentViewer } from '../../OverviewPage/components/PODocumentViewer';
import type { DocType } from '../../../types/reconciliation';
import type { OrphanedDoc } from '../../../types/orphan';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docType: DocType;
  orphanDoc?: OrphanedDoc;
  externalProjectId?: string;
  showProjectSelector?: boolean;
  onOrphanSuccess?: () => void;
  editMode?: boolean;
  editDocumentId?: string;
  editDocumentType?: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}

const TITLE_MAP: Record<DocType, string> = {
  PO: 'header.purchaseOrders',
  DC: 'header.deliveryNotes',
  INVOICE: 'header.invoices',
};

export const UploadDocumentModal = ({ isOpen, onClose, docType, orphanDoc, externalProjectId, showProjectSelector, onOrphanSuccess, editMode, editDocumentId, editDocumentType }: Props) => {
  const { t } = useTranslation('projects');
  const form = useUploadDocumentForm({ docType, onClose, isOpen, orphanDoc, externalProjectId, showProjectSelector, onOrphanSuccess, editMode, editDocumentId, editDocumentType });

  const canSubmit = form.submitStatus === 'idle'
    && !form.duplicateWarning
    && (form.editMode || form.isOrphanFlow ? !!form.fileUrl : !!form.uploadedFile)
    && (!form.showProjectSelector || !!form.selectedProjectId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-base-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-base-300 bg-base-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors" disabled={form.submitStatus === 'uploading'}>
            <X size={20} />
          </button>
          <FileSpreadsheet size={20} className="text-secondary" />
          <h2 className="text-lg font-bold text-base-content" dir="auto">
            {editMode ? t('documents.editDocument') : t('upload.title')} - {t(TITLE_MAP[docType])}
          </h2>
          {form.docNumber && <span className="text-xs font-mono text-secondary border border-secondary/30 bg-secondary/10 px-2 py-0.5 rounded">{form.docNumber}</span>}
          {form.isExtracted && (
            <span className="inline-flex items-center gap-1.5 bg-success/10 text-success text-xs font-medium px-2.5 py-1 rounded-full">
              <Sparkles size={12} />
              {t('createPO.aiExtracted')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {form.duplicateWarning && (
            <span className="text-sm text-warning font-medium flex items-center gap-1 bg-warning/10 border border-warning/30 px-3 py-1 rounded-lg">
              <AlertTriangle size={14} /> {form.duplicateWarning}
            </span>
          )}
          {form.submitStatus === 'error' && (
            <span className="text-sm text-error font-medium flex items-center gap-1">
              <AlertTriangle size={14} /> {form.errorMessage}
            </span>
          )}
          <button onClick={form.handleSubmit} disabled={!canSubmit} className="btn btn-sm btn-primary gap-1 min-w-[140px]">
            {form.submitStatus === 'uploading'
              ? <><Loader2 size={14} className="animate-spin" /> {editMode ? t('upload.update') : t('upload.uploading')}</>
              : form.submitStatus === 'success'
              ? <><CheckCircle2 size={14} /> {t('upload.success')}</>
              : <><Save size={14} /> {editMode ? t('upload.saveChanges') : t('upload.save')}</>}
          </button>
        </div>
      </div>

      {/* Content (50/50 split) */}
      <div className="flex flex-1 overflow-hidden">
        <UploadFormLeft form={form} />
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
          docType={docType}
        />
      </div>
    </div>
  );
};
