// Stub Supabase client — no-op when env vars are missing
import type { Session, User as SbUser } from "@supabase/supabase-js";
export type { Session, SbUser };

const stubHandler = {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "finally") return undefined;
    if (prop === "from") return () => stubSelect;
    if (prop === "auth") return stubAuth;
    if (prop === "storage") return stubStorage;
    if (prop === "channel") return { on: () => ({ subscribe: () => {} }) };
    if (["select", "insert", "update", "delete", "order", "eq", "neq", "maybeSingle", "single"].includes(prop as string)) {
      return () => Promise.resolve({ data: null, error: null });
    }
    if (prop === "onAuthStateChange") return () => ({ data: { subscription: { unsubscribe: () => {} } } });
    if (prop === "getSession") return () => Promise.resolve({ data: { session: null }, error: null });
    if (prop === "signUp") return () => Promise.resolve({ data: null, error: null });
    if (prop === "signInWithPassword") return () => Promise.resolve({ data: null, error: null });
    if (prop === "signOut") return () => Promise.resolve({ error: null });
    if (prop === "upload") return () => Promise.resolve({ data: null, error: null });
    if (prop === "getPublicUrl") return () => ({ data: { publicUrl: "" } });
    if (prop === "createSignedUploadUrl") return () => Promise.resolve({ data: null, error: null });
    return () => Promise.resolve({ data: null, error: null });
  },
};

const stubSelect = new Proxy({}, stubHandler);
const stubAuth = new Proxy({}, { get() { return (...args: any[]) => Promise.resolve({ data: null, error: null }); } });
const stubStorage = {
  from: () => stubBucket,
};
const stubBucket = new Proxy({}, stubHandler);

export const supabase = new Proxy({}, stubHandler);
