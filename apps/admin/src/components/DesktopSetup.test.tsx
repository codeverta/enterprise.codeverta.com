import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDesktopConfig: vi.fn(),
  getDesktopRecoveryStatus: vi.fn(),
  restoreDesktopRecoveryBackup: vi.fn(),
  waitForApi: vi.fn(),
  cacheDesktopConfig: vi.fn(),
  toastWarning: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/desktop-runtime", () => ({
  getDesktopConfig: mocks.getDesktopConfig,
  getDesktopRecoveryStatus: mocks.getDesktopRecoveryStatus,
  restoreDesktopRecoveryBackup: mocks.restoreDesktopRecoveryBackup,
  waitForApi: mocks.waitForApi,
  cacheDesktopConfig: mocks.cacheDesktopConfig,
  configureDesktop: vi.fn(),
  runtimeApiUrl: (value: string) => value,
}));

vi.mock("sonner", () => ({
  toast: {
    warning: mocks.toastWarning,
    success: mocks.toastSuccess,
  },
}));

import { DesktopBootstrap } from "./DesktopSetup";

const config = {
  mode: "offline",
  language: "id",
  currency: "IDR",
  workspaceName: "Recovery Test",
  serverUrl: null,
  apiUrl: "http://127.0.0.1:7843",
};

describe("DesktopBootstrap recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("codeverta.desktop.runtime", JSON.stringify(config));
    mocks.getDesktopConfig.mockResolvedValue(config);
    mocks.restoreDesktopRecoveryBackup.mockResolvedValue(undefined);
    mocks.getDesktopRecoveryStatus.mockResolvedValue({
      migrationInterrupted: true,
      lastRecovery: null,
      backups: [{ name: "schema-v0-to-v1.db", size: 2_097_152, createdAt: 1_789_315_200 }],
    });
  });

  it("offers a verified recovery snapshot when the offline API cannot start", async () => {
    mocks.waitForApi.mockRejectedValue(new Error("migration failed"));
    render(<DesktopBootstrap><div>ERP ready</div></DesktopBootstrap>);

    expect(await screen.findByText("Recovery database")).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveValue("schema-v0-to-v1.db");
    fireEvent.click(screen.getByRole("button", { name: "Pulihkan snapshot" }));

    await waitFor(() => {
      expect(mocks.restoreDesktopRecoveryBackup).toHaveBeenCalledWith("schema-v0-to-v1.db");
    });
  });

  it("notifies the user once after automatic crash recovery", async () => {
    mocks.waitForApi.mockResolvedValue(undefined);
    mocks.getDesktopRecoveryStatus.mockResolvedValue({
      migrationInterrupted: false,
      backups: [],
      lastRecovery: { recoveredAt: "2026-09-13T14:00:00Z", reason: "interrupted migration" },
    });
    render(<DesktopBootstrap><div>ERP ready</div></DesktopBootstrap>);

    expect(await screen.findByText("ERP ready")).toBeInTheDocument();
    expect(mocks.toastWarning).toHaveBeenCalledOnce();
  });
});
