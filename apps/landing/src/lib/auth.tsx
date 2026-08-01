import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import api from "./api";

export type BuyerUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  birthDate: string;
  gender: string;
  avatar?: string;
  address: string;
  memberSince: string;
  balance: number;
};

type AuthResult = { error?: string };
type AuthCtx = {
  user: BuyerUser | null;
  session: { userId: string } | null;
  roles: string[];
  isAdmin: boolean;
  isMentor: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  login: (email: string, name?: string) => void;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<BuyerUser>) => Promise<AuthResult>;
  refreshProfile: () => Promise<BuyerUser | null>;
};

type RawBuyer = {
  id: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  avatar?: string;
  address?: string;
  member_since?: string;
  created_at?: string;
  balance?: number;
};

const USER_KEY = "lumea_buyer_user";
const Ctx = createContext<AuthCtx | null>(null);

function cachedUser(): BuyerUser | null {
  if (typeof window === "undefined") return null;
  if (!localStorage.getItem("accessToken")) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function normalizeBuyer(raw: RawBuyer): BuyerUser {
  return {
    id: raw.id,
    email: raw.email || "",
    fullName: raw.full_name || raw.display_name || raw.email?.split("@")[0] || "Buyer",
    phone: raw.phone || "",
    birthDate: raw.birth_date || "",
    gender: raw.gender || "",
    avatar: raw.avatar || "",
    address: raw.address || "",
    memberSince: raw.member_since || raw.created_at || new Date().toISOString(),
    balance: Number(raw.balance || 0),
  };
}

function apiError(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
  return response?.data?.message || response?.data?.error || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BuyerUser | null>(() => cachedUser());
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("accessToken")));

  const setSession = (next: BuyerUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(USER_KEY);
  };

  const refreshProfile = async () => {
    if (!localStorage.getItem("accessToken")) {
      setSession(null);
      return null;
    }
    try {
      const response = await api.get<{ data: RawBuyer }>("/store/me");
      const buyer = normalizeBuyer(response.data.data);
      setSession(buyer);
      return buyer;
    } catch {
      setSession(null);
      return null;
    }
  };

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("accessToken")) {
      setSession(null);
      setLoading(false);
      return;
    }
    refreshProfile().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post<{
        data: { access_token: string; refresh_token: string; user: RawBuyer };
      }>("/auth/login", { email: email.trim().toLowerCase(), password });
      localStorage.setItem("accessToken", response.data.data.access_token);
      localStorage.setItem("refreshToken", response.data.data.refresh_token);
      const buyer = await refreshProfile();
      if (!buyer) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return { error: "Profil buyer tidak dapat dimuat." };
      }
      return {};
    } catch (error) {
      return { error: apiError(error, "Email atau kata sandi tidak sesuai.") };
    }
  };

  const signUp = async (email: string, password: string, fullName = "") => {
    try {
      await api.post("/store/auth/register", {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
      });
      return signIn(email, password);
    } catch (error) {
      return { error: apiError(error, "Akun buyer gagal dibuat.") };
    }
  };

  const signOut = async () => {
    try {
      await api.get("/auth/logout");
    } catch {
      // Local token cleanup remains authoritative when the server is unavailable.
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setSession(null);
  };

  const updateProfile = async (updates: Partial<BuyerUser>) => {
    if (!user) return { error: "Silakan masuk terlebih dahulu." };
    const optimistic = { ...user, ...updates };
    setSession(optimistic);
    try {
      const response = await api.put<{ data: RawBuyer }>("/store/me", {
        full_name: optimistic.fullName,
        phone: optimistic.phone,
        birth_date: optimistic.birthDate,
        gender: optimistic.gender,
        address: optimistic.address,
      });
      setSession(normalizeBuyer(response.data.data));
      return {};
    } catch (error) {
      setSession(user);
      return { error: apiError(error, "Profil gagal diperbarui.") };
    }
  };

  const value: AuthCtx = {
    user,
    session: user ? { userId: user.id } : null,
    roles: user ? ["buyer"] : [],
    isAdmin: false,
    isMentor: false,
    isAuthenticated: Boolean(user),
    hasActiveSubscription: false,
    isTrialActive: false,
    trialDaysLeft: 0,
    loading,
    signIn,
    signUp,
    signOut,
    login: (email, name) =>
      setSession({
        id: "",
        email,
        fullName: name || email.split("@")[0],
        phone: "",
        birthDate: "",
        gender: "",
        address: "",
        memberSince: new Date().toISOString(),
        balance: 0,
      }),
    logout: signOut,
    updateProfile,
    refreshProfile,
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export type AppRole = string;
