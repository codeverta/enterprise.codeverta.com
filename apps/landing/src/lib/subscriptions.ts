import type { LevelPlanId } from "./level-plans";

export type LmsRole = "admin" | "mentor" | "parent" | "student";
export type LmsSubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";

export interface LocalSubscription {
  id: string;
  parentEmail: string;
  status: LmsSubscriptionStatus;
  levelId: LevelPlanId;
  seats: number;
  amountIdr: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: "xendit";
  providerReference?: string;
  receiptEmailSentAt?: string;
  credentialsEmailSentAt?: string;
}

const SUBSCRIPTION_KEY = "kita_lms_subscription";
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function uid() {
  return "sub_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function readSubscription(): LocalSubscription | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_KEY);
    return raw ? (JSON.parse(raw) as LocalSubscription) : null;
  } catch {
    return null;
  }
}

function writeSubscription(subscription: LocalSubscription | null) {
  if (typeof window === "undefined") return;
  try {
    if (subscription) localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription));
    else localStorage.removeItem(SUBSCRIPTION_KEY);
  } catch {
    /* local storage may be unavailable */
  }
}

export function activateSubscription(input: {
  parentEmail: string;
  levelId: LevelPlanId;
  seats: number;
  amountIdr: number;
  providerReference?: string;
}) {
  const now = Date.now();
  const subscription: LocalSubscription = {
    id: uid(),
    parentEmail: input.parentEmail,
    status: "active",
    levelId: input.levelId,
    seats: input.seats,
    amountIdr: input.amountIdr,
    currentPeriodStart: new Date(now).toISOString(),
    currentPeriodEnd: new Date(now + MONTH_MS).toISOString(),
    cancelAtPeriodEnd: false,
    provider: "xendit",
    providerReference: input.providerReference,
    receiptEmailSentAt: new Date(now).toISOString(),
    credentialsEmailSentAt: new Date(now).toISOString(),
  };
  writeSubscription(subscription);
  return subscription;
}

export function cancelSubscriptionAtPeriodEnd() {
  const current = readSubscription();
  if (!current) return null;
  const next: LocalSubscription = { ...current, cancelAtPeriodEnd: true };
  writeSubscription(next);
  return next;
}

export function hasLearningAccess(subscription = readSubscription()) {
  if (!subscription) return false;
  if (subscription.status === "active" || subscription.status === "trial") {
    return new Date(subscription.currentPeriodEnd).getTime() > Date.now();
  }
  return false;
}

export const TEST_USERS: Array<{
  role: LmsRole;
  email: string;
  password: string;
  name: string;
  childName?: string;
}> = [
  { role: "admin", email: "admin@kita.test", password: "password123", name: "Admin KITA" },
  { role: "mentor", email: "mentor@kita.test", password: "password123", name: "Mentor KITA" },
  { role: "parent", email: "orangtua@kita.test", password: "password123", name: "Ibu Demo", childName: "Ahmad" },
  { role: "student", email: "siswa@kita.test", password: "password123", name: "Ahmad Demo", childName: "Ahmad" },
];

export function findTestUser(email: string, password: string) {
  return TEST_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
}
