export interface Supplier {
  id: string;
  name: string;
  businessId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}
