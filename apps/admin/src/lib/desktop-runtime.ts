import { invoke, isTauri } from "@tauri-apps/api/core";

export type DesktopMode = "offline" | "server";

export type DesktopRuntimeConfig = {
  mode: DesktopMode;
  language: "id" | "en";
  currency: string;
  workspaceName: string;
  serverUrl?: string | null;
  apiUrl: string;
};

export type DesktopSetupInput = {
  mode: DesktopMode;
  language: "id" | "en";
  currency: string;
  workspaceName: string;
  serverUrl?: string | null;
  adminName?: string | null;
  adminPassword?: string | null;
};

export type DesktopRecoveryBackup = {
  name: string;
  size: number;
  createdAt: number;
};

export type DesktopRecoveryStatus = {
  backups: DesktopRecoveryBackup[];
  migrationInterrupted: boolean;
  lastRecovery?: {
    reason?: string;
    backupPath?: string;
    recoveredAt?: string | number;
  } | null;
};

export const DESKTOP_CONFIG_KEY = "codeverta.desktop.runtime";

export function readCachedDesktopConfig(): DesktopRuntimeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(DESKTOP_CONFIG_KEY) || "null");
  } catch {
    return null;
  }
}

export function cacheDesktopConfig(config: DesktopRuntimeConfig) {
  localStorage.setItem(DESKTOP_CONFIG_KEY, JSON.stringify(config));
  localStorage.setItem("appLanguage", config.language);
  localStorage.setItem("appCurrency", config.currency);
  localStorage.setItem("desktopMode", config.mode);
}

export function runtimeApiUrl(fallback: string) {
  if (!isTauri()) return fallback;
  return readCachedDesktopConfig()?.apiUrl || fallback;
}

export async function getDesktopConfig() {
  return invoke<DesktopRuntimeConfig | null>("desktop_get_config");
}

export async function configureDesktop(input: DesktopSetupInput) {
  return invoke<DesktopRuntimeConfig>("desktop_configure", { input });
}

export async function getDesktopRecoveryStatus() {
  return invoke<DesktopRecoveryStatus>("desktop_recovery_status");
}

export async function restoreDesktopRecoveryBackup(name: string) {
  return invoke<void>("desktop_restore_recovery_backup", { name });
}

export async function waitForApi(apiUrl: string, attempts = 60) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/health`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) return;
        lastError = new Error(`Server returned ${response.status}`);
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  throw lastError || new Error("The selected API is not available");
}
