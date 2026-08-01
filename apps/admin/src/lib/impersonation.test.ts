import { beforeEach, describe, expect, it } from "vitest";
import {
  beginImpersonation,
  clearImpersonationStorage,
  readImpersonation,
  restoreOriginalAdminSession,
} from "./impersonation";

describe("impersonation session storage", () => {
  beforeEach(() => localStorage.clear());

  it("switches to the target and restores the original admin session", () => {
    localStorage.setItem("accessToken", "admin-access");
    localStorage.setItem("refreshToken", "admin-refresh");
    localStorage.setItem("user", JSON.stringify({ id: "admin", role: 99 }));

    beginImpersonation({
      access_token: "student-access",
      refresh_token: "student-refresh",
      user: { id: "student", role: 20 },
      impersonation: {
        session_id: "session-1",
        impersonator_id: "admin",
        target_user_id: "student",
        target_name: "Debug Student",
        target_role: 20,
        reason: "Debug course visibility",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(localStorage.getItem("accessToken")).toBe("student-access");
    expect(readImpersonation()?.target_user_id).toBe("student");
    expect(restoreOriginalAdminSession()).toBe(true);
    expect(localStorage.getItem("accessToken")).toBe("admin-access");
    expect(JSON.parse(localStorage.getItem("user") || "{}").role).toBe(99);
    expect(readImpersonation()).toBeNull();
  });

  it("clears all impersonation metadata", () => {
    localStorage.setItem("impersonationSession", "{}");
    localStorage.setItem("impersonationOriginalSession", "{}");
    clearImpersonationStorage();
    expect(localStorage.getItem("impersonationSession")).toBeNull();
    expect(localStorage.getItem("impersonationOriginalSession")).toBeNull();
  });
});
