import api from "@/lib/api";

export type StockEntryItem = {
  id?: string;
  stock_entry_id?: string;
  item_code: string;
  item_name?: string;
  description?: string;
  source_warehouse?: string;
  target_warehouse?: string;
  qty: number;
  transfer_qty?: number;
  uom?: string;
  conversion_factor?: number;
  basic_rate: number;
  amount?: number;
  barcode?: string;
  batch_no?: string;
  idx?: number;
};

export type StockEntry = {
  id?: string;
  tenant_id?: string;
  naming_series: string;
  stock_entry_number?: string;
  stock_entry_type: string;
  purpose?: string;
  company: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  from_bom: boolean;
  bom_no?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  scan_barcode?: string;
  total_qty: number;
  total_amount: number;
  status: "Draft" | "Submitted" | "Cancelled";
  remarks?: string;
  items: StockEntryItem[];
  created_at?: string;
  updated_at?: string;
};

export type StockEntryItemOption = {
  item_code: string;
  item_name: string;
  uom: string;
  basic_rate: number;
  barcode: string;
  description?: string;
};

export type StockEntryOptions = {
  stock_entry_types: string[];
  naming_series: string[];
  companies: string[];
  warehouses: string[];
  items: StockEntryItemOption[];
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const stockEntryApi = {
  list: async (params?: { status?: string; stock_entry_type?: string; company?: string; q?: string }) =>
    unwrap(await api.get("/stock/stock-entries", { params })) as StockEntry[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/stock-entries/${id}`)) as StockEntry,
  create: async (data: Partial<StockEntry>) =>
    unwrap(await api.post("/stock/stock-entries", data)) as StockEntry,
  update: async (id: string, data: Partial<StockEntry>) =>
    unwrap(await api.put(`/stock/stock-entries/${id}`, data)) as StockEntry,
  submit: async (id: string) =>
    unwrap(await api.post(`/stock/stock-entries/${id}/submit`)) as StockEntry,
  cancel: async (id: string) =>
    unwrap(await api.post(`/stock/stock-entries/${id}/cancel`)) as StockEntry,
  remove: async (id: string) =>
    api.delete(`/stock/stock-entries/${id}`),
  options: async () =>
    unwrap(await api.get("/stock/stock-entries/options")) as StockEntryOptions,
};
