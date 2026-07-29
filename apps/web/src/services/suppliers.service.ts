import { apiClient } from './api-client';

export interface Supplier {
  id: string;
  name: string;
  businessId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export const suppliersService = {
  getAll(): Promise<Supplier[]> {
    return apiClient.get<Supplier[]>('/suppliers').then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/suppliers/${id}`).then(() => undefined);
  },

  merge(targetId: string, sourceId: string): Promise<any> {
    return apiClient.post(`/suppliers/${targetId}/merge`, { sourceId }).then((r) => r.data);
  },
};
