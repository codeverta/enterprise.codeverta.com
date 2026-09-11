import api from "@/lib/api";

export type SubscriptionPlan = {
  id?: string;
  plan_name: string;
  currency: string;
  item: string;
  price_determination: "Fixed Rate" | "Based On Price List" | "Monthly Rate" | string;
  cost?: number;
  price_list?: string;
  billing_interval: "Day" | "Week" | "Month" | "Year" | string;
  billing_interval_count: number;
  product_price_id?: string;
  payment_gateway?: string;
  cost_center?: string;
  disabled?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export const subscriptionPlanApi = {
  list: async (params?: { q?: string; status?: string }) => {
    const res = await api.get<{ data: SubscriptionPlan[] }>("/selling/subscription-plans", { params });
    return res.data.data;
  },
  get: async (id: string) => {
    const res = await api.get<{ data: SubscriptionPlan }>(`/selling/subscription-plans/${id}`);
    return res.data.data;
  },
  create: async (data: Partial<SubscriptionPlan>) => {
    const res = await api.post<{ data: SubscriptionPlan; message: string }>("/selling/subscription-plans", data);
    return res.data;
  },
  update: async (id: string, data: Partial<SubscriptionPlan>) => {
    const res = await api.put<{ data: SubscriptionPlan; message: string }>(`/selling/subscription-plans/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete<{ message: string }>(`/selling/subscription-plans/${id}`);
    return res.data;
  },
};
