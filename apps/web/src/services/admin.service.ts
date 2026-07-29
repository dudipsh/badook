import { apiClient } from './api-client';

export interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
  byOperation: Record<string, { calls: number; tokens: number; cost: number }>;
}

export interface FeedbackItem {
  id: string;
  descriptionA: string;
  descriptionB: string;
  catalogNumberA: string | null;
  catalogNumberB: string | null;
  sourceDocType: string;
  targetDocType: string;
  createdBy: { name: string };
  createdAt: string;
}

export interface PaginatedFeedback {
  data: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemStats {
  deliveryNotes: number;
  purchaseOrders: number;
  invoices: number;
  suppliers: number;
  matches: number;
  feedbacks: number;
}

export interface CompanySettings {
  maxUploadSizeMb: number;
  defaultVatRate: number;
}

export type ChatProvider = 'OPENAI' | 'GEMINI';

export interface ChatAgent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  provider: ChatProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  hasTools: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAgentInput {
  name: string;
  description?: string | null;
  systemPrompt: string;
  provider?: ChatProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  hasTools?: boolean;
  isEnabled?: boolean;
}

export interface AgentPromptItem {
  agentType: 'INTAKE' | 'EXTRACTION' | 'MATCHING';
  promptKey: string;
  name: string;
  description: string;
  promptText: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  email: string | null;
  businessId: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  _count: { users: number };
}

export interface CompanyOverview {
  company: { id: string; name: string; email: string | null; businessId: string | null; createdAt: string };
  counts: {
    users: number;
    projects: number;
    deliveryNotes: number;
    purchaseOrders: number;
    invoices: number;
    suppliers: number;
    matches: number;
    feedbacks: number;
  };
  ai: { calls: number; tokens: number; costUsd: number };
}

export interface TrainingExportSummary {
  companyId: string;
  companyName: string;
  totals: { deliveryNotes: number; invoices: number; purchaseOrders: number };
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  companyId: string | null;
  createdAt: string;
}

export interface ImpersonateResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string; companyId: string | null; language: string };
}

export interface LoginEvent {
  id: string;
  userId: string | null;
  email: string;
  provider: string;
  success: boolean;
  impersonatedById: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string | null;
  impersonatedByName: string | null;
}

export interface PaginatedLoginEvents {
  data: LoginEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GlobalUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  companyId: string | null;
  company: { name: string } | null;
  createdAt: string;
}

