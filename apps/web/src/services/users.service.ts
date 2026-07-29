import { apiClient } from './api-client';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'FIELD_WORKER' | 'CONTRACTOR';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const USER_ROLE_OPTIONS = [
  { value: 'ADMIN' as const, labelKey: 'common:roles.admin' },
  { value: 'ACCOUNTANT' as const, labelKey: 'common:roles.accountant' },
  { value: 'FIELD_WORKER' as const, labelKey: 'common:roles.fieldWorker' },
  { value: 'CONTRACTOR' as const, labelKey: 'common:roles.contractor' },
];

// No password: login is OAuth-only; the user is invited and signs in with
// Google / Microsoft 365.
export interface CreateUserPayload {
  email: string;
  name: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  role?: UserRole;
  isActive?: boolean;
  name?: string;
}

export const usersService = {
  listUsers(): Promise<User[]> {
    return apiClient.get<User[]>('/users').then((r) => r.data);
  },
  createUser(dto: CreateUserPayload): Promise<User> {
    return apiClient.post<User>('/users', dto).then((r) => r.data);
  },
  updateUser(id: string, dto: UpdateUserPayload): Promise<User> {
    return apiClient.patch<User>(`/users/${id}`, dto).then((r) => r.data);
  },
};
