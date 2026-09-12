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
  submitted_at?: string;
  cancelled_at?: string;
  amended_from?: string;
  amendment_no?: number;
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
  tax_categories?: string[];
  shipping_rules?: string[];
  taxes_and_charges?: string[];
  incoterms?: string[];
  payment_terms_templates?: string[];
};

export type SupplierCustomerNumber = {
  id?: string;
  company: string;
  customer_number: string;
};
export type Supplier = {
  id?: string;
  supplier_name: string;
  supplier_type: "Company" | "Individual";
  supplier_group: string;
  country: string;
  is_transporter: boolean;
  default_currency: string;
  default_bank_account: string;
  default_price_list: string;
  supplier_details: string;
  website: string;
  language: string;
  allow_purchase_invoice_creation_without_purchase_order: boolean;
  allow_purchase_invoice_creation_without_purchase_receipt: boolean;
  disabled: boolean;
  is_frozen: boolean;
  block_supplier: boolean;
  tax_id: string;
  tax_category: string;
  tax_withholding_category: string;
  tax_withholding_group: string;
  supplier_address: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  accounts_payable: string;
  portal_users: string;
  customer_numbers: SupplierCustomerNumber[];
  created_at?: string;
};
export type SupplierGroup = {
  id?: string;
  group_name: string;
  parent_group: string;
  is_group: boolean;
  default_price_list: string;
  payment_terms: string;
  description: string;
};
export type ItemUOM = { id?: string; uom: string; conversion_factor: number };
export type ItemBarcode = {
  id?: string;
  barcode: string;
  barcode_type: string;
  uom: string;
};
export type ItemReorderLevel = {
  id?: string;
  request_for: string;
  warehouse: string;
  reorder_level: number;
  reorder_qty: number;
  material_request_type: string;
};
export type ItemSupplier = {
  id?: string;
  supplier: string;
  supplier_part_number: string;
};
export type Item = {
  id?: string;
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  disabled: boolean;
  allow_alternative_item: boolean;
  is_stock_item: boolean;
  has_variants: boolean;
  is_fixed_asset: boolean;
  opening_stock: number;
  standard_rate: number;
  image_url: string;
  description: string;
  brand: string;
  valuation_method: string;
  valuation_rate: number;
  shelf_life_in_days: number;
  end_of_life: string;
  default_material_request_type: string;
  warranty_period: number;
  weight_per_unit: number;
  weight_uom: string;
  allow_negative_stock: boolean;
  has_batch_no: boolean;
  purchase_uom: string;
  min_order_qty: number;
  safety_stock: number;
  is_purchase_item: boolean;
  lead_time_days: number;
  is_customer_provided_item: boolean;
  delivered_by_supplier: boolean;
  country_of_origin: string;
  customs_tariff_number: string;
  income_account: string;
  expense_account: string;
  tax_category: string;
  quality_inspection_required: boolean;
  uoms: ItemUOM[];
  barcodes: ItemBarcode[];
  reorder_levels: ItemReorderLevel[];
  supplier_items: ItemSupplier[];
  created_at?: string;
};
export type MasterOptions = {
  supplier_groups: string[];
  suppliers: string[];
  items: string[];
  item_groups: string[];
  countries: string[];
  currencies: string[];
  price_lists: string[];
  languages: string[];
  uoms: string[];
  weight_uoms: string[];
  warehouses: string[];
};

export const dateForApi = (value: string) => value ? `${value}T00:00:00Z` : "";
export const dateForInput = (value?: string) => value ? value.slice(0, 10) : "";
const unwrapItem = (payload: Item | { data: Item }) =>
  "data" in payload ? payload.data : payload;

