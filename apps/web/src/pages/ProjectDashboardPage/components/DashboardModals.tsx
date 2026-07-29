import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';
import { DocumentViewerModal } from '../../../components/shared/DocumentViewerModal';
import { MergeProjectModal } from './MergeProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { EvidenceSlidePanel } from './EvidenceSlidePanel/EvidenceSlidePanel';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { EntityActionsModal, type ActionType, type EntityType } from '../../../components/shared/EntityActionsModal';
import { LineItemDetailDrawer } from './LineItemDetailDrawer';
import { MatchingLoaderModal } from '../../../components/shared/MatchingLoaderModal/MatchingLoaderModal';
import { UploadDocumentModal } from './UploadDocumentModal';
import { DeleteLineItemDrawer } from './DeleteLineItemDrawer';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { DocType } from '../../../types/reconciliation';

interface DashboardModalsProps {
  projectId: string; projectName: string; projectAddress: string;
  showEditModal: boolean; showMergeModal: boolean; showArchiveConfirm: boolean;
  showUploadModal: boolean; uploadDocType: DocType;
  modalConfig: { isOpen: boolean; entityType: EntityType; actionType: ActionType; entityId: string; entityName: string };
  onCloseEdit: () => void; onCloseMerge: () => void; onCloseArchive: () => void;
  onCloseUpload: () => void; onCloseEntityModal: () => void;
  onEditSave: (id: string, name: string, address: string) => Promise<void>;
  onMerge: (targetId: string, addresses: string[]) => Promise<void>;
  onArchive: () => Promise<void>;
}

export const DashboardModals = observer(({
  projectId, projectName, projectAddress,
  showEditModal, showMergeModal, showArchiveConfirm, showUploadModal, uploadDocType,
  modalConfig, onCloseEdit, onCloseMerge, onCloseArchive, onCloseUpload, onCloseEntityModal,
  onEditSave, onMerge, onArchive,
}: DashboardModalsProps) => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { projectDashboardStore, projectsStore } = useStores();
  const isProjectEntity = modalConfig.entityType === 'PROJECT';
  const targets = isProjectEntity
    ? projectsStore.projects.map((p) => ({ id: p.id, name: p.name }))
    : projectDashboardStore.vendors.map((v) => ({ id: v.id, name: v.name }));

  const handleMerge = async (targetId: string) => {
    if (isProjectEntity) { await projectsStore.mergeProjects(targetId, modalConfig.entityId); navigate(`/projects/${targetId}`); }
    else { await projectDashboardStore.mergeVendor(targetId, modalConfig.entityId); }
    toast.success(t('entityActions.mergeSuccess'));
  };

  const handleDelete = async () => {
    if (isProjectEntity) { await projectsStore.deleteProject(modalConfig.entityId); navigate('/'); }
    else { await projectDashboardStore.deleteVendor(modalConfig.entityId); }
    toast.success(t('entityActions.deleteSuccess'));
  };

  return (
    <>
      <MatchingLoaderModal />
      <DocumentViewerModal filePath={projectDashboardStore.documentViewerFilePath} onClose={() => projectDashboardStore.closeDocument()} />
      <EvidenceSlidePanel />
      <LineItemDetailDrawer />
      <EditProjectModal isOpen={showEditModal} onClose={onCloseEdit} projectId={projectId} initialName={projectName} initialAddress={projectAddress} onSave={onEditSave} />
      {showMergeModal && <MergeProjectModal currentProjectId={projectId} currentProjectName={projectName} onMerge={onMerge} onClose={onCloseMerge} />}
      {showArchiveConfirm && <ArchiveConfirmModal projectName={projectName} onConfirm={onArchive} onClose={onCloseArchive} />}
      <UploadDocumentModal isOpen={showUploadModal} onClose={onCloseUpload} docType={uploadDocType} />
      <DeleteLineItemDrawer />
      <DeleteConfirmModal />
      <EntityActionsModal isOpen={modalConfig.isOpen} onClose={onCloseEntityModal} config={{
        entityType: modalConfig.entityType, actionType: modalConfig.actionType,
        entityId: modalConfig.entityId, entityName: modalConfig.entityName,
        availableTargets: targets, onConfirmMerge: handleMerge, onConfirmDelete: handleDelete,
      }} />
    </>
  );
});
