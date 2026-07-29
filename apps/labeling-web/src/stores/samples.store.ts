import { makeAutoObservable, runInAction } from 'mobx';
import type { Sample, PaginatedSamples, Stats, SampleFilters, SampleStatus, DocumentType, AiModel } from '@/types/sample.types';
import * as api from '@/api/samples.api';

class SamplesStore {
  samples: Sample[] = [];
  currentSample: Sample | null = null;
  stats: Stats | null = null;
  total = 0;
  page = 1;
  totalPages = 1;
  limit = 20;

  statusFilter: SampleStatus | undefined = undefined;
  documentTypeFilter: DocumentType | undefined = undefined;
  searchQuery = '';

  models: AiModel[] = [];
  selectedModelId = 'gemini';

  isLoading = false;
  isUploading = false;
  isSaving = false;
  isVerifying = false;
  isReExtracting = false;
  isExtractingFinetuned = false;
  isDeleting = false;

  constructor() {
    makeAutoObservable(this);
  }

  get filters(): SampleFilters {
    return {
      page: this.page,
      limit: this.limit,
      status: this.statusFilter,
      documentType: this.documentTypeFilter,
      search: this.searchQuery || undefined,
    };
  }

  setPage = (page: number) => {
    this.page = page;
  };

  setStatusFilter = (status: SampleStatus | undefined) => {
    this.statusFilter = status;
    this.page = 1;
  };

  setDocumentTypeFilter = (documentType: DocumentType | undefined) => {
    this.documentTypeFilter = documentType;
    this.page = 1;
  };

  setSearchQuery = (query: string) => {
    this.searchQuery = query;
    this.page = 1;
  };

  loadSamples = async () => {
    this.isLoading = true;
    try {
      const result: PaginatedSamples = await api.fetchSamples(this.filters);
      runInAction(() => {
        this.samples = result.samples;
        this.total = result.total;
        this.page = result.page;
        this.totalPages = result.totalPages;
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  };

  loadSample = async (id: string) => {
    this.isLoading = true;
    try {
      const sample = await api.fetchSample(id);
      runInAction(() => {
        this.currentSample = sample;
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  };

  loadStats = async () => {
    try {
      const stats = await api.fetchStats();
      runInAction(() => {
        this.stats = stats;
      });
    } catch {
      // stats are non-critical
    }
  };

  loadModels = async () => {
    try {
      const models = await api.fetchModels();
      runInAction(() => {
        this.models = models;
      });
    } catch {
      // non-critical
    }
  };

  setSelectedModel = (modelId: string) => {
    this.selectedModelId = modelId;
  };

  uploadSample = async (file: File, replaceId?: string): Promise<Sample[]> => {
    this.isUploading = true;
    try {
      const samples = await api.uploadSample(file, replaceId);
      await this.loadSamples();
      await this.loadStats();
      return samples;
    } finally {
      runInAction(() => {
        this.isUploading = false;
      });
    }
  };

  saveGroundTruth = async (id: string, groundTruth: unknown, tags?: string[], notes?: string): Promise<Sample> => {
    this.isSaving = true;
    try {
      const sample = await api.updateGroundTruth(id, groundTruth, tags, notes);
      runInAction(() => {
        this.currentSample = sample;
      });
      return sample;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  };

  verifySample = async (id: string): Promise<Sample> => {
    this.isVerifying = true;
    try {
      const sample = await api.verifySample(id);
      runInAction(() => {
        this.currentSample = sample;
      });
      return sample;
    } finally {
      runInAction(() => {
        this.isVerifying = false;
      });
    }
  };

  reExtractSample = async (id: string, modelId?: string): Promise<Sample> => {
    const model = modelId || this.selectedModelId;
    this.isReExtracting = true;
    if (model !== 'gemini') this.isExtractingFinetuned = true;
    try {
      const sample = await api.reExtractSample(id, model);
      runInAction(() => {
        this.currentSample = sample;
      });
      return sample;
    } finally {
      runInAction(() => {
        this.isReExtracting = false;
        this.isExtractingFinetuned = false;
      });
    }
  };

  updateDocumentType = async (id: string, documentType: DocumentType): Promise<Sample> => {
    try {
      const sample = await api.updateDocumentType(id, documentType);
      runInAction(() => {
        this.currentSample = sample;
        const idx = this.samples.findIndex((s) => s.id === id);
        if (idx !== -1) {
          this.samples[idx] = sample;
        }
      });
      return sample;
    } catch (error) {
      throw error;
    }
  };

  deleteSample = async (id: string): Promise<void> => {
    this.isDeleting = true;
    try {
      await api.deleteSample(id);
      runInAction(() => {
        this.samples = this.samples.filter((s) => s.id !== id);
        if (this.currentSample?.id === id) {
          this.currentSample = null;
        }
      });
      await this.loadStats();
    } finally {
      runInAction(() => {
        this.isDeleting = false;
      });
    }
  };

  clearCurrentSample = () => {
    this.currentSample = null;
  };
}

export default SamplesStore;
