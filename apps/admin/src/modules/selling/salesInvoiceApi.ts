import api from "@/lib/api";

export type SalesInvoiceStatus = "Draft" | "Submitted" | "Cancelled";

export type SalesInvoiceItem = {
  id?: string;
  against_item_id?: string;
  item_code: string;
  item_name?: string;
  warehouse?: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
};

export type SalesInvoice = {
  id?: string;
  number?: string;
  naming_series?: string;
  status: SalesInvoiceStatus;
  customer: string;
  company: string;
  posting_date: string;
  posting_time?: string;
  set_posting_time?: boolean;
  due_date?: string;
  is_pos?: boolean;
  is_return: boolean;
  is_debit_note?: boolean;
  apply_tds?: boolean;
  cost_center?: string;
  project?: string;
  scan_barcode?: string;
  update_stock?: boolean;
  sales_order_id?: string;
  delivery_note_id?: string;
  return_against_id?: string;
  return_reason?: string;
  currency: string;
  total_qty?: number;
  net_total: number;
  tax_category?: string;
  taxes_and_charges?: string;
  shipping_rule?: string;
  incoterm?: string;
  tax_rate: number;
  tax_amount: number;
  total_taxes_and_charges?: number;
  use_company_roundoff_cost_center?: boolean;
  grand_total: number;
  rounding_adjustment?: number;
  rounded_total?: number;
  total_advance?: number;
  outstanding_amount: number;
  apply_discount_on?: string;
  coupon_code?: string;
  additional_discount_percentage?: number;
  discount_amount?: number;
  is_cash_or_non_trade_discount?: boolean;
  allocate_advances_automatically?: boolean;
  redeem_loyalty_points?: boolean;
  loyalty_program?: string;
  customer_address?: string;
  contact_person?: string;
  territory?: string;
  shipping_address_name?: string;
  dispatch_address_name?: string;
  company_address?: string;
  payment_terms_template?: string;
  tc_name?: string;
  terms_and_conditions?: string;
  po_no?: string;
  po_date?: string;
  debit_to?: string;
  sales_partner?: string;
  amount_eligible_for_commission?: number;
  commission_rate?: number;
  total_commission?: number;
  letter_head?: string;
  group_same_items?: boolean;
  select_print_heading?: string;
  language?: string;
  subscription?: string;
  from_date?: string;
  to_date?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  is_paid: boolean;
  refund_status: string;
  refund_reference?: string;
  refunded_at?: string;
  items: SalesInvoiceItem[];
  created_at?: string;
  updated_at?: string;
};

export type SalesInvoiceOptions = {
  naming_series: string[];
  companies: string[];
  warehouses: string[];
  customers: string[];
  currencies: string[];
  tax_categories: string[];
  taxes_templates: string[];
  shipping_rules: string[];
  incoterms: string[];
  apply_discount_on: string[];
  cost_centers: string[];
  projects: string[];
};

export const salesInvoiceApi = {
  async list(params?: { q?: string; status?: string }): Promise<SalesInvoice[]> {
    const response = await api.get<{ data: SalesInvoice[] }>("/selling/sales-invoices", { params });
    return response.data.data || [];
  },
  async get(id: string): Promise<SalesInvoice> {
    const response = await api.get<SalesInvoice>(`/selling/sales-invoices/${id}`);
    return response.data;
  },
  async create(input: SalesInvoice): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>("/selling/sales-invoices", input);
    return response.data;
  },
  async update(id: string, input: SalesInvoice): Promise<SalesInvoice> {
    const response = await api.put<SalesInvoice>(`/selling/sales-invoices/${id}`, input);
    return response.data;
  },
  async submit(id: string): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>(`/selling/sales-invoices/${id}/submit`);
    return response.data;
  },
  async createReturn(id: string, payload: { reason: string; items: Array<{ against_item_id: string; quantity: number }> }): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>(`/selling/sales-invoices/${id}/return`, payload);
    return response.data;
  },
  async markPaid(id: string): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>(`/selling/sales-invoices/${id}/mark-paid`);
    return response.data;
  },
  async refund(id: string, reference: string): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>(`/selling/sales-invoices/${id}/refund`, { reference });
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/selling/sales-invoices/${id}`);
  },
  async options(): Promise<SalesInvoiceOptions> {
    const response = await api.get<SalesInvoiceOptions>("/selling/sales-invoices/options");
    return response.data;
  },
};
