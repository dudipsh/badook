import { makeAutoObservable, runInAction } from 'mobx';
import {
  adminService,
  type UsageStats,
  type FeedbackItem,
  type SystemStats,
  type CompanySettings,
  type AgentPromptItem,
  type ChatAgent,
  type ChatAgentInput,
} from '../services/admin.service';

export class AdminStore {
  usageStats: UsageStats | null = null;
  feedbackList: FeedbackItem[] = [];
  feedbackTotal = 0;
  feedbackPage = 1;
  feedbackTotalPages = 0;
  systemStats: SystemStats | null = null;
  companySettings: CompanySettings | null = null;
  prompts: AgentPromptItem[] = [];
  promptsLoading = false;
  chatAgents: ChatAgent[] = [];
  chatAgentsLoading = false;
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchAll(force = false) {
    if (!force && this.usageStats) return;
    this.loading = true;
    try {
      const [usage, feedback, stats, settings] = await Promise.all([
        adminService.getUsageStats(),
        adminService.getFeedback(this.feedbackPage),
        adminService.getSystemStats(),
        adminService.getCompanySettings(),
      ]);
      runInAction(() => {
        this.usageStats = usage;
        this.feedbackList = feedback.data;
        this.feedbackTotal = feedback.total;
        this.feedbackTotalPages = feedback.totalPages;
        this.systemStats = stats;
        this.companySettings = settings;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async fetchFeedback(page = 1) {
    this.loading = true;
    try {
      const result = await adminService.getFeedback(page);
      runInAction(() => {
        this.feedbackList = result.data;
        this.feedbackTotal = result.total;
        this.feedbackPage = result.page;
        this.feedbackTotalPages = result.totalPages;
      });
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  async updateFeedback(id: string, dto: { descriptionA?: string; descriptionB?: string; catalogNumberA?: string; catalogNumberB?: string }) {
    await adminService.updateFeedback(id, dto);
    await this.fetchFeedback(this.feedbackPage);
  }

  async deleteFeedback(id: string) {
    await adminService.deleteFeedback(id);
    await this.fetchFeedback(this.feedbackPage);
  }

  async fetchCompanySettings() {
    const settings = await adminService.getCompanySettings();
    runInAction(() => { this.companySettings = settings; });
  }

  async updateCompanySettings(dto: Partial<CompanySettings>) {
    const updated = await adminService.updateCompanySettings(dto);
    runInAction(() => { this.companySettings = updated; });
  }

  async fetchPrompts() {
    this.promptsLoading = true;
    try {
      const prompts = await adminService.getPrompts();
      runInAction(() => { this.prompts = prompts; });
    } finally {
      runInAction(() => { this.promptsLoading = false; });
    }
  }

  async resetAllData(deleteFeedback: boolean) {
    await adminService.resetAllData(deleteFeedback);
  }

  async deleteAllMatches(deleteFeedback: boolean) {
    await adminService.deleteAllMatches(deleteFeedback);
  }

  async fetchChatAgents() {
    this.chatAgentsLoading = true;
    try {
      const agents = await adminService.listChatAgents();
      runInAction(() => { this.chatAgents = agents; });
    } finally {
      runInAction(() => { this.chatAgentsLoading = false; });
    }
  }

  async createChatAgent(dto: ChatAgentInput) {
    const created = await adminService.createChatAgent(dto);
    await this.fetchChatAgents();
    return created;
  }

  async updateChatAgent(id: string, dto: Partial<ChatAgentInput>) {
    await adminService.updateChatAgent(id, dto);
    await this.fetchChatAgents();
  }

  async deleteChatAgent(id: string) {
    await adminService.deleteChatAgent(id);
    await this.fetchChatAgents();
  }

  async setDefaultChatAgent(id: string) {
    await adminService.setDefaultChatAgent(id);
    await this.fetchChatAgents();
  }
}
