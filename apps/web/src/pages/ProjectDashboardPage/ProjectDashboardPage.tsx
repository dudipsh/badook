import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';
import { StatCardsRow } from './components/StatCardsRow';
import { VendorListPanel } from './components/VendorListPanel';
import { LineItemsPanel } from './components/LineItemsPanel';
import { ProjectHeader } from './components/ProjectHeader';
import { ArchivedBanner } from './components/ArchivedBanner';
import { DashboardModals } from './components/DashboardModals';
import { useProjectData } from './hooks/useProjectData';
import { useDashboardActions } from './hooks/useDashboardActions';

export const ProjectDashboardPage = observer(() => {
  const { t } = useTranslation('projects');
  const { id, vendorId, groupBy } = useParams<{ id: string; vendorId?: string; groupBy?: string }>();
  const { projectDashboardStore } = useStores();
  useProjectData(id, vendorId, groupBy);

  const { project, stats, loading } = projectDashboardStore;
  const actions = useDashboardActions(project?.id ?? '');

  if (loading && !project) {
    return <div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg text-base-content/40" /></div>;
  }
  if (!project) {
    return <div className="text-center py-12"><p className="text-base-content/50">{t('dashboard.projectNotFound')}</p></div>;
  }

  const isArchived = (project as any).isArchived;

  return (
    <div className="flex flex-col h-full overflow-hidden px-2 sm:px-0">
      {isArchived && <ArchivedBanner onRestore={actions.handleRestore} />}
      <ProjectHeader project={project} isArchived={isArchived} onAction={(type) => actions.handleHeaderAction(type, project)} />
      <div className="shrink-0"><StatCardsRow stats={stats} loading={loading} /></div>
      <div className="flex-1 flex gap-3 bg-base-200/60 rounded-xl overflow-hidden min-h-0 mt-3">
        <div className="hidden md:flex"><VendorListPanel /></div>
        <LineItemsPanel onVendorAction={actions.handleVendorAction} onUpload={actions.openUpload} />
      </div>
      <DashboardModals
        projectId={project.id} projectName={project.name} projectAddress={project.address || ''}
        showEditModal={actions.showEditModal} showMergeModal={actions.showMergeModal} showArchiveConfirm={actions.showArchiveConfirm}
        showUploadModal={actions.showUploadModal} uploadDocType={actions.uploadDocType} modalConfig={actions.modalConfig}
        onCloseEdit={() => actions.setShowEditModal(false)} onCloseMerge={() => actions.setShowMergeModal(false)}
        onCloseArchive={() => actions.setShowArchiveConfirm(false)} onCloseUpload={() => actions.setShowUploadModal(false)}
        onCloseEntityModal={() => actions.setModalConfig({ ...actions.modalConfig, isOpen: false })}
        onEditSave={actions.handleEditSave} onMerge={actions.handleMerge} onArchive={actions.handleArchive}
      />
    </div>
  );
});