export const buyingApi = {
  async list(
    params: { page?: number; page_size?: number; q?: string; status?: string },
  ) {
    return (await api.get<
      {
        data: PurchaseOrder[];
        meta: { page: number; page_size: number; total: number };
      }
    >(
      "/buying/purchase-orders",
      { params },
    )).data;
  },
  async get(id: string) {
    return (await api.get<PurchaseOrder>(`/buying/purchase-orders/${id}`)).data;
  },
  async create(input: PurchaseOrder) {
    return (await api.post<PurchaseOrder>("/buying/purchase-orders", input))
      .data;
  },
  async update(id: string, input: PurchaseOrder) {
    return (await api.put<PurchaseOrder>(
      `/buying/purchase-orders/${id}`,
      input,
    )).data;
  },
  async submit(id: string) {
    return (await api.post(`/buying/purchase-orders/${id}/submit`)).data;
  },
  async cancel(id: string) {
    return (await api.post<PurchaseOrder>(`/buying/purchase-orders/${id}/cancel`)).data;
  },
  async remove(id: string) {
    await api.delete(`/buying/purchase-orders/${id}`);
  },
  async options() {
    return (await api.get<BuyingOptions>("/buying/purchase-orders/options"))
      .data;
  },
  async invoiceList(
    params: { page?: number; page_size?: number; q?: string; status?: string },
  ) {
    return (await api.get<
      {
        data: PurchaseInvoice[];
        meta: { page: number; page_size: number; total: number };
      }
    >(
      "/buying/purchase-invoices",
      { params },
    )).data;
  },
  async invoiceGet(id: string) {
    return (await api.get<PurchaseInvoice>(`/buying/purchase-invoices/${id}`))
      .data;
  },
  async invoiceCreate(input: PurchaseInvoice) {
    return (await api.post<PurchaseInvoice>("/buying/purchase-invoices", input))
      .data;
  },
  async invoiceUpdate(id: string, input: PurchaseInvoice) {
    return (await api.put<PurchaseInvoice>(
      `/buying/purchase-invoices/${id}`,
      input,
    )).data;
  },
  async invoiceSubmit(id: string) {
    return (await api.post<PurchaseInvoice>(
      `/buying/purchase-invoices/${id}/submit`,
    )).data;
  },
  async invoiceRemove(id: string) {
    await api.delete(`/buying/purchase-invoices/${id}`);
  },
  async invoiceOptions() {
    return (await api.get<PurchaseInvoiceOptions>(
      "/buying/purchase-invoices/options",
    )).data;
  },
  async masterOptions() {
    return (await api.get<MasterOptions>("/buying/master/options")).data;
  },
  async supplierList(q = "") {
    return (await api.get<{ data: Supplier[] }>("/buying/suppliers", {
      params: { q },
    })).data.data || [];
  },
  async supplierGet(id: string) {
    return (await api.get<Supplier>(`/buying/suppliers/${id}`)).data;
  },
  async supplierCreate(input: Supplier) {
    return (await api.post<Supplier>("/buying/suppliers", input)).data;
  },
  async supplierUpdate(id: string, input: Supplier) {
    return (await api.put<Supplier>(`/buying/suppliers/${id}`, input)).data;
  },
  async supplierRemove(id: string) {
    await api.delete(`/buying/suppliers/${id}`);
  },
  async groupList() {
    return (await api.get<{ data: SupplierGroup[] }>("/buying/supplier-groups"))
      .data.data || [];
  },
  async groupGet(id: string) {
    return (await api.get<SupplierGroup>(`/buying/supplier-groups/${id}`)).data;
  },
  async groupCreate(input: SupplierGroup) {
    return (await api.post<SupplierGroup>("/buying/supplier-groups", input))
      .data;
  },
  async groupUpdate(id: string, input: SupplierGroup) {
    return (await api.put<SupplierGroup>(
      `/buying/supplier-groups/${id}`,
      input,
    )).data;
  },
  async groupRemove(id: string) {
    await api.delete(`/buying/supplier-groups/${id}`);
  },
  async itemList(q = "") {
    return (await api.get<{ data: Item[] }>("/buying/items", { params: { q } }))
      .data.data || [];
  },
  async itemGet(id: string) {
    return unwrapItem(
      (await api.get<Item | { data: Item }>(`/buying/items/${id}`)).data,
    );
  },
  async itemCreate(input: Item) {
    return unwrapItem(
      (await api.post<Item | { data: Item }>("/buying/items", input)).data,
    );
  },
  async itemUpdate(id: string, input: Item) {
    return unwrapItem(
      (await api.put<Item | { data: Item }>(`/buying/items/${id}`, input)).data,
    );
  },
  async itemUploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    return (await api.post<{ image_url: string }>(
      "/buying/items/upload-image",
      body,
    )).data;
  },
  async itemRemove(id: string) {
    await api.delete(`/buying/items/${id}`);
  },
};
