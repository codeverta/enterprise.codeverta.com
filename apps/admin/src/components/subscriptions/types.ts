// ─── Types ───────────────────────────────────────────────────────────────────

export type Subscription = {
  id: string;
  student_id: string;
  parent_id: string;
  course_id?: string;
  plan_id?: string;
  provider_plan_id?: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  amount: number;
  currency: string;
  interval: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  provider?: string;
  // joined
  student_name?: string;
  parent_name?: string;
  course_title?: string;
  plan_name?: string;
};


export type PricingPlan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  is_active: boolean;
  requires_approval?: boolean;
  features?: string[] | string;
  pricing_category_id?: string;
  feature_meta?: {
    rules?: {
      can_create_course?: boolean;
      create_requirement?: "none" | "all" | "minimum" | "selected";
      min_completed_courses_to_create?: number;
      create_required_course_ids?: string[];
      can_sell_course?: boolean;
      min_courses_to_sell?: number;
      min_lessons_to_sell?: number;
      sell_requirement?: "none" | "all" | "minimum" | "selected";
      min_completed_courses_to_sell?: number;
      sell_required_course_ids?: string[];
    };
    [key: string]: unknown;
  } | string | null;
  pricing_category?: {
    id: string;
    name: string;
    slug?: string;
    checkout_type?: string;
  };
};

export type SortDir = "asc" | "desc";

export type PricingCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  is_active: boolean;
  checkout_type?: string;
};

export const CHECKOUT_TYPE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "parent-external", label: "Parent External" },
];

export type Payment = {
  id: string;
  subscription_id?: string;
  parent_id: string;
  student_id: string;
  course_id?: string;
  status: "pending" | "paid" | "failed" | "expired";
  amount: number;
  currency: string;
  provider: string;
  external_id?: string;
  invoice_url?: string;
  paid_at?: string;
  created_at?: string;
  // joined
  student_name?: string;
  parent_name?: string;
};
