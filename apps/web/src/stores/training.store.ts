import { makeAutoObservable, runInAction } from 'mobx';
import {
  trainingService,
  type DiscrepancyPairingRow,
  type TrainingFeedbackItem,
} from '../services/training.service';

export class TrainingStore {
  // Discrepancies
  discrepancies: DiscrepancyPairingRow[] = [];
  discrepancyPage = 1;
  discrepancyTotalPages = 0;
  discrepancyTotal = 0;
  discrepancySearch = '';
  discrepancySeverityFilter: string | null = null;
  discrepanciesLoading = false;

  // Feedback
  feedbackList: TrainingFeedbackItem[] = [];
  feedbackPage = 1;
  feedbackTotalPages = 0;
  feedbackTotal = 0;
  feedbackSearch = '';
  feedbackTypeFilter: string | null = null;
  feedbackLoading = false;

  // Active section
  activeSection: 'discrepancies' | 'feedback' = 'discrepancies';

  constructor() {
    makeAutoObservable(this);
  }

  setActiveSection(section: 'discrepancies' | 'feedback') {
    this.activeSection = section;
  }

  // --- Discrepancies ---

  setDiscrepancySearch(search: string) {
    this.discrepancySearch = search;
    this.fetchDiscrepancies(1);
  }

  setDiscrepancySeverityFilter(severity: string | null) {
    this.discrepancySeverityFilter = severity;
    this.fetchDiscrepancies(1);
  }

  async fetchDiscrepancies(page = 1) {
    this.discrepanciesLoading = true;
    try {
      const result = await trainingService.getDiscrepancies({
        page,
        limit: 20,
        search: this.discrepancySearch || undefined,
        severity: this.discrepancySeverityFilter || undefined,
      });
      runInAction(() => {
        this.discrepancies = result.data;
        this.discrepancyPage = result.page;
        this.discrepancyTotal = result.total;
        this.discrepancyTotalPages = result.totalPages;
      });
    } finally {
      runInAction(() => {
        this.discrepanciesLoading = false;
      });
    }
  }

  async approvePairing(matchId: string, pairingIndex: number) {
    await trainingService.approvePairing(matchId, pairingIndex);
    await this.fetchDiscrepancies(this.discrepancyPage);
  }

  async rejectPairing(matchId: string, pairingIndex: number) {
    await trainingService.rejectPairing(matchId, pairingIndex);
    await this.fetchDiscrepancies(this.discrepancyPage);
  }

  async editMapping(
    matchId: string,
    pairingIndex: number,
    descriptionA: string,
    descriptionB: string,
    catalogNumberA?: string,
    catalogNumberB?: string,
  ) {
    await trainingService.editMapping(matchId, {
      pairingIndex,
      descriptionA,
      descriptionB,
      catalogNumberA,
      catalogNumberB,
    });
    await this.fetchDiscrepancies(this.discrepancyPage);
  }

  // --- Feedback ---

  setFeedbackSearch(search: string) {
    this.feedbackSearch = search;
    this.fetchFeedback(1);
  }

  setFeedbackTypeFilter(feedbackType: string | null) {
    this.feedbackTypeFilter = feedbackType;
    this.fetchFeedback(1);
  }

  async fetchFeedback(page = 1) {
    this.feedbackLoading = true;
    try {
      const result = await trainingService.getFeedback({
        page,
        limit: 50,
        search: this.feedbackSearch || undefined,
        feedbackType: this.feedbackTypeFilter || undefined,
      });
      runInAction(() => {
        this.feedbackList = result.data;
        this.feedbackPage = result.page;
        this.feedbackTotal = result.total;
        this.feedbackTotalPages = result.totalPages;
      });
    } finally {
      runInAction(() => {
        this.feedbackLoading = false;
      });
    }
  }

  async createFeedback(dto: {
    descriptionA: string;
    descriptionB: string;
    catalogNumberA?: string;
    catalogNumberB?: string;
    sourceDocType: string;
    targetDocType: string;
  }) {
    await trainingService.createFeedback(dto);
    await this.fetchFeedback(this.feedbackPage);
  }

  async updateFeedback(
    id: string,
    dto: {
      descriptionA?: string;
      descriptionB?: string;
      catalogNumberA?: string;
      catalogNumberB?: string;
    },
  ) {
    await trainingService.updateFeedback(id, dto);
    await this.fetchFeedback(this.feedbackPage);
  }

  async deleteFeedback(id: string) {
    await trainingService.deleteFeedback(id);
    await this.fetchFeedback(this.feedbackPage);
  }
}
