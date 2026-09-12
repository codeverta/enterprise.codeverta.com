import api from "@/lib/api";

export type Brand = {
  id?: string;
  brand_name: string;
  description?: string;
  enabled?: boolean;
  created_at?: string;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const brandApi = {
  list: async (params?: { q?: string; enabled?: boolean | string }) =>
    unwrap(await api.get("/stock/brands", { params })) as Brand[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/brands/${id}`)) as Brand,
  create: async (data: Partial<Brand>) =>
    unwrap(await api.post("/stock/brands", data)) as Brand,
  remove: async (id: string) =>
    api.delete(`/stock/brands/${id}`),
};
