import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../lib/store-context';
import { NewProjectModal } from '../../components/shared/NewProjectModal';
import { EntityActionsModal, type ActionType } from '../../components/shared/EntityActionsModal';
import { CreatePOModal } from './components/CreatePOModal';
import { OverviewHeader } from './components/OverviewHeader';
import { ProjectGrid } from './components/ProjectGrid';
import type { ProjectActionType } from './components/ProjectCard';

export const OverviewPage = observer(() => {
  const { t } = useTranslation('projects');
  const { projectsStore } = useStores();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; actionType: ActionType; entityId: string; entityName: string;
  }>({ isOpen: false, actionType: null, entityId: '', entityName: '' });

  useEffect(() => { projectsStore.setShowArchived(true); }, [projectsStore]);
  useEffect(() => { if (projectsStore.projects.length > 0) projectsStore.loadAllProjectStats(); }, [projectsStore.projects.length, projectsStore]);

  const handleProjectAction = async (project: { id: string; name: string }, type: ProjectActionType) => {
    if (type === 'ARCHIVE') {
      try { await projectsStore.archiveProject(project.id, true); toast.success(t('dashboard.archivedSuccess')); }
      catch { toast.error(t('dashboard.archiveError')); }
    } else if (type === 'RESTORE') {
      try { await projectsStore.archiveProject(project.id, false); toast.success(t('dashboard.restoredSuccess')); }
      catch { toast.error(t('dashboard.restoreError')); }
    } else {
      setModalConfig({ isOpen: true, actionType: type, entityId: project.id, entityName: project.name });
    }
  };

  if (projectsStore.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-base-300 border-t-primary" />
      </div>
    );
  }

  const displayProjects = viewMode === 'active' ? projectsStore.activeProjects : projectsStore.archivedProjects;

  return (
    <div>
      <OverviewHeader viewMode={viewMode} activeCount={projectsStore.activeProjects.length} archivedCount={projectsStore.archivedProjects.length} onChangeMode={setViewMode} onCreateOrder={() => setShowCreatePO(true)} />
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
      {showCreatePO && <CreatePOModal onClose={() => setShowCreatePO(false)} />}
      <ProjectGrid projects={displayProjects} projectStats={projectsStore.projectStats} isArchived={viewMode === 'archived'} onProjectAction={handleProjectAction} onNewProject={() => setShowNewProject(true)} />
      <EntityActionsModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        config={{
          entityType: 'PROJECT', actionType: modalConfig.actionType, entityId: modalConfig.entityId, entityName: modalConfig.entityName,
          availableTargets: projectsStore.projects.map((p) => ({ id: p.id, name: p.name })),
          onConfirmMerge: async (targetId) => { await projectsStore.mergeProjects(targetId, modalConfig.entityId); toast.success(t('entityActions.mergeSuccess')); },
          onConfirmDelete: async () => { await projectsStore.deleteProject(modalConfig.entityId); toast.success(t('entityActions.deleteSuccess')); },
        }}
      />
    </div>
  );
});
