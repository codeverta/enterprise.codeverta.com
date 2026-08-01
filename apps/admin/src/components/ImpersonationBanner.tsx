import { AlertTriangle, Loader2, LogOut, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { readImpersonation, restoreOriginalAdminSession } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";

const roleLabel = (role: number) => {
  if (role === 10) return "Parent";
  if (role === 20) return "Student";
  if (role === 30) return "Mentor Internal";
  if (role === 40) return "Mentor Eksternal";
  if (role === 99) return "Admin";
  return `Role ${role}`;
};

export function ImpersonationBanner() {
  const session = readImpersonation();
  const [stopping, setStopping] = useState(false);
  if (!session) return null;

  const stop = async () => {
    setStopping(true);
    try {
      await api.post("/auth/impersonation/stop");
    } catch (error) {
      console.warn("Failed to revoke impersonation session", error);
    }

    if (restoreOriginalAdminSession()) {
      toast.success("Kembali ke akun administrator.");
      window.location.assign("/dashboard/users/list");
      return;
    }

    setStopping(false);
    toast.error("Sesi admin asli tidak ditemukan. Silakan login ulang.");
  };

  return (
    <div className="sticky top-0  border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-800">
            <UserRoundCog className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-sm">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-3.5 w-3.5" /> Mode impersonasi aktif
            </div>
            <div className="truncate text-xs text-amber-800">
              Anda sedang melihat aplikasi sebagai {session.target_name || session.target_username || "user"} · {roleLabel(Number(session.target_role))}
            </div>
          </div>
        </div>
        <Button type="button" size="sm" onClick={stop} disabled={stopping} className="rounded-full bg-amber-900 text-amber-50 hover:bg-amber-800">
          {stopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Kembali ke admin
        </Button>
      </div>
    </div>
  );
}
