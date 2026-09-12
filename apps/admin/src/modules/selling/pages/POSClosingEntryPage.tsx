import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, RefreshCw, Plus, LogOut, Trash2, Edit3, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { posApi, type POSClosingEntry, type POSOpeningEntry } from "../posApi";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateTime = (value?: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function POSClosingEntryPage() {
  const navigate = useNavigate();
  const [closings, setClosings] = useState<POSClosingEntry[]>([]);
  const [activeOpening, setActiveOpening] = useState<POSOpeningEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, history] = await Promise.all([
        posApi.currentOpening(),
        posApi.listClosings(),
      ]);
      setActiveOpening(current.data);
      setClosings(history || []);
    } catch {
      toast.error("Gagal memuat data POS Closing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closingColumns = useMemo<ColumnDef<POSClosingEntry>[]>(() => [
    { accessorKey: "id", header: "No. Closing Entry", meta: { label: "No. Closing Entry", cellClassName: "font-semibold text-blue-600" } },
    { accessorKey: "pos_opening_entry", header: "POS Opening Entry", meta: { label: "POS Opening Entry", cellClassName: "font-mono text-xs text-slate-600" } },
    { accessorKey: "pos_profile", header: "POS Profile", meta: { label: "POS Profile", cellClassName: "text-xs font-medium" } },
    { accessorKey: "user", header: "Cashier", meta: { label: "Cashier", cellClassName: "text-xs" } },
    { accessorKey: "period_end_date", header: "Period End Date", cell: ({ row }) => dateTime(row.original.period_end_date), meta: { label: "Period End Date", cellClassName: "text-xs text-slate-600" } },
    { accessorKey: "grand_total", header: "Grand Total", cell: ({ row }) => money(row.original.grand_total), meta: { label: "Grand Total", cellClassName: "text-right font-bold" } },
    { id: "difference", header: "Difference", accessorFn: (entry) => (entry.payment_reconciliation || []).reduce((sum, row) => sum + row.difference, 0), cell: ({ row }) => { const difference = row.getValue<number>("difference"); return <span className={difference === 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{money(difference)}</span>; }, meta: { label: "Difference", cellClassName: "text-right" } },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant="default"><CheckCircle2 className="mr-1 inline size-3" />{row.original.status || "Submitted"}</Badge>, meta: { label: "Status", cellClassName: "text-center" } },
    { id: "actions", header: "Actions", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => <Button aria-label={`Buka ${row.original.id}`} variant="ghost" size="icon" className="size-8 text-blue-600" onClick={(event) => { event.stopPropagation(); navigate(`/desk/pos-closing-entry/${row.original.id}`); }}><ArrowRight className="size-4" /></Button>, meta: { headerClassName: "text-right", cellClassName: "text-right" } },
  ], [navigate]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">POS Closing Entry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">POS Closing Entry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rekonsiliasi pembayaran, audit kas fisik, dan penutupan shift kasir Point of Sale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/pos-closing-entry/new">
              <Plus className="mr-2 size-4" /> New POS Closing Entry
            </Link>
          </Button>
        </div>
      </header>

      {/* Active Shift Card (if any) */}
      {activeOpening && (
        <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-blue-900 dark:bg-blue-950/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Shift Kasir Sedang Aktif: <span className="font-mono text-blue-600">{activeOpening.id}</span>
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Profile: <b>{activeOpening.pos_profile}</b> · Cashier: <b>{activeOpening.user}</b> · Mulai: {dateTime(activeOpening.period_start_date)}
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/pos-closing-entry/new">
              <LogOut className="mr-2 size-4" /> Tutup Shift Sekarang
            </Link>
          </Button>
        </div>
      )}

      {/* Closing History Table */}
      <div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-base text-slate-800 dark:text-slate-200">
            Daftar POS Closing Entry
          </h2>
        </div>

        <div className="p-5">
          <DataTable
            columns={closingColumns}
            data={closings}
            getRowId={(entry) => entry.id}
            onRowClick={(entry) => navigate(`/desk/pos-closing-entry/${entry.id}`)}
            searchPlaceholder="Cari closing entry..."
            emptyMessage={loading ? "Memuat daftar Closing Entry..." : "Belum ada POS Closing Entry."}
          />
        </div>
      </div>
    </div>
  );
}
