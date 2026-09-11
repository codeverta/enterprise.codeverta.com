import api from "@/lib/api";

export type PricingRuleItem = {
  id?: string;
  pricing_rule_id?: string;
  item_code?: string;
  item_group?: string;
  brand?: string;
  uom?: string;
};

export type PricingRule = {
  id?: string;
  tenant_id?: string;
  naming_series: string;
  title: string;
  disable: boolean;
  apply_on: string; // 'Item Code' | 'Item Group' | 'Brand' | 'Transaction'
  price_or_product_discount: string; // 'Price' | 'Product'
  warehouse?: string;
  mixed_conditions: boolean;
  is_cumulative: boolean;
  coupon_code_based: boolean;
  selling: boolean;
  buying: boolean;
  applicable_for: string; // 'Customer' | 'Customer Group' | 'Territory' | 'Sales Partner' | 'Campaign' | 'Supplier' | 'Supplier Group'
  party?: string;
  min_qty: number;
  max_qty: number;
  min_amt: number;
  max_amt: number;
  valid_from?: string;
  valid_upto?: string;
  company?: string;
  currency: string;
  margin_type?: string; // 'Percentage' | 'Amount'
  margin_rate_or_amount: number;
  rate_or_discount: string; // 'Rate' | 'Discount Percentage' | 'Discount Amount'
  rate: number;
  discount_percentage: number;
  discount_amount: number;
  for_price_list?: string;
  condition?: string;
  apply_multiple_pricing_rules: boolean;
  threshold_percentage: number;
  validate_applied_rule: boolean;
  has_priority: boolean;
  priority: number;
  items?: PricingRuleItem[];
  created_at?: string;
  updated_at?: string;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export const pricingRuleApi = {
  list: async (params?: { q?: string; apply_on?: string; disable?: string }) =>
    unwrap(await api.get("/selling/pricing-rules", { params })) as PricingRule[],

  get: async (id: string) =>
    unwrap(await api.get(`/selling/pricing-rules/${id}`)) as PricingRule,

  create: async (data: Partial<PricingRule>) =>
    unwrap(await api.post("/selling/pricing-rules", data)) as PricingRule,

  update: async (id: string, data: Partial<PricingRule>) =>
    unwrap(await api.put(`/selling/pricing-rules/${id}`, data)) as PricingRule,

  remove: async (id: string) =>
    api.delete(`/selling/pricing-rules/${id}`),

  listItems: async (q = "") => {
    try {
      const res = await api.get("/buying/items", { params: { q } });
      return (unwrap(res) || []) as { item_code: string; item_name: string; stock_uom?: string }[];
    } catch {
      return [];
    }
  },

  listItemGroups: async () => {
    try {
      const res = await api.get("/selling/item-groups");
      return (unwrap(res) || []) as { id?: string; item_group_name: string; name?: string }[];
    } catch {
      return [];
    }
  },

  listPriceLists: async () => {
    try {
      const res = await api.get("/selling/price-lists");
      return (unwrap(res) || []) as { id?: string; price_list_name: string; currency?: string }[];
    } catch {
      return [];
    }
  },

  listUOMs: async (q = "") => {
    try {
      const res = await api.get("/stock/uoms", { params: q ? { q } : undefined });
      return (unwrap(res) || []) as { id?: string; uom_name: string; symbol?: string }[];
    } catch {
      return [];
    }
  },

  listWarehouses: async () => {
    try {
      const res = await api.get("/stock/warehouses");
      return (unwrap(res) || []) as { id?: string; warehouse_name?: string; name?: string }[];
    } catch {
      return [];
    }
  },

  listCompanies: async () => {
    try {
      const res = await api.get("/core/companies");
      return (unwrap(res) || []) as { id?: string; name?: string; company_name?: string }[];
    } catch {
      return [];
    }
  },

  listCurrencies: async () => {
    try {
      const res = await api.get("/accounting/currencies");
      return (unwrap(res) || []) as { code: string; name?: string; symbol?: string }[];
    } catch {
      return [];
    }
  },
};
