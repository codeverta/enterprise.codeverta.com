import api from "@/lib/api";

export interface GLEntry {
  id: string;
  tenant_id?: string;
  posting_date: string;
  fiscal_year: string;
  account: string;
  account_currency: string;
  against: string;
  voucher_type: string;
  voucher_no: string;
  voucher_subtype?: string;
  transaction_currency: string;
  transaction_exchange_rate: number;
  reporting_currency_exchange_rate: number;

  debit_in_account_currency: number;
  debit: number;
  debit_in_transaction_currency: number;
  debit_in_reporting_currency: number;

  credit_in_account_currency: number;
  credit: number;
  credit_in_transaction_currency: number;
  credit_in_reporting_currency: number;

  cost_center: string;
  project?: string;
  company: string;

  is_opening: boolean;
  is_advance: boolean;
  is_cancelled: boolean;

  remarks: string;
  comment?: string;

  created_at?: string;
  updated_at?: string;
}

export interface GLEntryFilter {
  voucher_type?: string;
  voucher_no?: string;
  account?: string;
  company?: string;
  cost_center?: string;
  from_date?: string;
  to_date?: string;
  is_cancelled?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface GLEntryListResponse {
  data: GLEntry[];
  total: number;
  page: number;
  limit: number;
  total_debit: number;
  total_credit: number;
  difference: number;
}

export interface GLEntryOptions {
  accounts: string[];
  companies: string[];
  cost_centers: string[];
  voucher_types: string[];
  currencies: string[];
}

export const glEntryApi = {
  async list(params?: GLEntryFilter): Promise<GLEntryListResponse> {
    const res = await api.get("/accounting/gl-entries", { params });
    return res.data;
  },

  async get(id: string): Promise<GLEntry> {
    const res = await api.get(`/accounting/gl-entries/${id}`);
    return res.data?.data || res.data;
  },

  async create(payload: Partial<GLEntry>): Promise<GLEntry> {
    const res = await api.post("/accounting/gl-entries", payload);
    return res.data?.data || res.data;
  },

  async update(id: string, payload: Partial<GLEntry>): Promise<GLEntry> {
    const res = await api.put(`/accounting/gl-entries/${id}`, payload);
    return res.data?.data || res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/accounting/gl-entries/${id}`);
  },

  async getOptions(): Promise<GLEntryOptions> {
    const res = await api.get("/accounting/gl-entries/options");
    return res.data;
  },
};
