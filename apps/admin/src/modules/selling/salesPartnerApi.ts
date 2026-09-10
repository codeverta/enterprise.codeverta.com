import api from "@/lib/api";

export interface SalesPartnerType {
  id?: string;
  partner_type_name: string;
  description?: string;
}

export interface ItemGroupOption {
  id?: string;
  item_group_name: string;
  parent_item_group?: string;
  is_group?: boolean;
}

export interface FiscalYearOption {
  id?: string;
  year_name: string;
  start_date?: string;
  end_date?: string;
  disabled?: boolean;
}

export interface SalesPartnerTarget {
  id?: string;
  sales_partner_id?: string;
  item_group: string;
  fiscal_year: string;
  target_qty: number;
  target_amount: number;
  distribution_id?: string;
}

export interface SalesPartner {
  id?: string;
  partner_name: string;
  partner_type: string;
  territory?: string;
  commission_rate: number;
  show_in_website: boolean;
  referral_code?: string;
  disabled?: boolean;
  targets?: SalesPartnerTarget[];
  created_at?: string;
  updated_at?: string;
}

export interface SalesPartnerOptions {
  partner_types: SalesPartnerType[];
  item_groups: ItemGroupOption[];
  fiscal_years: FiscalYearOption[];
  territories: string[];
  distributions: string[];
}

export const salesPartnerApi = {
  list: async (params?: { q?: string; partner_type?: string; territory?: string }): Promise<SalesPartner[]> => {
    const res = await api.get("/selling/sales-partners", { params });
    return res.data?.data || res.data || [];
  },

  get: async (id: string): Promise<SalesPartner> => {
    const res = await api.get(`/selling/sales-partners/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  create: async (data: SalesPartner): Promise<SalesPartner> => {
    const res = await api.post("/selling/sales-partners", data);
    return res.data?.data || res.data;
  },

  update: async (id: string, data: SalesPartner): Promise<SalesPartner> => {
    const res = await api.put(`/selling/sales-partners/${encodeURIComponent(id)}`, data);
    return res.data?.data || res.data;
  },

  remove: async (id: string): Promise<{ message: string; id: string }> => {
    const res = await api.delete(`/selling/sales-partners/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  listPartnerTypes: async (): Promise<SalesPartnerType[]> => {
    const res = await api.get("/selling/sales-partner-types");
    return res.data?.data || res.data || [];
  },

  createPartnerType: async (data: { partner_type_name: string; description?: string }): Promise<SalesPartnerType> => {
    const res = await api.post("/selling/sales-partner-types", data);
    return res.data?.data || res.data;
  },

  listItemGroups: async (): Promise<ItemGroupOption[]> => {
    const res = await api.get("/selling/item-groups");
    return res.data?.data || res.data || [];
  },

  listFiscalYears: async (): Promise<FiscalYearOption[]> => {
    const res = await api.get("/selling/fiscal-years");
    return res.data?.data || res.data || [];
  },

  options: async (): Promise<SalesPartnerOptions> => {
    const res = await api.get("/selling/sales-partners/options");
    return res.data?.data || res.data || {
      partner_types: [],
      item_groups: [],
      fiscal_years: [],
      territories: [],
      distributions: [],
    };
  },
};
