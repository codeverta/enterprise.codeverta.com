import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../store/useSettingsStore";

const runWindowAction = (action: () => Promise<unknown>) => {
  void action().catch(() => undefined);
};

const getHistoryIndex = () => Number(window.history.state?.idx ?? 0);

export default function DesktopTitleBar() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const { settings } = useSettingsStore() as {
    settings?: { app_name?: string } | null;
  };
  const [isMaximized, setIsMaximized] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(getHistoryIndex);
  const maxHistoryIndex = useRef(getHistoryIndex());
  const isMacOS = /Macintosh|Mac OS X/.test(navigator.userAgent);
  const appName = settings?.app_name || "Codeverta Enterprise System";

  useEffect(() => {
    const updateMaximizedState = () => {
      void appWindow
        .isMaximized()
        .then((maximized) => {
          setIsMaximized(maximized);
          document.documentElement.classList.toggle("tauri-maximized", maximized);
        })
        .catch(() => undefined);
    };

    updateMaximizedState();
    const unlistenPromise = appWindow.onResized(updateMaximizedState);

    return () => {
      document.documentElement.classList.remove("tauri-maximized");
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [appWindow]);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const syncHistory = (newNavigation = false) => {
      const nextIndex = getHistoryIndex();
      if (newNavigation) maxHistoryIndex.current = nextIndex;
      else maxHistoryIndex.current = Math.max(maxHistoryIndex.current, nextIndex);
      setHistoryIndex(nextIndex);
    };

    const patchedPushState: History["pushState"] = function (...args) {
      const result = originalPushState.apply(this, args);
      syncHistory(true);
      return result;
    };
    const patchedReplaceState: History["replaceState"] = function (...args) {
      const result = originalReplaceState.apply(this, args);
      syncHistory(false);
      return result;
    };
    const handlePopState = () => syncHistory(false);

    window.history.pushState = patchedPushState;
    window.history.replaceState = patchedReplaceState;
    window.addEventListener("popstate", handlePopState);

    return () => {
      if (window.history.pushState === patchedPushState) window.history.pushState = originalPushState;
      if (window.history.replaceState === patchedReplaceState) window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < maxHistoryIndex.current;

  return (
    <header
      data-tauri-drag-region
      className="relative z-[100] flex h-11 shrink-0 select-none items-center border-b border-slate-200/80 bg-white/90 text-slate-700 backdrop-blur-xl dark:border-slate-800 dark:bg-[#242424]/95 dark:text-slate-200"
    >
      <div
        className={`flex h-full shrink-0 items-center ${isMacOS ? "pl-[78px]" : "pl-3"}`}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <nav className="flex items-center gap-0.5" aria-label="Page history">
          <button
            type="button"
            aria-label="Go back"
            title="Back"
            disabled={!canGoBack}
            className="flex h-7 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label="Go forward"
            title="Forward"
            disabled={!canGoForward}
            className="flex h-7 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => window.history.forward()}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </nav>
      </div>

      <div
        data-tauri-drag-region
        className="pointer-events-none absolute inset-x-1/4 flex min-w-0 items-center justify-center gap-2"
      >
        <img src="/favicon-32x32.png" alt="" draggable={false} className="h-5 w-5 rounded-md shadow-sm" />
        <span data-tauri-drag-region className="truncate text-xs font-semibold tracking-[0.01em]">
          {appName}
        </span>
      </div>

      <div data-tauri-drag-region className="min-w-0 flex-1" />

      {!isMacOS && (
        <div className="flex h-full items-stretch" onDoubleClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Minimize window"
            title="Minimize"
            className="flex w-11 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => runWindowAction(() => appWindow.minimize())}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
            title={isMaximized ? "Restore" : "Maximize"}
            className="flex w-11 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => runWindowAction(() => appWindow.toggleMaximize())}
          >
            {isMaximized ? <Copy className="h-3 w-3 -scale-x-100" strokeWidth={1.7} /> : <Square className="h-3 w-3" strokeWidth={1.7} />}
          </button>
          <button
            type="button"
            aria-label="Close window"
            title="Close"
            className="flex w-12 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-red-500 hover:text-white dark:text-slate-400 dark:hover:bg-red-600 dark:hover:text-white"
            onClick={() => runWindowAction(() => appWindow.close())}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </header>
  );
}
