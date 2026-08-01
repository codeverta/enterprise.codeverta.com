import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { ResourcePanel } from "@/components/lms/GenericResourcePanel";
import { lmsConfigs, resources } from "@/lib/lms-resource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tags,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import api from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import { Payment } from "./types";
import StatusBadge from "./StatusBadge";

const fmt = (amount: number, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const fmtDate = (d?: string) =>
  d ? dayjs(d).format("DD MMM YYYY HH:mm") : "-";



// ─── Payments Panel ──────────────────────────────────────────────────────────

function PaymentsPanel() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payPage, setPayPage] = useState(1);
  const perPage = 25;

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/subscriptions/admin/resources/payments?limit=200");
      setRows(res.data?.data || []);
    } catch {
      toast.error("Gagal memuat payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const filteredPays = rows
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.external_id || "").toLowerCase().includes(q) ||
        (r.student_name || r.student_id || "").toLowerCase().includes(q) ||
        (r.parent_name || r.parent_id || "").toLowerCase().includes(q)
      );
    });

  const totalPaid = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);
  const totalPending = rows
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Terbayar"
          value={fmt(totalPaid)}
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <StatCard
          label="Pending"
          value={fmt(totalPending)}
          icon={Clock}
          color="bg-amber-500"
        />
        <StatCard
          label="Total Transaksi"
          value={rows.length}
          icon={CreditCard}
          color="bg-blue-500"
        />
      </div> */}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Nama siswa / ortu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {["pending", "paid", "failed", "expired"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Siswa</TableHead>
                <TableHead>Orang Tua</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Tgl Bayar</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-slate-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredPays.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-slate-400"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPays
                  .slice((payPage - 1) * perPage, payPage * perPage)
                  .map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium">
                          {row.student_name || "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.student_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{row.parent_name || "—"}</div>
                        <div className="text-xs text-slate-400">
                          {row.parent_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(row.amount, row.currency)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs uppercase text-slate-500">
                          {row.provider}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.status === "paid" ? (
                          fmtDate(row.paid_at)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.invoice_url ? (
                          <a
                            href={row.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 underline hover:text-blue-800"
                          >
                            Lihat
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          {filteredPays.length > perPage && (
            <div className="flex items-center justify-between px-2 py-2 text-xs text-slate-500">
              <span>{filteredPays.length} total</span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                  disabled={payPage <= 1}
                  onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="px-2">
                  {payPage} / {Math.ceil(filteredPays.length / perPage)}
                </span>
                <button
                  className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                  disabled={payPage >= Math.ceil(filteredPays.length / perPage)}
                  onClick={() => setPayPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-400">
        {filteredPays.length} dari {rows.length} transaksi
      </p>
    </div>
  );
}
export default PaymentsPanel;