export type SystemMessageLevel = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SystemMessage {
  id: string;
  title: string;
  body: string;
  level: SystemMessageLevel;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemMessageInput {
  title: string;
  body: string;
  level?: SystemMessageLevel;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface AdminJob {
  id: string;
  companyId: string;
  company: { name: string };
  fileName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  stage: string | null;
  stageStatus: string | null;
  stageMessage: string | null;
  documentId: string | null;
  documentType: string | null;
  errorMessage: string | null;
  projectId: string | null;
  createdAt: string;
}

export interface DiagnosticsData {
  companyId: string;
  ocrProvider: 'OPENAI' | 'GEMINI' | 'GEMINI_FINETUNED';
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    nodeEnv: string;
    uptime: number;
  };
  dependencies: {
    mupdf: string;
    sharp: string;
  };
  apiKeys: {
    geminiConfigured: boolean;
    openaiConfigured: boolean;
  };
  infrastructure: {
    redisConfigured: boolean;
    s3Configured: boolean;
    s3Bucket: string | null;
  };
  prompts: {
    templatesDir: string;
    templatesDirExists: boolean;
    filesOnDisk: Array<{ path: string; hash: string; size: number }>;
    filesOnDiskCount: number;
    loadedInMemory: Array<{ agentType: string; promptKey: string; name: string; hash: string; length: number }>;
    loadedInMemoryCount: number;
  };
}

export const adminService = {
  getUsageStats() {
    return apiClient.get<UsageStats>('/admin/usage-stats').then((r) => r.data);
  },
  getFeedback(page = 1, limit = 50) {
    return apiClient.get<PaginatedFeedback>('/admin/feedback', { params: { page, limit } }).then((r) => r.data);
  },
  updateFeedback(id: string, dto: { descriptionA?: string; descriptionB?: string; catalogNumberA?: string; catalogNumberB?: string }) {
    return apiClient.patch(`/admin/feedback/${id}`, dto).then((r) => r.data);
  },
  deleteFeedback(id: string) {
    return apiClient.delete(`/admin/feedback/${id}`).then((r) => r.data);
  },
  getSystemStats() {
    return apiClient.get<SystemStats>('/admin/system-stats').then((r) => r.data);
  },
  getCompanySettings() {
    return apiClient.get<CompanySettings>('/admin/company-settings').then((r) => r.data);
  },
  updateCompanySettings(dto: Partial<CompanySettings>) {
    return apiClient.patch<CompanySettings>('/admin/company-settings', dto).then((r) => r.data);
  },
  getPrompts() {
    return apiClient.get<AgentPromptItem[]>('/prompts').then((r) => r.data);
  },
  listCompanies() {
    return apiClient.get<CompanyListItem[]>('/admin/companies').then((r) => r.data);
  },
  getCompanyStats(companyId: string) {
    return apiClient.get<CompanyOverview>(`/admin/companies/${companyId}/stats`).then((r) => r.data);
  },
  resetCompanyData(companyId: string, deleteFeedback = false) {
    return apiClient
      .post(`/admin/companies/${companyId}/reset`, {}, { params: { deleteFeedback } })
      .then((r) => r.data);
  },
  exportCompanyToTrainingLab(companyId: string) {
    return apiClient
      .post<TrainingExportSummary>(`/admin/companies/${companyId}/export-to-training-lab`)
      .then((r) => r.data);
  },
  createCompany(dto: { name: string; email?: string; businessId?: string }) {
    return apiClient.post<CompanyListItem>('/admin/companies', dto).then((r) => r.data);
  },
  deleteCompany(id: string) {
    return apiClient.delete<{ id: string }>(`/admin/companies/${id}`).then((r) => r.data);
  },
  createCompanyUser(companyId: string, dto: { email: string; name: string; role?: string }) {
    return apiClient.post(`/admin/companies/${companyId}/users`, dto).then((r) => r.data);
  },
  deleteCompanyUser(companyId: string, userId: string) {
    return apiClient.delete<{ id: string }>(`/admin/companies/${companyId}/users/${userId}`).then((r) => r.data);
  },
  listCompanyUsers(companyId: string) {
    return apiClient.get<CompanyUser[]>(`/admin/companies/${companyId}/users`).then((r) => r.data);
  },
  updateCompanyUser(companyId: string, userId: string, dto: { name?: string; email?: string; role?: string }) {
    return apiClient.patch<CompanyUser>(`/admin/companies/${companyId}/users/${userId}`, dto).then((r) => r.data);
  },
  getJobs(companyId?: string, limit = 50) {
    return apiClient.get<AdminJob[]>('/admin/jobs', { params: { companyId, limit } }).then((r) => r.data);
  },
  cancelCompanyJobs(companyId: string) {
    return apiClient.post<{ cancelled: number }>(`/admin/jobs/${companyId}/cancel`).then((r) => r.data);
  },
  getDiagnostics() {
    return apiClient.get<DiagnosticsData>('/admin/diagnostics').then((r) => r.data);
  },
  resetAllData(deleteFeedback = false) {
    return apiClient.post('/delivery-notes/reset', {}, { params: { deleteFeedback } }).then((r) => r.data);
  },
  deleteAllMatches(deleteFeedback = false) {
    return apiClient.delete('/matching/all', { params: { deleteFeedback } }).then((r) => r.data);
  },
  listChatAgents() {
    return apiClient.get<ChatAgent[]>('/admin/chat-agents').then((r) => r.data);
  },
  createChatAgent(dto: ChatAgentInput) {
    return apiClient.post<ChatAgent>('/admin/chat-agents', dto).then((r) => r.data);
  },
  updateChatAgent(id: string, dto: Partial<ChatAgentInput>) {
    return apiClient.patch<ChatAgent>(`/admin/chat-agents/${id}`, dto).then((r) => r.data);
  },
  deleteChatAgent(id: string) {
    return apiClient.delete(`/admin/chat-agents/${id}`).then((r) => r.data);
  },
  setDefaultChatAgent(id: string) {
    return apiClient.post(`/admin/chat-agents/${id}/set-default`).then((r) => r.data);
  },
  impersonate(userId: string) {
    return apiClient.post<ImpersonateResponse>(`/admin/impersonate/${userId}`).then((r) => r.data);
  },
  listSuperAdmins() {
    return apiClient.get<SuperAdmin[]>('/admin/super-admins').then((r) => r.data);
  },
  createSuperAdmin(dto: { email: string; name: string }) {
    return apiClient.post<SuperAdmin>('/admin/super-admins', dto).then((r) => r.data);
  },
  deleteSuperAdmin(id: string) {
    return apiClient.delete<{ id: string }>(`/admin/super-admins/${id}`).then((r) => r.data);
  },
  getLoginEvents(page = 1, limit = 50) {
    return apiClient.get<PaginatedLoginEvents>('/admin/login-events', { params: { page, limit } }).then((r) => r.data);
  },
  searchUsers(q: string) {
    return apiClient.get<GlobalUser[]>('/admin/users/search', { params: { q } }).then((r) => r.data);
  },
  listSystemMessages() {
    return apiClient.get<SystemMessage[]>('/admin/system-messages').then((r) => r.data);
  },
  getActiveSystemMessages() {
    return apiClient.get<SystemMessage[]>('/admin/system-messages/active').then((r) => r.data);
  },
  createSystemMessage(dto: SystemMessageInput) {
    return apiClient.post<SystemMessage>('/admin/system-messages', dto).then((r) => r.data);
  },
  updateSystemMessage(id: string, dto: Partial<SystemMessageInput>) {
    return apiClient.patch<SystemMessage>(`/admin/system-messages/${id}`, dto).then((r) => r.data);
  },
  deleteSystemMessage(id: string) {
    return apiClient.delete<{ id: string }>(`/admin/system-messages/${id}`).then((r) => r.data);
  },
};
