import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import dayjs from "dayjs";
import { CheckCircle, Clock, XCircle, Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

type Withdrawal = {
  id: string;
  amount: number;
  admin_fee: number;
  total_deduct: number;
  status: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  notes?: string;
  rejection_reason?: string;
  requested_by?: { id: string; display_name: string; email: string; role: number };
  created_at: string;
};

function WithdrawalApprovalPage() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lms/admin/withdrawals?limit=100");
      setRows(res.data?.data || []);
    } catch {
      toast.error("Gagal memuat data penarikan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const handleApprove = async (w: Withdrawal) => {
    if (!confirm(`Setujui penarikan ${formatIDR(w.amount)} dari ${w.requested_by?.display_name || "?"}?`)) return;
    setProcessing(w.id);
    try {
      await api.post(`/lms/admin/withdrawals/${w.id}/approve`);
      toast.success("Penarikan disetujui");
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyetujui");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setProcessing(rejectModal.id);
    try {
      await api.post(`/lms/admin/withdrawals/${rejectModal.id}/reject`, {
        reason: rejectReason,
      });
      toast.success("Penarikan ditolak");
      setRejectModal(null);
      setRejectReason("");
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menolak");
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = rows.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Penarikan Dana</h1>
          <p className="text-muted-foreground">
            Superadmin — setujui atau tolak pengajuan penarikan dari mentor & admin.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <Loader2 className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-amber-500" /> Menunggu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="size-4 text-emerald-500" /> Disetujui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="size-4 text-red-500" /> Ditolak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Tanggal</TableHead>
                <TableHead>Pengaju</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rekening Tujuan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Belum ada pengajuan penarikan.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((w) => {
                  const requester = w.requested_by || {};
                  const roleLabel =
                    requester.role === 100
                      ? "Superadmin"
                      : requester.role === 99
                      ? "Admin"
                      : requester.role === 30
                      ? "Mentor"
                      : `Role-${requester.role}`;

                  return (
                    <TableRow key={w.id} className="hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap text-sm">
                        {dayjs(w.created_at).format("DD MMM YYYY, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">
                          {requester.display_name || "—"}
                        </div>
                        <div className="text-xs text-slate-400">{requester.email || ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {roleLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm font-medium">{w.bank_name}</div>
                        <div className="text-xs text-slate-500">
                          {w.bank_account_number} — {w.bank_account_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatIDR(w.amount)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-slate-500">
                        {w.notes || "—"}
                      </TableCell>
                      <TableCell>
                        {w.status === "PENDING" && (
                          <Badge className="bg-amber-50 text-amber-600 border-amber-200">
                            <Clock className="size-3 mr-1" /> Pending
                          </Badge>
                        )}
                        {w.status === "APPROVED" && (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">
                            <CheckCircle className="size-3 mr-1" /> Disetujui
                          </Badge>
                        )}
                        {w.status === "REJECTED" && (
                          <Badge className="bg-red-50 text-red-600 border-red-200">
                            <XCircle className="size-3 mr-1" /> Ditolak
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.status === "PENDING" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleApprove(w)}
                              disabled={processing === w.id}
                            >
                              {processing === w.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="size-3 mr-1" />
                              )}
                              Setuju
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setRejectModal(w);
                                setRejectReason("");
                              }}
                              disabled={processing === w.id}
                            >
                              <XCircle className="size-3 mr-1" />
                              Tolak
                            </Button>
                          </div>
                        ) : w.status === "REJECTED" && w.rejection_reason ? (
                          <span className="text-xs text-red-500" title={w.rejection_reason}>
                            {w.rejection_reason.slice(0, 30)}...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alasan Penolakan</DialogTitle>
          </DialogHeader>
          {rejectModal && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                <p>
                  <span className="font-semibold">Pengaju:</span>{" "}
                  {rejectModal.requested_by?.display_name || "—"}
                </p>
                <p>
                  <span className="font-semibold">Nominal:</span>{" "}
                  {formatIDR(rejectModal.amount)}
                </p>
                <p>
                  <span className="font-semibold">Rekening:</span> {rejectModal.bank_name} —{" "}
                  {rejectModal.bank_account_number} a/n {rejectModal.bank_account_name}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">Alasan ditolak *</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Contoh: Saldo tidak mencukupi, data rekening tidak valid..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing === rejectModal?.id}
            >
              {processing === rejectModal?.id ? "Memproses..." : "Tolak Penarikan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardLayout(WithdrawalApprovalPage);
