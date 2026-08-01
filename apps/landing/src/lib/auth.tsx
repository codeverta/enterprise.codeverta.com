import { createContext, useContext, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";

type TrialMeta = { plan?: "trial" | "subscriber" };

type AuthCtx = {
  user: Record<string, any> | null;
  session: any | null;
  roles: string[];
  isAdmin: boolean;
  isMentor: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  login: (email: string, name?: string) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [loading] = useState(false);

  const value: AuthCtx = {
    user, session: null, roles: [], isAdmin: false, isMentor: false,
    isAuthenticated: false, hasActiveSubscription: false,
    isTrialActive: false, trialDaysLeft: 0, loading,
    signIn: async () => ({}),
    signUp: async () => ({}),
    signOut: async () => { setUser(null); },
    login: () => {},
    logout: async () => { setUser(null); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export type AppRole = string;
