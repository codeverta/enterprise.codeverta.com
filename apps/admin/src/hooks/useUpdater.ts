import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  desktopUpdaterService,
  type UpdateDetails,
  type UpdateDownloadProgress,
  type UpdaterStatus,
  updaterErrorMessage,
} from "@/services/updater";

const DISMISSED_VERSION_KEY = "codeverta.desktopUpdater.dismissedVersion";
const AUTO_CHECK_DELAY_MS = 2_500;

export interface UpdaterState {
  status: UpdaterStatus;
  update: UpdateDetails | null;
  progress: UpdateDownloadProgress;
  error: string | null;
  dialogOpen: boolean;
}

const initialState: UpdaterState = {
  status: "idle",
  update: null,
  progress: { downloadedBytes: 0 },
  error: null,
  dialogOpen: false,
};

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>(initialState);
  const mountedRef = useRef(true);
  const automaticCheckStartedRef = useRef(false);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!desktopUpdaterService.isSupported()) return;

    setState((current) => ({
      ...current,
      status: "checking",
      error: null,
      dialogOpen: silent ? current.dialogOpen : true,
    }));
    console.info("[desktop-updater] Checking for updates");

    try {
      const update = await desktopUpdaterService.checkForUpdate();
      if (!mountedRef.current) return;

      if (!update) {
        setState((current) => ({
          ...current,
          status: "latest",
          update: null,
          dialogOpen: silent ? false : current.dialogOpen,
        }));
        console.info("[desktop-updater] Application is up to date");
        return;
      }

      const dismissedVersion = sessionStorage.getItem(DISMISSED_VERSION_KEY);
      const shouldOpen = !silent || dismissedVersion !== update.version;
      setState((current) => ({
        ...current,
        status: "available",
        update,
        dialogOpen: shouldOpen,
      }));
      console.info(`[desktop-updater] Version ${update.version} is available`);
      if (shouldOpen) toast.info(`Update Codeverta ${update.version} tersedia`);
    } catch (error) {
      const message = updaterErrorMessage(error);
      console.error("[desktop-updater] Update check failed", error);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        status: silent ? "idle" : "error",
        error: message,
        dialogOpen: silent ? false : true,
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setState((current) => ({ ...current, error: null, dialogOpen: true }));
    console.info("[desktop-updater] Downloading update");

    try {
      await desktopUpdaterService.installUpdate({
        onStatus: (status) => {
          if (!mountedRef.current) return;
          console.info(`[desktop-updater] Status: ${status}`);
          setState((current) => ({ ...current, status, dialogOpen: true }));
        },
        onProgress: (progress) => {
          if (!mountedRef.current) return;
          setState((current) => ({ ...current, progress }));
        },
      });
    } catch (error) {
      const message = updaterErrorMessage(error);
      console.error("[desktop-updater] Update installation failed", error);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        status: "error",
        error: message,
        dialogOpen: true,
      }));
    }
  }, []);

  const postpone = useCallback(() => {
    if (state.update) {
      sessionStorage.setItem(DISMISSED_VERSION_KEY, state.update.version);
    }
    setState((current) => ({ ...current, dialogOpen: false }));
  }, [state.update]);

  const closeDialog = useCallback(() => {
    setState((current) => ({ ...current, dialogOpen: false }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!desktopUpdaterService.isSupported() || automaticCheckStartedRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    automaticCheckStartedRef.current = true;
    const timer = window.setTimeout(() => void checkForUpdates(true), AUTO_CHECK_DELAY_MS);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
    };
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    installUpdate,
    postpone,
    closeDialog,
  };
}
