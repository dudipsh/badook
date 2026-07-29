import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';
import type { ActionType, EntityType } from '../../../components/shared/EntityActionsModal';
import type { DocType } from '../../../types/reconciliation';

export const useDashboardActions = (projectId: string) => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { projectDashboardStore, projectsStore } = useStores();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<DocType>('PO');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; entityType: EntityType; actionType: ActionType; entityId: string; entityName: string;
  }>({ isOpen: false, entityType: 'PROJECT', actionType: null, entityId: '', entityName: '' });

  const handleHeaderAction = (type: 'EDIT' | 'MERGE' | 'ARCHIVE' | 'DELETE', project: { id: string; name: string }) => {
    if (type === 'EDIT') setShowEditModal(true);
    else if (type === 'MERGE') setShowMergeModal(true);
    else if (type === 'ARCHIVE') setShowArchiveConfirm(true);
    else setModalConfig({ isOpen: true, entityType: 'PROJECT', actionType: 'DELETE', entityId: project.id, entityName: project.name });
  };

  const handleVendorAction = (type: 'MERGE' | 'DELETE') => {
    const vendor = projectDashboardStore.vendors.find((v) => v.id === projectDashboardStore.selectedVendorId);
    if (!vendor) return;
    setModalConfig({ isOpen: true, entityType: 'VENDOR', actionType: type, entityId: vendor.id, entityName: vendor.name });
  };

  const handleArchive = async () => {
    try { await projectsStore.archiveProject(projectId, true); toast.success(t('dashboard.archivedSuccess')); navigate('/'); }
    catch { toast.error(t('dashboard.archiveError')); }
  };

  const handleRestore = async () => {
    try { await projectsStore.archiveProject(projectId, false); toast.success(t('dashboard.restoredSuccess')); projectDashboardStore.loadProject(projectId); }
    catch { toast.error(t('dashboard.restoreError')); }
  };

  const handleEditSave = async (id: string, name: string, address: string) => {
    await projectsStore.updateProject(id, { name, address });
    projectDashboardStore.loadProject(id);
    toast.success(t('editProject.saveSuccess'));
  };

  const handleMerge = async (targetId: string, addressesToInclude: string[]) => {
    try { await projectsStore.mergeProjects(targetId, projectId, addressesToInclude); toast.success(t('dashboard.mergeSuccess')); setShowMergeModal(false); navigate(`/projects/${targetId}`); }
    catch { toast.error(t('dashboard.mergeError')); }
  };

  const openUpload = (docType: DocType) => { setUploadDocType(docType); setShowUploadModal(true); };

  return {
    showEditModal, showMergeModal, showArchiveConfirm, showUploadModal, uploadDocType, modalConfig,
    setShowEditModal, setShowMergeModal, setShowArchiveConfirm, setShowUploadModal, setModalConfig,
    handleHeaderAction, handleVendorAction, handleArchive, handleRestore, handleEditSave, handleMerge, openUpload,
  };
};
