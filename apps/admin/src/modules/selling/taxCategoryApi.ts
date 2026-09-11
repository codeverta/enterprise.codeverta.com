import api from "@/lib/api";

export interface TaxCategory {
  id: string;
  tenant_id?: string;
  title: string;
  disabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export const taxCategoryApi = {
  async list(params?: { q?: string }): Promise<TaxCategory[]> {
    const res = await api.get<{ data: TaxCategory[] }>("/selling/tax-categories", { params });
    return res.data?.data || [];
  },

  async get(id: string): Promise<TaxCategory> {
    const res = await api.get<{ data: TaxCategory }>(`/selling/tax-categories/${id}`);
    return res.data?.data;
  },

  async create(data: { title: string; disabled?: boolean }): Promise<TaxCategory> {
    const res = await api.post<{ data: TaxCategory }>("/selling/tax-categories", data);
    return res.data?.data;
  },

  async update(id: string, data: { title: string; disabled?: boolean }): Promise<TaxCategory> {
    const res = await api.put<{ data: TaxCategory }>(`/selling/tax-categories/${id}`, data);
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/selling/tax-categories/${id}`);
  },
};
