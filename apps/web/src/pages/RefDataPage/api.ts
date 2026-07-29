import { labelingApi } from '../../services/labeling-api.client';

// ─── Types ───

export interface RefSupplier {
  id: string;
  name: string;
  categories: string[];
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  avgPrice: number;
  variants: string[];
  commonVendors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RefCity {
  id: string;
  code: number;
  name: string;
  englishName: string;
  district: string;
  council: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RefDataStats {
  suppliers: number;
  products: number;
  cities: number;
}

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

// ─── API ───

export const refDataApi = {
  stats: async () => {
    const { data } = await labelingApi.get<RefDataStats>('/ref-data/stats');
    return data;
  },

  // Suppliers
  listSuppliers: async (params: ListParams = {}) => {
    const { data } = await labelingApi.get<PaginatedResult<RefSupplier>>('/ref-data/suppliers', { params });
    return data;
  },

  supplierCategories: async () => {
    const { data } = await labelingApi.get<string[]>('/ref-data/suppliers/categories');
    return data;
  },

  createSupplier: async (dto: Omit<RefSupplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { data } = await labelingApi.post<RefSupplier>('/ref-data/suppliers', dto);
    return data;
  },

  updateSupplier: async (id: string, dto: Partial<Omit<RefSupplier, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const { data } = await labelingApi.patch<RefSupplier>(`/ref-data/suppliers/${id}`, dto);
    return data;
  },

  deleteSupplier: async (id: string) => {
    await labelingApi.delete(`/ref-data/suppliers/${id}`);
  },

  // Products
  listProducts: async (params: ListParams = {}) => {
    const { data } = await labelingApi.get<PaginatedResult<RefProduct>>('/ref-data/products', { params });
    return data;
  },

  productCategories: async () => {
    const { data } = await labelingApi.get<string[]>('/ref-data/products/categories');
    return data;
  },

  createProduct: async (dto: Omit<RefProduct, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { data } = await labelingApi.post<RefProduct>('/ref-data/products', dto);
    return data;
  },

  updateProduct: async (id: string, dto: Partial<Omit<RefProduct, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const { data } = await labelingApi.patch<RefProduct>(`/ref-data/products/${id}`, dto);
    return data;
  },

  deleteProduct: async (id: string) => {
    await labelingApi.delete(`/ref-data/products/${id}`);
  },

  // Cities
  listCities: async (params: ListParams = {}) => {
    const { data } = await labelingApi.get<PaginatedResult<RefCity>>('/ref-data/cities', { params });
    return data;
  },

  cityDistricts: async () => {
    const { data } = await labelingApi.get<string[]>('/ref-data/cities/districts');
    return data;
  },

  createCity: async (dto: Omit<RefCity, 'id'>) => {
    const { data } = await labelingApi.post<RefCity>('/ref-data/cities', dto);
    return data;
  },

  updateCity: async (id: string, dto: Partial<Omit<RefCity, 'id'>>) => {
    const { data } = await labelingApi.patch<RefCity>(`/ref-data/cities/${id}`, dto);
    return data;
  },

  deleteCity: async (id: string) => {
    await labelingApi.delete(`/ref-data/cities/${id}`);
  },

  // Migration
  migrateSuppliersFromSamples: async () => {
    const { data } = await labelingApi.post<{
      samplesScanned: number;
      uniqueSuppliers: number;
      created: number;
      updated: number;
      skipped: number;
    }>('/ref-data/migrate/suppliers-from-samples');
    return data;
  },
};
