import { AuthStore } from './auth.store';
import { ProjectsStore } from './projects.store';
import { DashboardStore } from './dashboard.store';
import { GmailStore } from './gmail.store';
import { OutlookStore } from './outlook.store';
import { MailboxesStore } from './mailboxes.store';
import { AdminStore } from './admin.store';
import { ProjectDashboardStore } from './project-dashboard.store';
import { TrainingStore } from './training.store';
import { JobsStore } from './jobs.store';
import { UsersStore } from './users.store';
import { OrphanStore } from './orphan.store';
import { WhatsAppStore } from './whatsapp.store';
import { SuperAdminStore } from './super-admin.store';
import { LanguageStore } from './language.store';
import { TestingStore } from './testing.store';
import { ThemeStore } from './theme.store';
import { ChatStore } from './chat.store';

export class RootStore {
  authStore: AuthStore;
  projectsStore: ProjectsStore;
  dashboardStore: DashboardStore;
  gmailStore: GmailStore;
  outlookStore: OutlookStore;
  mailboxesStore: MailboxesStore;
  adminStore: AdminStore;
  projectDashboardStore: ProjectDashboardStore;
  trainingStore: TrainingStore;
  jobsStore: JobsStore;
  usersStore: UsersStore;
  orphanStore: OrphanStore;
  whatsappStore: WhatsAppStore;
  superAdminStore: SuperAdminStore;
  languageStore: LanguageStore;
  testingStore: TestingStore;
  themeStore: ThemeStore;
  chatStore: ChatStore;

  constructor() {
    this.authStore = new AuthStore();
    this.projectsStore = new ProjectsStore();
    this.dashboardStore = new DashboardStore();
    this.gmailStore = new GmailStore();
    this.outlookStore = new OutlookStore();
    this.mailboxesStore = new MailboxesStore();
    this.adminStore = new AdminStore();
    this.projectDashboardStore = new ProjectDashboardStore();
    this.trainingStore = new TrainingStore();
    this.jobsStore = new JobsStore();
    this.usersStore = new UsersStore();
    this.orphanStore = new OrphanStore();
    this.whatsappStore = new WhatsAppStore();
    this.superAdminStore = new SuperAdminStore();
    this.languageStore = new LanguageStore();
    this.testingStore = new TestingStore();
    this.themeStore = new ThemeStore();
    this.chatStore = new ChatStore();
  }
}
