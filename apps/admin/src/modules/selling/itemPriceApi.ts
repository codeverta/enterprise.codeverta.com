import api from "@/lib/api";

export type ItemPrice = {
  id?: string;
  item_code: string;
  item_name?: string;
  price_list: string;
  price_list_rate: number;
  currency: string;
  uom: string;
  packing_unit: number;
  batch_no?: string;
  buying: boolean;
  selling: boolean;
  lead_time_days: number;
  valid_from?: string;
  valid_upto?: string;
  note?: string;
  reference?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PriceList = {
  id?: string;
  price_list_name: string;
  currency: string;
  buying: boolean;
  selling: boolean;
  enabled: boolean;
};

export type ItemOption = {
  item_code: string;
  item_name: string;
  stock_uom?: string;
  standard_rate?: number;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const itemPriceApi = {
  list: async (params?: { q?: string; price_list?: string }) =>
    unwrap(await api.get("/selling/item-prices", { params })) as ItemPrice[],
  get: async (id: string) =>
    unwrap(await api.get(`/selling/item-prices/${id}`)) as ItemPrice,
  create: async (data: Partial<ItemPrice>) =>
    unwrap(await api.post("/selling/item-prices", data)) as ItemPrice,
  update: async (id: string, data: Partial<ItemPrice>) =>
    unwrap(await api.put(`/selling/item-prices/${id}`, data)) as ItemPrice,
  remove: async (id: string) =>
    api.delete(`/selling/item-prices/${id}`),
  listPriceLists: async () =>
    unwrap(await api.get("/selling/price-lists")) as PriceList[],
  listItems: async (q = "") => {
    try {
      const res = await api.get("/buying/items", { params: { q } });
      return (unwrap(res) || []) as ItemOption[];
    } catch {
      return [] as ItemOption[];
    }
  },
  listUOMs: async () => {
    try {
      const res = await api.get("/stock/uoms");
      return (unwrap(res) || []) as { id?: string; uom_name: string; symbol?: string; common_code?: string }[];
    } catch {
      return [];
    }
  },
};
