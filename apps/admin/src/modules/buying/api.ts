import api from "@/lib/api";

export type PurchaseOrderStatus = "draft" | "submitted" | "cancelled";

export type PurchaseOrderItem = {
  id?: string;
  item_code: string;
  item_name: string;
  description: string;
  schedule_date: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
  target_warehouse: string;
};

export type PurchaseOrderTax = {
  id?: string;
  charge_type: "actual" | "on_net_total" | "on_previous_row_total";
  account_head: string;
  description: string;
  rate: number;
  net_amount: number;
  tax_amount: number;
  total: number;
};

export type PurchaseOrder = {
  id?: string;
  number?: string;
  naming_series: string;
  status: PurchaseOrderStatus;
  supplier: string;
  transaction_date: string;
  schedule_date: string;
  company: string;
  is_subcontracted: boolean;
  cost_center: string;
  project: string;
  currency: string;
  buying_price_list: string;
  ignore_pricing_rule: boolean;
  set_warehouse: string;
  tax_category: string;
  taxes_and_charges: string;
  shipping_rule: string;
  incoterm: string;
  total_qty: number;
  total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  disable_rounded_total: boolean;
  rounding_adjustment: number;
  rounded_total: number;
  advance_paid: number;
  apply_discount_on: "grand_total" | "net_total";
  additional_discount_percentage: number;
  additional_discount_amount: number;
  supplier_address: string;
  shipping_address: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  terms: string;
  payment_terms_template: string;
  letter_head: string;
  remarks: string;
  items: PurchaseOrderItem[];
  taxes: PurchaseOrderTax[];
  created_at?: string;
};

export type BuyingOptions = {
  companies: string[];
  suppliers: string[];
  warehouses: string[];
  items: string[];
  cost_centers: string[];
  projects: string[];
  currencies: string[];
  price_lists: string[];
  uoms: string[];
};

export type PurchaseInvoiceStatus = "draft" | "submitted" | "cancelled";

export type PurchaseInvoiceItem = {
  id?: string;
  item_code: string;
  item_name: string;
  description: string;
  accepted_qty: number;
  uom: string;
  rate: number;
  amount: number;
  warehouse: string;
};

export type PurchaseInvoiceTax = {
  id?: string;
  add_deduct: "add" | "deduct";
  charge_type: "actual" | "on_net_total" | "on_previous_row_total";
  account_head: string;
  description: string;
  rate: number;
  net_amount: number;
  tax_amount: number;
  total: number;
};

export type PurchaseInvoice = {
  id?: string;
  number?: string;
  naming_series: string;
  status: PurchaseInvoiceStatus;
  supplier: string;
  company: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  due_date: string;
  is_paid: boolean;
  is_return: boolean;
  apply_tds: boolean;
  bill_no: string;
  bill_date: string | null;
  cost_center: string;
  project: string;
  currency: string;
  use_transaction_date_exchange_rate: boolean;
  buying_price_list: string;
  ignore_pricing_rule: boolean;
  update_stock: boolean;
  is_subcontracted: boolean;
  tax_category: string;
  taxes_and_charges: string;
  shipping_rule: string;
  incoterm: string;
  total_qty: number;
  total: number;
  base_taxes_and_charges_added: number;
  base_taxes_and_charges_deducted: number;
  base_total_taxes_and_charges: number;
  taxes_and_charges_added: number;
  taxes_and_charges_deducted: number;
  total_taxes_and_charges: number;
  use_company_roundoff_cost_center: boolean;
  grand_total: number;
  rounding_adjustment: number;
  rounded_total: number;
  total_advance: number;
  apply_discount_on: "grand_total" | "net_total";
  additional_discount_percentage: number;
  additional_discount_amount: number;
  mode_of_payment: string;
  cash_bank_account: string;
  paid_amount: number;
  supplier_address: string;
  shipping_address: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  terms: string;
  payment_terms_template: string;
  letter_head: string;
  remarks: string;
  items: PurchaseInvoiceItem[];
  taxes: PurchaseInvoiceTax[];
  created_at?: string;
};

export type PurchaseInvoiceOptions = BuyingOptions & {
  modes_of_payment: string[];
  accounts: string[];
};

export const dateForApi = (value: string) => value ? `${value}T00:00:00Z` : "";
export const dateForInput = (value?: string) => value ? value.slice(0, 10) : "";

export const buyingApi = {
  async list(params: { page?: number; page_size?: number; q?: string; status?: string }) {
    return (await api.get<{ data: PurchaseOrder[]; meta: { page: number; page_size: number; total: number } }>(
      "/buying/purchase-orders",
      { params },
    )).data;
  },
  async get(id: string) {
    return (await api.get<PurchaseOrder>(`/buying/purchase-orders/${id}`)).data;
  },
  async create(input: PurchaseOrder) {
    return (await api.post<PurchaseOrder>("/buying/purchase-orders", input)).data;
  },
  async update(id: string, input: PurchaseOrder) {
    return (await api.put<PurchaseOrder>(`/buying/purchase-orders/${id}`, input)).data;
  },
  async submit(id: string) {
    return (await api.post(`/buying/purchase-orders/${id}/submit`)).data;
  },
  async remove(id: string) {
    await api.delete(`/buying/purchase-orders/${id}`);
  },
  async options() {
    return (await api.get<BuyingOptions>("/buying/purchase-orders/options")).data;
  },
  async invoiceList(params: { page?: number; page_size?: number; q?: string; status?: string }) {
    return (await api.get<{ data: PurchaseInvoice[]; meta: { page: number; page_size: number; total: number } }>(
      "/buying/purchase-invoices", { params },
    )).data;
  },
  async invoiceGet(id: string) {
    return (await api.get<PurchaseInvoice>(`/buying/purchase-invoices/${id}`)).data;
  },
  async invoiceCreate(input: PurchaseInvoice) {
    return (await api.post<PurchaseInvoice>("/buying/purchase-invoices", input)).data;
  },
  async invoiceUpdate(id: string, input: PurchaseInvoice) {
    return (await api.put<PurchaseInvoice>(`/buying/purchase-invoices/${id}`, input)).data;
  },
  async invoiceSubmit(id: string) {
    return (await api.post<PurchaseInvoice>(`/buying/purchase-invoices/${id}/submit`)).data;
  },
  async invoiceRemove(id: string) {
    await api.delete(`/buying/purchase-invoices/${id}`);
  },
  async invoiceOptions() {
    return (await api.get<PurchaseInvoiceOptions>("/buying/purchase-invoices/options")).data;
  },
};
