import { makeAutoObservable, runInAction } from 'mobx';
import {
  testingService,
  type TestCaseSummary,
  type TestRunResult,
} from '../services/testing.service';

export class TestingStore {
  cases: TestCaseSummary[] = [];
  results: TestRunResult[] = [];
  currentResult: TestRunResult | null = null;
  loading = false;
  running = false;
  runningCaseId: string | null = null;
  generatingMocksForId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchCases() {
    this.loading = true;
    try {
      const cases = await testingService.listCases();
      runInAction(() => {
        this.cases = cases;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async runLive(caseId: string) {
    this.running = true;
    this.runningCaseId = caseId;
    this.currentResult = null;
    try {
      const result = await testingService.runLive(caseId);
      runInAction(() => {
        this.currentResult = result;
      });
      await this.fetchCases();
      return result;
    } finally {
      runInAction(() => {
        this.running = false;
        this.runningCaseId = null;
      });
    }
  }

  async runMock(caseId: string) {
    this.running = true;
    this.runningCaseId = caseId;
    this.currentResult = null;
    try {
      const result = await testingService.runMock(caseId);
      runInAction(() => {
        this.currentResult = result;
      });
      await this.fetchCases();
      return result;
    } finally {
      runInAction(() => {
        this.running = false;
        this.runningCaseId = null;
      });
    }
  }

  async runAllMocks() {
    this.running = true;
    this.runningCaseId = '__all__';
    try {
      const results = await testingService.runAllMocks();
      runInAction(() => {
        this.results = results;
      });
      await this.fetchCases();
      return results;
    } finally {
      runInAction(() => {
        this.running = false;
        this.runningCaseId = null;
      });
    }
  }

  async generateMocks(caseId: string) {
    this.generatingMocksForId = caseId;
    try {
      await testingService.generateMocks(caseId);
      await this.fetchCases();
    } finally {
      runInAction(() => {
        this.generatingMocksForId = null;
      });
    }
  }

  async fetchResults() {
    const results = await testingService.getResults();
    runInAction(() => {
      this.results = results;
    });
  }
}
