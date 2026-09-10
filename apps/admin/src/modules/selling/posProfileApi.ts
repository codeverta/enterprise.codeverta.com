import api from "@/lib/api";

export type POSProfileUser = {
  id?: string;
  pos_profile_id?: string;
  user: string;
  default?: boolean;
};

export type POSProfilePaymentMethod = {
  id?: string;
  pos_profile_id?: string;
  mode_of_payment: string;
  default?: boolean;
  allow_in_returns?: boolean;
};

export type POSProfileItemGroup = {
  id?: string;
  pos_profile_id?: string;
  item_group: string;
};

export type POSProfileCustomerGroup = {
  id?: string;
  pos_profile_id?: string;
  customer_group: string;
};

export type POSProfile = {
  id?: string;
  name: string;
  company: string;
  customer?: string;
  country?: string;
  disabled?: boolean;
  warehouse?: string;
  company_address?: string;
  hide_images?: boolean;
  hide_unavailable_items?: boolean;
  auto_add_item_to_cart?: boolean;
  validate_stock_on_save?: boolean;
  print_receipt_on_order_complete?: boolean;
  action_on_new_invoice?: string;
  ignore_pricing_rule?: boolean;
  allow_rate_change?: boolean;
  allow_discount_change?: boolean;
  set_grand_total_to_default_mop?: boolean;
  allow_partial_payment?: boolean;
  print_format?: string;
  letter_head?: string;
  tc_name?: string;
  select_print_heading?: string;
  selling_price_list?: string;
  currency?: string;
  write_off_account?: string;
  write_off_cost_center?: string;
  write_off_limit?: number;
  account_for_change_amount?: string;
  disable_rounded_total?: boolean;
  income_account?: string;
  expense_account?: string;
  taxes_and_charges?: string;
  tax_category?: string;
  apply_discount_on?: string;
  cost_center?: string;
  project?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  applicable_for_users?: POSProfileUser[];
  payments?: POSProfilePaymentMethod[];
  item_groups?: POSProfileItemGroup[];
  customer_groups?: POSProfileCustomerGroup[];
  created_at?: string;
  updated_at?: string;
};

export type POSProfileOptions = {
  companies: string[];
  users: string[];
  modes_of_payment: string[];
  action_on_new_invoices: string[];
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const posProfileApi = {
  list: async (params?: { q?: string; company?: string; disabled?: boolean }): Promise<POSProfile[]> => {
    const res = await api.get("/selling/pos-profiles", { params });
    return unwrap(res) || [];
  },

  get: async (id: string): Promise<POSProfile> => {
    const res = await api.get(`/selling/pos-profiles/${id}`);
    return unwrap(res);
  },

  create: async (data: Partial<POSProfile>): Promise<POSProfile> => {
    const res = await api.post("/selling/pos-profiles", data);
    return unwrap(res);
  },

  update: async (id: string, data: Partial<POSProfile>): Promise<POSProfile> => {
    const res = await api.put(`/selling/pos-profiles/${id}`, data);
    return unwrap(res);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/selling/pos-profiles/${id}`);
  },

  options: async (): Promise<POSProfileOptions> => {
    const res = await api.get("/selling/pos-profiles/options");
    return unwrap(res);
  },
};
