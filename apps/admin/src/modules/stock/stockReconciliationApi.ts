import api from "@/lib/api";

export type StockReconciliationItem = {
  id?: string;
  stock_reconciliation_id?: string;
  item_code: string;
  item_name?: string;
  warehouse: string;
  quantity: number;
  current_qty?: number;
  stock_uom?: string;
  valuation_rate: number;
  amount?: number;
  barcode?: string;
  idx?: number;
};

export type StockReconciliation = {
  id?: string;
  tenant_id?: string;
  naming_series: string;
  reconciliation_number?: string;
  purpose: string;
  company_id?: string;
  company: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  set_warehouse?: string;
  scan_barcode?: string;
  scan_mode?: boolean;
  expense_account?: string;
  cost_center?: string;
  total_qty: number;
  total_amount: number;
  status: "Draft" | "Submitted" | "Cancelled";
  remarks?: string;
  items: StockReconciliationItem[];
  created_at?: string;
  updated_at?: string;
};

export type StockReconciliationItemOption = {
  item_code: string;
  item_name: string;
  stock_uom: string;
  valuation_rate: number;
  barcode: string;
  description?: string;
};

export type StockReconciliationOptions = {
  naming_series: string[];
  purposes: string[];
  companies: string[];
  warehouses: string[];
  items: StockReconciliationItemOption[];
  expense_accounts: string[];
  cost_centers: string[];
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const stockReconciliationApi = {
  list: async (params?: { status?: string; purpose?: string; company?: string; q?: string }) =>
    unwrap(await api.get("/stock/stock-reconciliations", { params })) as StockReconciliation[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/stock-reconciliations/${id}`)) as StockReconciliation,
  create: async (data: Partial<StockReconciliation>) =>
    unwrap(await api.post("/stock/stock-reconciliations", data)) as StockReconciliation,
  update: async (id: string, data: Partial<StockReconciliation>) =>
    unwrap(await api.put(`/stock/stock-reconciliations/${id}`, data)) as StockReconciliation,
  submit: async (id: string) =>
    unwrap(await api.post(`/stock/stock-reconciliations/${id}/submit`)) as StockReconciliation,
  cancel: async (id: string) =>
    unwrap(await api.post(`/stock/stock-reconciliations/${id}/cancel`)) as StockReconciliation,
  remove: async (id: string) =>
    api.delete(`/stock/stock-reconciliations/${id}`),
  options: async () =>
    unwrap(await api.get("/stock/stock-reconciliations/options")) as StockReconciliationOptions,
  getBalance: async (itemCode: string, warehouse?: string) => {
    const res = await api.get<{ data: Array<{ item_code: string; warehouse: string; qty: number }> }>("/stock/stock-balances", {
      params: { item_code: itemCode },
    });
    const list = res?.data?.data || [];
    if (!warehouse) return list;
    const found = list.find((x) => x.warehouse === warehouse);
    return found ? found.qty : 0;
  },
};
