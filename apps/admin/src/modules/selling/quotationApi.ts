import api from "@/lib/api";

export interface QuotationItem {
  id?: string;
  quotation_id?: string;
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Quotation {
  id?: string;
  naming_series: string;
  quotation_number?: string;
  quotation_to: string;
  party_name: string;
  customer_name?: string;
  transaction_date: string;
  valid_till?: string;
  order_type: string;
  company: string;
  currency: string;
  selling_price_list: string;
  scan_barcode?: string;
  total_qty: number;
  total: number;
  tax_category?: string;
  taxes_and_charges?: string;
  shipping_rule?: string;
  incoterm?: string;
  base_total_taxes_and_charges: number;
  total_taxes_and_charges: number;
  grand_total: number;
  rounding_adjustment: number;
  rounded_total: number;
  disable_rounded_total: boolean;
  apply_discount_on: string;
  coupon_code?: string;
  additional_discount_percentage: number;
  discount_amount: number;
  sales_partner?: string;
  status: string;
  items: QuotationItem[];
  created_at?: string;
  updated_at?: string;
}

export const quotationApi = {
  async list(params?: { q?: string }): Promise<Quotation[]> {
    const res = await api.get<{ data: Quotation[] }>("/selling/quotations", { params });
    return res.data?.data || [];
  },

  async get(id: string): Promise<Quotation> {
    const res = await api.get<{ data: Quotation }>(`/selling/quotations/${id}`);
    return res.data?.data;
  },

  async create(data: Partial<Quotation>): Promise<Quotation> {
    const res = await api.post<{ data: Quotation }>("/selling/quotations", data);
    return res.data?.data;
  },

  async update(id: string, data: Partial<Quotation>): Promise<Quotation> {
    const res = await api.put<{ data: Quotation }>(`/selling/quotations/${id}`, data);
    return res.data?.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/selling/quotations/${id}`);
  },
};
