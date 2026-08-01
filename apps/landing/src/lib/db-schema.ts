/**
 * Database schema contract — mirrors the future Supabase tables.
 *
 * This module is the single source of truth for the shape of data that will
 * be persisted once Lovable Cloud / Supabase is enabled. Keep it in sync with
 * the SQL migrations defined under `supabase/migrations/*` (to be added).
 *
 * Future Supabase tables (proposed):
 *   - profiles              (1:1 with auth.users; parent or student profile)
 *   - user_roles            (separate roles table — never store role on profiles)
 *   - student_profiles      (per-child record, linked to a parent profile)
 *   - subscriptions         (current plan & status per parent account)
 *   - payment_history       (every payment attempt, success or failure)
 *   - course_progress       (per-student progress per module/lesson)
 *   - student_portfolio     (artifacts: drawings, recordings, milestones)
 *
 * RLS expectations:
 *   - Parents can read/write only their own profile + their children's data.
 *   - Students can read/write only their own course_progress + portfolio.
 *   - Admin role required for any cross-account read.
 *   - Roles are checked via a SECURITY DEFINER `has_role()` function to
 *     avoid recursive RLS issues. See user-roles guidance in the agent prompt.
 */

export type AppRole = "admin" | "mentor" | "parent" | "student";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type PaymentMethod =
  | "qris"
  | "va"
  | "bank_transfer"
  | "ewallet"
  | "card";

export type PaymentProvider = "xendit" | "midtrans" | "duitku" | "tripay";

/** profiles table */
export interface ParentProfile {
  id: string; // = auth.users.id
  email: string;
  full_name: string;
  whatsapp?: string;
  city?: string;
  created_at: string;
}

/** student_profiles table */
export interface StudentProfile {
  id: string;
  parent_id: string; // FK → profiles.id
  full_name: string;
  age: number;
  curriculum_level?: string; // e.g. "Early Years", "Foundation"
  avatar_url?: string;
  created_at: string;
}

/** subscriptions table (one active row per parent) */
export interface Subscription {
  id: string;
  parent_id: string;
  status: SubscriptionStatus;
  plan: "monthly" | "yearly";
  seats: number; // number of student slots
  price_per_seat_idr: number;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  provider?: PaymentProvider;
  provider_subscription_id?: string;
}

/** payment_history table */
export interface PaymentRecord {
  id: string;
  parent_id: string;
  subscription_id?: string;
  amount_idr: number;
  method: PaymentMethod;
  provider: PaymentProvider;
  provider_reference?: string; // gateway order/invoice id
  status: PaymentStatus;
  created_at: string;
  paid_at?: string;
}

/** course_progress table */
export interface CourseProgress {
  id: string;
  student_id: string;
  module_id: string;
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  score?: number;
  completed_at?: string;
}

/** student_portfolio table */
export interface PortfolioItem {
  id: string;
  student_id: string;
  kind: "artwork" | "audio" | "video" | "milestone" | "note";
  title: string;
  description?: string;
  storage_path?: string; // Supabase Storage path
  created_at: string;
}
