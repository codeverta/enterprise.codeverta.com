import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: mocks.isTauri, invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));

import { DesktopUpdaterService, updaterErrorMessage } from "./updater";

function fakeUpdate() {
  return {
    currentVersion: "0.0.1",
    version: "0.0.2",
    date: "2026-09-13T00:00:00Z",
    body: "## Perubahan\n- Perbaikan penting",
    close: vi.fn().mockResolvedValue(undefined),
    downloadAndInstall: vi.fn().mockImplementation(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 40 } });
      onEvent({ event: "Progress", data: { chunkLength: 60 } });
      onEvent({ event: "Finished" });
    }),
  };
}

describe("DesktopUpdaterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockResolvedValue(undefined);
    mocks.relaunch.mockResolvedValue(undefined);
  });

  it("does not invoke the native updater in the web application", async () => {
    mocks.isTauri.mockReturnValue(false);
    const service = new DesktopUpdaterService();

    await expect(service.checkForUpdate()).resolves.toBeNull();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("returns null when the installed version is current", async () => {
    mocks.check.mockResolvedValue(null);
    const service = new DesktopUpdaterService();

    await expect(service.checkForUpdate()).resolves.toBeNull();
    expect(mocks.check).toHaveBeenCalledWith({ timeout: 15_000 });
  });

  it("exposes release metadata and reports download progress before restart", async () => {
    const update = fakeUpdate();
    mocks.check.mockResolvedValue(update);
    const service = new DesktopUpdaterService();
    const statuses: string[] = [];
    const percentages: Array<number | undefined> = [];

    await expect(service.checkForUpdate()).resolves.toEqual({
      currentVersion: "0.0.1",
      version: "0.0.2",
      date: "2026-09-13T00:00:00Z",
      notes: "## Perubahan\n- Perbaikan penting",
    });
    await service.installUpdate({
      onStatus: (status) => statuses.push(status),
      onProgress: (progress) => percentages.push(progress.percent),
    });

    expect(update.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_prepare_update");
    expect(statuses).toEqual(["downloading", "installing", "restarting"]);
    expect(percentages).toEqual([0, 40, 100, 100]);
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });

  it("closes the previous native update resource before checking again", async () => {
    const first = fakeUpdate();
    mocks.check.mockResolvedValueOnce(first).mockResolvedValueOnce(null);
    const service = new DesktopUpdaterService();

    await service.checkForUpdate();
    await service.checkForUpdate();

    expect(first.close).toHaveBeenCalledOnce();
  });

  it("does not download when the database recovery marker cannot be persisted", async () => {
    const update = fakeUpdate();
    mocks.check.mockResolvedValue(update);
    mocks.invoke.mockRejectedValue(new Error("Unable to prepare the local database"));
    const service = new DesktopUpdaterService();
    await service.checkForUpdate();

    await expect(service.installUpdate({ onStatus: vi.fn(), onProgress: vi.fn() })).rejects.toThrow(
      "Unable to prepare",
    );
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
  });
});

describe("updaterErrorMessage", () => {
  it("does not expose native signature errors", () => {
    expect(updaterErrorMessage(new Error("signature verification failed: /secret/path"))).toBe(
      "Paket update tidak lolos verifikasi keamanan. Instalasi dibatalkan.",
    );
  });

  it("provides an actionable offline message", () => {
    expect(updaterErrorMessage(new Error("network timeout"))).toContain("Periksa internet");
  });
});
