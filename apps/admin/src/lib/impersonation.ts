const ORIGINAL_SESSION_KEY = "impersonationOriginalSession";
const IMPERSONATION_KEY = "impersonationSession";

export type ImpersonationMetadata = {
  session_id: string;
  impersonator_id: string;
  target_user_id: string;
  target_name?: string;
  target_username?: string;
  target_role: number;
  reason: string;
  expires_at: string;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: string;
};

export function readImpersonation(): ImpersonationMetadata | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function beginImpersonation(data: {
  access_token: string;
  refresh_token: string;
  user: unknown;
  impersonation: ImpersonationMetadata;
}) {
  if (!readImpersonation()) {
    const original: StoredSession = {
      accessToken: localStorage.getItem("accessToken") || "",
      refreshToken: localStorage.getItem("refreshToken") || "",
      user: localStorage.getItem("user") || "",
    };
    if (!original.accessToken || !original.refreshToken || !original.user) {
      throw new Error("Sesi admin asli tidak lengkap. Silakan login ulang.");
    }
    localStorage.setItem(ORIGINAL_SESSION_KEY, JSON.stringify(original));
  }

  localStorage.setItem("accessToken", data.access_token);
  localStorage.setItem("refreshToken", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(data.impersonation));
}

export function restoreOriginalAdminSession(): boolean {
  try {
    const raw = localStorage.getItem(ORIGINAL_SESSION_KEY);
    if (!raw) return false;
    const original = JSON.parse(raw) as StoredSession;
    if (!original.accessToken || !original.refreshToken || !original.user) return false;
    localStorage.setItem("accessToken", original.accessToken);
    localStorage.setItem("refreshToken", original.refreshToken);
    localStorage.setItem("user", original.user);
    localStorage.removeItem(ORIGINAL_SESSION_KEY);
    localStorage.removeItem(IMPERSONATION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearImpersonationStorage() {
  localStorage.removeItem(ORIGINAL_SESSION_KEY);
  localStorage.removeItem(IMPERSONATION_KEY);
}
