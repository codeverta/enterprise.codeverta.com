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

  listCompanies: async (): Promise<{ id?: string; name: string; abbreviation?: string; address?: string }[]> => {
    try {
      const res = await api.get("/companies");
      const list = unwrap(res);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    try {
      const res = await api.get("/organization/companies");
      const list = unwrap(res);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return [];
  },

  listCompanyAddresses: async (companyIdOrName: string): Promise<{ id?: string; address_title?: string; address_line1?: string; city?: string }[]> => {
    if (!companyIdOrName) return [];
    try {
      const res = await api.get(`/companies/${encodeURIComponent(companyIdOrName)}/addresses`);
      const list = unwrap(res);
      if (Array.isArray(list)) return list;
    } catch {}
    try {
      const res = await api.get(`/organization/companies/${encodeURIComponent(companyIdOrName)}/addresses`);
      const list = unwrap(res);
      if (Array.isArray(list)) return list;
    } catch {}
    return [];
  },

  listCustomers: async (): Promise<{ id?: string; customer_name: string }[]> => {
    try {
      const res = await api.get("/selling/customers");
      return unwrap(res) || [];
    } catch {
      return [{ customer_name: "Walk-in Customer" }];
    }
  },

  listUsers: async (): Promise<{ id?: string; username: string; display_name?: string }[]> => {
    try {
      const res = await api.get("/users");
      const list = unwrap(res);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return [{ username: "Administrator", display_name: "Administrator" }];
  },

  listCurrencies: async (): Promise<{ name: string; symbol?: string; enabled?: boolean }[]> => {
    try {
      const res = await api.get("/currencies");
      return unwrap(res) || [];
    } catch {
      return [{ name: "IDR", symbol: "Rp", enabled: true }, { name: "USD", symbol: "$", enabled: true }];
    }
  },

  listPriceLists: async (): Promise<string[]> => {
    try {
      const res = await api.get("/selling/price-lists");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.price_list_name || item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return ["Standard Selling"];
  },

  listItemGroups: async (): Promise<string[]> => {
    try {
      const res = await api.get("/selling/item-groups");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.item_group_name || item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return ["All Item Groups", "Products", "Raw Material", "Services"];
  },

  listCustomerGroups: async (): Promise<string[]> => {
    try {
      const res = await api.get("/selling/customer-groups");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.group_name || item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return ["All Customer Groups", "Individual", "Commercial", "Non Profit"];
  },

  listLetterHeads: async (): Promise<string[]> => {
    try {
      const res = await api.get("/organization/letter-heads");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return ["Standard", "Kop Surat Resmi"];
  },

  listTaxCategories: async (): Promise<string[]> => {
    try {
      const res = await api.get("/selling/tax-categories");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.title || item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return [];
  },

  listProjects: async (): Promise<string[]> => {
    try {
      const res = await api.get("/projects");
      const list = unwrap(res);
      if (Array.isArray(list)) {
        return list.map((item: any) => item.project_name || item.name || String(item)).filter(Boolean);
      }
    } catch {}
    return [];
  },
};
