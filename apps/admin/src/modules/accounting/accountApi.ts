import api from "@/lib/api";

export type CompanyOption = {
  id: string;
  name: string;
  abbreviation: string;
  currency: string;
};

export type Account = {
  id: string;
  tenant_id?: string;
  company_id: string;
  parent_account_id: string | null;
  account_name: string;
  account_number: string;
  is_group: boolean;
  account_type: string;
  account_category: string;
  account_currency: string;
  balance: number;
  disabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AccountInput = Omit<Account, "id" | "tenant_id" | "balance" | "created_at" | "updated_at">;

export const accountApi = {
  async companies(): Promise<CompanyOption[]> {
    const response = await api.get<{ data: CompanyOption[] }>("/organization/companies");
    return response.data?.data || [];
  },

  async currencies(): Promise<string[]> {
    const response = await api.get<{ data: { id: string; enabled: boolean }[] }>("/currencies", {
      params: { enabled: true },
    });
    return (response.data?.data || []).map((item) => item.id);
  },

  async options(): Promise<{ account_types: string[]; account_categories: string[] }> {
    const response = await api.get("/accounting/account-options");
    return response.data;
  },

  async list(companyId: string, q?: string): Promise<Account[]> {
    const response = await api.get<{ data: Account[] }>("/accounting/accounts", {
      params: { company_id: companyId, q: q || undefined },
    });
    return response.data?.data || [];
  },

  async create(input: AccountInput): Promise<Account> {
    const response = await api.post<Account>("/accounting/accounts", input);
    return response.data;
  },

  async update(id: string, input: AccountInput): Promise<Account> {
    const response = await api.put<Account>(`/accounting/accounts/${encodeURIComponent(id)}`, input);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/accounting/accounts/${encodeURIComponent(id)}`);
  },
};

