import api from "@/lib/api";

export type UOM = {
  id?: string;
  uom_name: string;
  symbol: string;
  common_code: string;
  description: string;
  enabled: boolean;
  must_be_whole_number: boolean;
  created_at?: string;
  updated_at?: string;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const uomApi = {
  list: async (params?: { q?: string; enabled?: boolean | string }) =>
    unwrap(await api.get("/stock/uoms", { params })) as UOM[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/uoms/${id}`)) as UOM,
  create: async (data: Partial<UOM>) =>
    unwrap(await api.post("/stock/uoms", data)) as UOM,
  update: async (id: string, data: Partial<UOM>) =>
    unwrap(await api.put(`/stock/uoms/${id}`, data)) as UOM,
  remove: async (id: string) =>
    api.delete(`/stock/uoms/${id}`),
  seed: async () =>
    unwrap(await api.post("/stock/uoms/seed")),
};
