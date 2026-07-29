export interface Company {
  id: string;
  name: string;
  businessId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}
