import { Download, LoaderCircle, RotateCw } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { UpdateDownloadProgress, UpdaterStatus } from "@/services/updater";

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "ukuran belum diketahui";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function UpdateProgress({
  status,
  progress,
}: {
  status: UpdaterStatus;
  progress: UpdateDownloadProgress;
}) {
  const indeterminate = progress.percent === undefined;
  const installing = status === "installing";
  const restarting = status === "restarting";

  return (
    <div className="space-y-3 rounded-lg border bg-muted/35 p-4" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        {restarting ? (
          <RotateCw className="size-4 animate-spin" />
        ) : installing ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {restarting
          ? "Membuka ulang aplikasi…"
          : installing
            ? "Memasang update…"
            : "Mengunduh update…"}
      </div>
      {!installing && !restarting && (
        <>
          <Progress value={progress.percent ?? 0} />
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {formatBytes(progress.downloadedBytes)}
              {progress.totalBytes ? ` dari ${formatBytes(progress.totalBytes)}` : ""}
            </span>
            <span>{indeterminate ? "Menghitung…" : `${progress.percent}%`}</span>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Jangan tutup aplikasi atau matikan perangkat hingga proses selesai.
      </p>
    </div>
  );
}
