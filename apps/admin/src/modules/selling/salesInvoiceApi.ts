import api from "@/lib/api";

export type SalesInvoiceStatus = "Draft" | "Submitted" | "Cancelled";

export type SalesInvoiceItem = {
  id?: string;
  against_item_id?: string;
  item_code: string;
  item_name?: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
};

export type SalesInvoice = {
  id?: string;
  number?: string;
  status: SalesInvoiceStatus;
  customer: string;
  company: string;
  posting_date: string;
  due_date?: string;
  sales_order_id?: string;
  delivery_note_id?: string;
  is_return: boolean;
  return_against_id?: string;
  return_reason?: string;
  currency: string;
  net_total: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  outstanding_amount: number;
  is_paid: boolean;
  refund_status: string;
  refund_reference?: string;
  refunded_at?: string;
  items: SalesInvoiceItem[];
  created_at?: string;
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
  async createReturn(id: string, input: { reason: string; items: Array<{ against_item_id: string; quantity: number }> }): Promise<SalesInvoice> {
    const response = await api.post<SalesInvoice>(`/selling/sales-invoices/${id}/return`, input);
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
};
