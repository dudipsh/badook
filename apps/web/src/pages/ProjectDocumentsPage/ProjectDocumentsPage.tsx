import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import toast from 'react-hot-toast';
import { useStores } from '../../lib/store-context';
import { projectsService } from '../../services/projects.service';
import { DocumentViewerModal } from '../../components/shared/DocumentViewerModal';
import { UploadDocumentModal } from '../ProjectDashboardPage/components/UploadDocumentModal';
import { AgentProgressBar } from './components/AgentProgressBar';
import { DocPageHeader } from './components/DocPageHeader';
import { DocTableContent } from './components/DocTableContent';
import { DocumentSuccessModal } from './components/DocumentSuccessModal';
import { DuplicateConflictModal } from './components/DuplicateConflictModal';
import { useDocumentUpload } from './hooks/useDocumentUpload';
import type { DocItem } from './components/DocumentTable';
import type { DocType } from '../../types/reconciliation';

type DocTab = 'delivery-notes' | 'purchase-orders' | 'invoices';

const DOC_TYPE_MAP: Record<string, DocType> = {
  deliveryNote: 'DC',
  purchaseOrder: 'PO',
  invoice: 'INVOICE',
};

export const ProjectDocumentsPage = observer(() => {
  const { t } = useTranslation('projects');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projectsStore } = useStores();
  const [activeTab, setActiveTab] = useState<DocTab>('delivery-notes');
  const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<DocItem | null>(null);
  const [highlightTab, setHighlightTab] = useState<DocTab | null>(null);

  const handleViewDocument = useCallback((fileUrl: string) => setViewerFilePath(fileUrl), []);

  const upload = useDocumentUpload(id);

  useEffect(() => {
    if (id) projectsStore.fetchProjectFull(id);
  }, [id, projectsStore]);

  const details = projectsStore.fullDetails;

  const DOC_TYPE_TO_TAB: Record<string, DocTab> = {
    deliveryNote: 'delivery-notes',
    purchaseOrder: 'purchase-orders',
    invoice: 'invoices',
  };

  // Show orange badge on the tab that received a new document (clears on tab click)
  useEffect(() => {
    if (upload.completedDocType) {
      const targetTab = DOC_TYPE_TO_TAB[upload.completedDocType];
      if (targetTab && targetTab !== activeTab) {
        setHighlightTab(targetTab);
      }
    }
  }, [upload.completedDocType]);

  const tabs = [
    { key: 'delivery-notes', label: t('documents.deliveryNotes', 'תעודות משלוח'), count: details?.deliveryNotes?.length ?? 0 },
    { key: 'purchase-orders', label: t('documents.purchaseOrders', 'הזמנות רכש'), count: details?.purchaseOrders?.length ?? 0 },
    { key: 'invoices', label: t('documents.invoices', 'חשבוניות'), count: details?.invoices?.length ?? 0 },
  ];

  const handleEditDocument = useCallback((item: DocItem) => {
    setEditDoc(item);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditDoc(null);
    if (id) {
      projectsStore.fetchProjectFull(id);
      projectsService.checkReconciliation(id).catch(() => {});
    }
  }, [id, projectsStore]);

  const handleDeleteDocument = useCallback(async (item: DocItem) => {
    if (!confirm(t('documents.confirmDelete'))) return;
    try {
      await projectsService.removeDocument(item.id, item.docType);
      toast.success(t('documents.deleteSuccess'));
      if (id) {
        projectsStore.fetchProjectFull(id);
        projectsService.checkReconciliation(id).catch(() => {});
      }
    } catch {
      toast.error(t('documents.deleteError'));
    }
  }, [id, projectsStore, t]);

  return (
    <div className="p-3 h-[calc(100vh-48px)] flex flex-col bg-base-200/50 gap-0">
      <input
        ref={upload.fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => upload.handleUpload(e.target.files)}
      />

      <div className="flex-1 bg-base-100 rounded-box border border-base-200 shadow-lg flex flex-col min-h-0">
        <DocPageHeader
          projectName={details?.project?.name}
          uploading={upload.uploading}
          onBack={() => navigate(`/projects/${id}`)}
          onUploadClick={() => {
            if (upload.fileInputRef.current) {
              upload.fileInputRef.current.click();
            }
          }}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(key) => { setActiveTab(key as DocTab); if (key === highlightTab) setHighlightTab(null); }}
          highlightTab={highlightTab}
        />

        {(upload.uploading || upload.jobCompleted) && upload.agentStages && (
          <div className="px-6 py-2 border-b border-base-200">
            <AgentProgressBar stages={upload.agentStages} jobCompleted={upload.jobCompleted} />
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0">
          <DocTableContent
            activeTab={activeTab}
            details={details}
            loading={projectsStore.loading}
            onView={handleViewDocument}
            onEdit={handleEditDocument}
            onDelete={handleDeleteDocument}
          />
        </div>
      </div>

      <DocumentViewerModal
        filePath={viewerFilePath}
        onClose={() => setViewerFilePath(null)}
      />
      {upload.duplicateConflict && (
        <DuplicateConflictModal
          message={upload.duplicateConflict.message}
          onCancel={() => upload.setDuplicateConflict(null)}
          onOverwrite={upload.handleForceOverwrite}
        />
      )}

      {upload.successInfo && (
        <DocumentSuccessModal
          info={upload.successInfo}
          onClose={() => upload.setSuccessInfo(null)}
          onForceReupload={upload.handleDuplicateForceReupload}
        />
      )}

      {editDoc && (
        <UploadDocumentModal
          isOpen={!!editDoc}
          onClose={handleEditClose}
          docType={DOC_TYPE_MAP[editDoc.docType] ?? 'DC'}
          editMode
          editDocumentId={editDoc.id}
          editDocumentType={editDoc.docType}
          externalProjectId={id}
          showProjectSelector
        />
      )}
    </div>
  );
});
