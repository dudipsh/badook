import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../lib/store-context';
import { NewProjectModal } from '../shared/NewProjectModal';
import { ProjectNavItem } from './ProjectNavItem';

export const SidebarProjectsList = observer(() => {
  const navigate = useNavigate();
  const { id: activeProjectId } = useParams();
  const { projectsStore } = useStores();
  const { t } = useTranslation('projects');
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">
          {t('sidebar.identifiedProjects')}
        </span>
        <button
          onClick={() => setShowNewProject(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors"
          title={t('sidebar.newProjectTooltip')}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5">
        {projectsStore.projects.map((project) => (
          <ProjectNavItem
            key={project.id}
            name={project.name}
            isActive={activeProjectId === project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
          />
        ))}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
});
