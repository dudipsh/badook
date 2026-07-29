import { makeAutoObservable, runInAction } from 'mobx';
import { projectsService, type Project, type ProjectFullDetails } from '../services/projects.service';
import type { ProjectStats } from '../types/reconciliation';

export class ProjectsStore {
  projects: Project[] = [];
  currentProject: Project | null = null;
  fullDetails: ProjectFullDetails | null = null;
  projectNotes: any[] = [];
  loading = false;
  showArchived = false;
  projectStats: Map<string, ProjectStats> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  setShowArchived(show: boolean) {
    this.showArchived = show;
    this.fetchProjects();
  }

  get activeProjects() {
    return this.projects.filter((p) => !p.isArchived);
  }

  get archivedProjects() {
    return this.projects.filter((p) => p.isArchived);
  }

  async fetchProjects() {
    this.loading = true;
    try {
      const data = await projectsService.getAll(this.showArchived);
      runInAction(() => { this.projects = data; });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async fetchProject(id: string) {
    this.loading = true;
    try {
      const [project, notes] = await Promise.all([
        projectsService.getOne(id),
        projectsService.getDeliveryNotes(id),
      ]);
      runInAction(() => {
        this.currentProject = project;
        this.projectNotes = notes;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async fetchProjectFull(id: string) {
    this.loading = true;
    try {
      const data = await projectsService.getFullDetails(id);
      runInAction(() => {
        this.currentProject = data.project;
        this.fullDetails = data;
        this.projectNotes = data.deliveryNotes;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async createProject(data: Partial<Project>) {
    const project = await projectsService.create(data);
    runInAction(() => { this.projects.push(project); });
    return project;
  }

  async updateProject(id: string, data: Partial<Project>) {
    const updated = await projectsService.update(id, data);
    runInAction(() => {
      this.projects = this.projects.map((p) => (p.id === id ? updated : p));
    });
  }

  async deleteProject(id: string) {
    await projectsService.delete(id);
    runInAction(() => {
      this.projects = this.projects.filter((p) => p.id !== id);
    });
  }

  async archiveProject(id: string, isArchived: boolean) {
    const updated = await projectsService.update(id, { isArchived } as any);
    runInAction(() => {
      this.projects = this.projects.map((p) => (p.id === id ? updated : p));
    });
  }

  async mergeProjects(targetId: string, sourceId: string, addressesToInclude?: string[]) {
    await projectsService.merge(targetId, sourceId, addressesToInclude);
    await this.fetchProjects();
  }

  async loadAllProjectStats() {
    const projects = this.projects;
    const statsPromises = projects.map(async (p) => {
      try {
        const stats = await projectsService.getStats(p.id);
        runInAction(() => {
          this.projectStats.set(p.id, stats);
        });
      } catch {
        // silently skip
      }
    });
    await Promise.all(statsPromises);
  }
}
