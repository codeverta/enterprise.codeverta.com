import api from "@/lib/api";

export type PurchaseReceiptStatus = "Draft" | "Submitted" | "Cancelled";

export type PurchaseReceiptItem = {
  id?: string;
  purchase_receipt_id?: string;
  idx?: number;
  item_code: string;
  item_name?: string;
  accepted_quantity: number;
  rejected_quantity: number;
  uom?: string;
  rate: number;
  amount: number;
  accepted_warehouse?: string;
  rejected_warehouse?: string;
  barcode?: string;
  batch_no?: string;
  against_item_id?: string;
};

export type PurchaseReceiptTax = {
  id?: string;
  purchase_receipt_id?: string;
  idx?: number;
  type: string;
  account_head: string;
  tax_rate: number;
  net_amount: number;
  amount: number;
  total: number;
};

export type PurchaseReceiptSuppliedItem = {
  id?: string;
  purchase_receipt_id?: string;
  idx?: number;
  item_code: string;
  raw_material_item_code: string;
  available_qty_for_consumption: number;
  qty_to_be_consumed: number;
  current_stock: number;
};

export type PurchaseReceipt = {
  id?: string;
  tenant_id?: string;
  number?: string;
  naming_series: string;
  status: PurchaseReceiptStatus;

  supplier: string;
  supplier_delivery_note?: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  company: string;
  apply_putaway_rule: boolean;
  is_return: boolean;
  return_against_id?: string;

  cost_center?: string;
  project?: string;

  currency: string;
  buying_price_list: string;
  ignore_pricing_rule: boolean;

  scan_barcode?: string;
  set_warehouse?: string;
  rejected_warehouse?: string;
  is_subcontracted: boolean;

  tax_category?: string;
  taxes_and_charges?: string;
  shipping_rule?: string;
  incoterm?: string;

  total_qty: number;
  total: number;
  base_taxes_and_charges_added: number;
  base_taxes_and_charges_deducted: number;
  base_total_taxes_and_charges: number;
  taxes_and_charges_added: number;
  taxes_and_charges_deducted: number;
  total_taxes_and_charges: number;
  grand_total: number;
  disable_rounded_total: boolean;
  rounding_adjustment: number;
  rounded_total: number;

  apply_discount_on: string;
  additional_discount_percentage: number;
  discount_amount: number;

  remarks?: string;

  items: PurchaseReceiptItem[];
  taxes: PurchaseReceiptTax[];
  supplied_items: PurchaseReceiptSuppliedItem[];

  created_at?: string;
  updated_at?: string;
};

export type PurchaseReceiptItemOption = {
  item_code: string;
  item_name: string;
  uom: string;
  basic_rate: number;
  barcode: string;
  description?: string;
};

export type PurchaseReceiptOptions = {
  naming_series: string[];
  companies: string[];
  suppliers: string[];
  warehouses: string[];
  currencies: string[];
  price_lists: string[];
  tax_categories: string[];
  taxes_templates: string[];
  shipping_rules: string[];
  incoterms: string[];
  items: PurchaseReceiptItemOption[];
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const purchaseReceiptApi = {
  list: async (params?: { status?: string; supplier?: string; company?: string; q?: string }) =>
    unwrap(await api.get("/stock/purchase-receipts", { params })) as PurchaseReceipt[],
  get: async (id: string) =>
    unwrap(await api.get(`/stock/purchase-receipts/${id}`)) as PurchaseReceipt,
  create: async (data: Partial<PurchaseReceipt>) =>
    unwrap(await api.post("/stock/purchase-receipts", data)) as PurchaseReceipt,
  update: async (id: string, data: Partial<PurchaseReceipt>) =>
    unwrap(await api.put(`/stock/purchase-receipts/${id}`, data)) as PurchaseReceipt,
  submit: async (id: string) =>
    unwrap(await api.post(`/stock/purchase-receipts/${id}/submit`)) as PurchaseReceipt,
  cancel: async (id: string) =>
    unwrap(await api.post(`/stock/purchase-receipts/${id}/cancel`)) as PurchaseReceipt,
  remove: async (id: string) =>
    api.delete(`/stock/purchase-receipts/${id}`),
  options: async () =>
    unwrap(await api.get("/stock/purchase-receipts/options")) as PurchaseReceiptOptions,
};
