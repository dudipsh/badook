import { apiClient } from './api-client';

export interface PairingItem {
  description: string;
  catalogNumber?: string;
  quantity: number;
  index: number;
}

export interface DiscrepancyPairingRow {
  matchId: string;
  pairingIndex: number;
  pairing: {
    matchSource: 'catalog' | 'ai' | 'ai_second_round' | 'feedback' | 'description';
    po?: PairingItem;
    dn?: PairingItem;
    inv?: PairingItem;
  };
  supplierName: string;
  projectName: string;
  projectId: string | null;
  discrepancies: Array<{
    field: string;
    description: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    poValue: string | null;
    dnValue: string | null;
    invValue: string | null;
  }>;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface PaginatedDiscrepancies {
  data: DiscrepancyPairingRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrainingFeedbackItem {
  id: string;
  descriptionA: string;
  descriptionB: string;
  catalogNumberA: string | null;
  catalogNumberB: string | null;
  sourceDocType: string;
  targetDocType: string;
  feedbackType: 'MANUAL' | 'APPROVED' | 'REJECTED';
  createdBy: { name: string };
  createdAt: string;
}

export interface PaginatedTrainingFeedback {
  data: TrainingFeedbackItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const trainingService = {
  getDiscrepancies(params: {
    page?: number;
    limit?: number;
    search?: string;
    projectId?: string;
    severity?: string;
  }) {
    return apiClient
      .get<PaginatedDiscrepancies>('/training/discrepancies', { params })
      .then((r) => r.data);
  },

  approvePairing(matchId: string, pairingIndex: number) {
    return apiClient
      .post(`/training/discrepancies/${matchId}/approve`, { pairingIndex })
      .then((r) => r.data);
  },

  rejectPairing(matchId: string, pairingIndex: number) {
    return apiClient
      .post(`/training/discrepancies/${matchId}/reject`, { pairingIndex })
      .then((r) => r.data);
  },

  editMapping(
    matchId: string,
    dto: {
      pairingIndex: number;
      descriptionA: string;
      descriptionB: string;
      catalogNumberA?: string;
      catalogNumberB?: string;
    },
  ) {
    return apiClient
      .post(`/training/discrepancies/${matchId}/edit-mapping`, dto)
      .then((r) => r.data);
  },

  getFeedback(params: {
    page?: number;
    limit?: number;
    search?: string;
    feedbackType?: string;
  }) {
    return apiClient
      .get<PaginatedTrainingFeedback>('/training/feedback', { params })
      .then((r) => r.data);
  },

  createFeedback(dto: {
    descriptionA: string;
    descriptionB: string;
    catalogNumberA?: string;
    catalogNumberB?: string;
    sourceDocType: string;
    targetDocType: string;
  }) {
    return apiClient.post('/training/feedback', dto).then((r) => r.data);
  },

  updateFeedback(
    id: string,
    dto: {
      descriptionA?: string;
      descriptionB?: string;
      catalogNumberA?: string;
      catalogNumberB?: string;
    },
  ) {
    return apiClient.patch(`/training/feedback/${id}`, dto).then((r) => r.data);
  },

  deleteFeedback(id: string) {
    return apiClient.delete(`/training/feedback/${id}`).then((r) => r.data);
  },
};
