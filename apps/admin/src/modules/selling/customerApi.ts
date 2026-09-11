import api from "@/lib/api";

export type Customer = {
  id?: string;
  customer_name: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  tax_id: string;
  email: string;
  phone: string;
  mobile_no: string;
  website: string;
  address: string;
  default_currency: string;
  default_price_list: string;
  payment_terms: string;
  credit_limit: number;
  notes: string;
  disabled: boolean;
};

export type CustomerGroupItem = {
  id?: string;
  group_name: string;
  parent_group?: string;
  is_group?: boolean;
  default_price_list?: string;
  payment_terms?: string;
  credit_limit?: number;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const customerApi = {
  list: async (q = "") => unwrap(await api.get("/selling/customers", { params: { q } })) as Customer[],
  get: async (id: string) => unwrap(await api.get(`/selling/customers/${encodeURIComponent(id)}`)) as Customer,
  create: async (data: Customer) => unwrap(await api.post("/selling/customers", data)) as Customer,
  update: async (id: string, data: Customer) => unwrap(await api.put(`/selling/customers/${encodeURIComponent(id)}`, data)) as Customer,
  remove: async (id: string) => api.delete(`/selling/customers/${encodeURIComponent(id)}`),
  listGroups: async (q = "") => unwrap(await api.get("/selling/customer-groups", { params: { q } })) as CustomerGroupItem[],
};
