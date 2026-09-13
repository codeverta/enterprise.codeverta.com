import { invoke, isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "restarting"
  | "latest"
  | "error";

export interface UpdateDetails {
  currentVersion: string;
  version: string;
  date?: string;
  notes?: string;
}

export interface UpdateDownloadProgress {
  downloadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface InstallCallbacks {
  onStatus: (status: UpdaterStatus) => void;
  onProgress: (progress: UpdateDownloadProgress) => void;
}

const CHECK_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export function updaterErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("prepare the local database") || normalized.includes("recovery backup")) {
    return "Backup keamanan database tidak dapat dibuat. Update dibatalkan agar data lokal tetap aman.";
  }
  if (normalized.includes("signature") || normalized.includes("public key")) {
    return "Paket update tidak lolos verifikasi keamanan. Instalasi dibatalkan.";
  }
  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("offline")
  ) {
    return "Tidak dapat terhubung ke server update. Periksa internet lalu coba lagi.";
  }
  if (normalized.includes("permission") || normalized.includes("access denied")) {
    return "Update tidak dapat dipasang karena izin sistem ditolak. Tutup aplikasi lain lalu coba lagi.";
  }
  if (normalized.includes("not found") || normalized.includes("404")) {
    return "Informasi update belum tersedia untuk perangkat ini.";
  }
  return "Update gagal diproses. Silakan coba lagi atau unduh installer terbaru dari halaman rilis.";
}

export class DesktopUpdaterService {
  private update: Update | null = null;
  private checkPromise: Promise<UpdateDetails | null> | null = null;
  private installPromise: Promise<void> | null = null;

  isSupported(): boolean {
    return isTauri();
  }

  async checkForUpdate(): Promise<UpdateDetails | null> {
    if (!this.isSupported()) return null;
    if (this.checkPromise) return this.checkPromise;

    this.checkPromise = this.performCheck();
    try {
      return await this.checkPromise;
    } finally {
      this.checkPromise = null;
    }
  }

  private async performCheck(): Promise<UpdateDetails | null> {
    await this.releaseUpdate();
    const update = await check({ timeout: CHECK_TIMEOUT_MS });
    if (!update) return null;

    this.update = update;
    return {
      currentVersion: update.currentVersion,
      version: update.version,
      date: update.date,
      notes: update.body,
    };
  }

  async installUpdate(callbacks: InstallCallbacks): Promise<void> {
    if (!this.update) {
      throw new Error("Update belum diperiksa atau sudah tidak tersedia.");
    }
    if (this.installPromise) return this.installPromise;

    this.installPromise = this.performInstall(this.update, callbacks);
    try {
      await this.installPromise;
    } finally {
      this.installPromise = null;
    }
  }

  private async performInstall(
    update: Update,
    callbacks: InstallCallbacks,
  ): Promise<void> {
    let downloadedBytes = 0;
    let totalBytes: number | undefined;

    // The new sidecar consumes this marker on first launch and creates a
    // verified SQLite snapshot before any schema/data migration runs.
    await invoke("desktop_prepare_update");
    callbacks.onStatus("downloading");
    await update.downloadAndInstall(
      (event: DownloadEvent) => {
        if (event.event === "Started") {
          downloadedBytes = 0;
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
        } else if (event.event === "Finished") {
          callbacks.onStatus("installing");
        }

        callbacks.onProgress({
          downloadedBytes,
          totalBytes,
          percent: totalBytes
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : undefined,
        });
      },
      { timeout: DOWNLOAD_TIMEOUT_MS },
    );

    // Windows exits while launching its installer. macOS and Linux reach this
    // line and must restart to activate the installed bundle.
    callbacks.onStatus("restarting");
    await relaunch();
  }

  async releaseUpdate(): Promise<void> {
    const update = this.update;
    this.update = null;
    if (!update) return;
    try {
      await update.close();
    } catch (error) {
      // Releasing an obsolete resource must not prevent a fresh update check.
      console.warn("[desktop-updater] Could not release the previous update handle", error);
    }
  }
}

export const desktopUpdaterService = new DesktopUpdaterService();
