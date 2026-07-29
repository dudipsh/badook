import { observer } from 'mobx-react-lite';
import { ProjectCard, type ProjectActionType } from './ProjectCard';
import { EmptyProjectsState } from './EmptyProjectsState';
import { NewProjectPlaceholder } from './NewProjectPlaceholder';
import type { Project } from '../../../services/projects.service';

interface ProjectGridProps {
  projects: Project[];
  projectStats: Map<string, any>;
  isArchived: boolean;
  onProjectAction: (project: { id: string; name: string }, type: ProjectActionType) => void;
  onNewProject: () => void;
}

export const ProjectGrid = observer(({ projects, projectStats, isArchived, onProjectAction, onNewProject }: ProjectGridProps) => {
  if (projects.length === 0) {
    return <EmptyProjectsState isArchived={isArchived} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          stats={projectStats.get(project.id)}
          onAction={(type) => onProjectAction(project, type)}
        />
      ))}
      {!isArchived && <NewProjectPlaceholder onClick={onNewProject} />}
    </div>
  );
});
