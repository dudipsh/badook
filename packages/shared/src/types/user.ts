export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'FIELD_WORKER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  companyId: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
