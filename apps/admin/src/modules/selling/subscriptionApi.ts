import api from "@/lib/api";

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

export interface SubscriptionPlanItem {
  id?: string;
  plan: string;
  qty: number;
}

export interface Subscription {
  id?: string;
  subscription_number?: string;
  party_type: "Customer" | "Supplier";
  party: string;
  company: string;
  start_date: string;
  end_date: string;
  trial_period_start: string;
  trial_period_end: string;
  follow_calendar_months: boolean;
  generate_new_invoices_past_due_date: boolean;
  submit_invoice: boolean;
  days_until_due: number;
  generate_invoice_at: string;
  cancel_at_period_end: boolean;
  apply_additional_discount: string;
  additional_discount_percentage: number;
  additional_discount_amount: number;
  cost_center: string;
  status: string;
  plans: SubscriptionPlanItem[];
  created_at?: string;
  updated_at?: string;
}

export const subscriptionApi = {
  list: async (params?: { q?: string; status?: string; party_type?: string }) => {
    const res = await api.get("/selling/subscriptions", { params });
    return unwrap<Subscription[]>(res);
  },
  get: async (id: string) => {
    const res = await api.get(`/selling/subscriptions/${id}`);
    return unwrap<Subscription>(res);
  },
  create: async (data: Partial<Subscription>) => {
    const res = await api.post("/selling/subscriptions", data);
    return unwrap<Subscription>(res);
  },
  update: async (id: string, data: Partial<Subscription>) => {
    const res = await api.put(`/selling/subscriptions/${id}`, data);
    return unwrap<Subscription>(res);
  },
  remove: async (id: string) => {
    const res = await api.delete(`/selling/subscriptions/${id}`);
    return unwrap<any>(res);
  },
};
