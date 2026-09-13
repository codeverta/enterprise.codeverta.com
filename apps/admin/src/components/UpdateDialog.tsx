import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { UpdateProgress } from "@/components/UpdateProgress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UpdaterState } from "@/hooks/useUpdater";

interface UpdateDialogProps extends UpdaterState {
  onInstall: () => void;
  onPostpone: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function formatReleaseDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(parsed);
}

export function UpdateDialog({
  status,
  update,
  progress,
  error,
  dialogOpen,
  onInstall,
  onPostpone,
  onRetry,
  onClose,
}: UpdateDialogProps) {
  const busy = ["checking", "downloading", "installing", "restarting"].includes(status);
  const installBusy = ["downloading", "installing", "restarting"].includes(status);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onInteractOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === "error" ? (
              <AlertTriangle className="size-5 text-destructive" />
            ) : status === "latest" ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <Sparkles className="size-5 text-primary" />
            )}
            {status === "checking"
              ? "Memeriksa update"
              : status === "error"
                ? "Update belum berhasil"
                : status === "latest"
                  ? "Aplikasi sudah terbaru"
                  : "Update Codeverta tersedia"}
          </DialogTitle>
          <DialogDescription>
            {update
              ? `Versi ${update.currentVersion} → ${update.version}`
              : status === "checking"
                ? "Menghubungi server update dengan aman…"
                : "Tidak ada versi yang lebih baru untuk perangkat ini."}
          </DialogDescription>
        </DialogHeader>

        {status === "checking" && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/35 p-4 text-sm">
            <LoaderCircle className="size-5 animate-spin" />
            Pemeriksaan berjalan di latar belakang.
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {update && !installBusy && status !== "error" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-muted-foreground">Terpasang:</span> {update.currentVersion}</span>
              <span><span className="text-muted-foreground">Terbaru:</span> {update.version}</span>
              {update.date && (
                <span>
                  <span className="text-muted-foreground">Rilis:</span>{" "}
                  {formatReleaseDate(update.date)}
                </span>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Yang berubah</h3>
              <ScrollArea className="h-64 rounded-lg border bg-muted/20 p-4">
                {update.notes ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_li]:my-1 [&_p]:my-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.notes}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Catatan perubahan belum disertakan pada rilis ini.</p>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {installBusy && <UpdateProgress status={status} progress={progress} />}

        <DialogFooter>
          {status === "available" && (
            <>
              <Button variant="outline" onClick={onPostpone}>Nanti</Button>
              <Button onClick={onInstall}>Update sekarang</Button>
            </>
          )}
          {status === "error" && (
            <>
              <Button variant="outline" onClick={onClose}>Tutup</Button>
              <Button onClick={onRetry}>Coba lagi</Button>
            </>
          )}
          {status === "latest" && <Button onClick={onClose}>Selesai</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
