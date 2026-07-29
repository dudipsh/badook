import { apiClient } from './api-client';

export interface TestCaseSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  hasMocks: boolean;
  documentCount: number;
  lastRun?: {
    status: 'passed' | 'failed' | 'error';
    mode: 'live' | 'mock';
    completedAt: string;
    passedCount: number;
    failedCount: number;
  };
}

export interface AssertionResult {
  name: string;
  expected: any;
  actual: any;
  passed: boolean;
  category: string;
}

export interface TestRunResult {
  runId: string;
  caseId: string;
  caseName: string;
  mode: 'live' | 'mock';
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  duration: number;
  assertions: AssertionResult[];
  error?: string;
}

export const testingService = {
  listCases() {
    return apiClient.get<TestCaseSummary[]>('/testing/cases').then((r) => r.data);
  },
  getCase(id: string) {
    return apiClient.get(`/testing/cases/${id}`).then((r) => r.data);
  },
  runLive(id: string) {
    return apiClient.post<TestRunResult>(`/testing/cases/${id}/run-live`).then((r) => r.data);
  },
  runMock(id: string) {
    return apiClient.post<TestRunResult>(`/testing/cases/${id}/run-mock`).then((r) => r.data);
  },
  runAllMocks() {
    return apiClient.post<TestRunResult[]>('/testing/run-all-mocks').then((r) => r.data);
  },
  generateMocks(id: string) {
    return apiClient.post<{ generated: number; documents: string[] }>(`/testing/cases/${id}/generate-mocks`).then((r) => r.data);
  },
  getResults(limit = 50) {
    return apiClient.get<TestRunResult[]>('/testing/results', { params: { limit } }).then((r) => r.data);
  },
};
