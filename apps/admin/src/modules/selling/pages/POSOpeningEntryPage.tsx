import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight, Clock3, Plus, RefreshCw, Store, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { isOpeningOutdated, posApi, type POSOpeningEntry } from "../posApi";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function POSOpeningEntryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<POSOpeningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await posApi.listOpenings()); }
    catch { toast.error("Gagal memuat POS Opening Entry"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = entries.find((entry) => entry.status === "Open");
  const outdated = isOpeningOutdated(current);

  const entryColumns = useMemo<ColumnDef<POSOpeningEntry>[]>(() => [
    {
      accessorKey: "id",
      header: "Entry",
      meta: { label: "Entry", cellClassName: "font-mono text-xs font-semibold text-blue-600" },
    },
    {
      accessorKey: "pos_profile",
      header: "POS Profile",
      meta: { label: "POS Profile", cellClassName: "font-medium" },
    },
    {
      accessorKey: "user",
      header: "Cashier",
      meta: { label: "Cashier", cellClassName: "text-xs" },
    },
    {
      accessorKey: "period_start_date",
      header: "Mulai",
      cell: ({ row }) => dateTime(row.original.period_start_date),
      meta: { label: "Mulai", cellClassName: "text-xs text-slate-600" },
    },
    {
      accessorKey: "opening_balance_total",
      header: "Opening Balance",
      cell: ({ row }) => money(row.original.opening_balance_total),
      meta: { label: "Opening Balance", cellClassName: "font-semibold text-slate-900 dark:text-slate-100" },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.original.status === "Open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {row.original.status}
        </span>
      ),
      meta: { label: "Status" },
    },
    {
      id: "actions",
      header: "Actions",
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          aria-label={`Buka ${row.original.id}`}
          variant="ghost"
          size="icon"
          className="size-8 text-blue-600"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/desk/pos-opening-entry/${row.original.id}`);
          }}
        >
          <ArrowRight className="size-4" />
        </Button>
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
  ], [navigate]);

  const closeAndCreate = async () => {
    if (!current) return navigate("/desk/pos-opening-entry/new");
    setClosing(true);
    try {
      await posApi.closeOpening(current.id, {});
      toast.success("Opening lama sudah ditutup. Silakan mulai shift baru.");
      navigate("/desk/pos-opening-entry/new", { state: { closedOpening: current.id } });
    } catch (error: any) {
      toast.error(error?.message || "Gagal menutup opening lama");
    } finally { setClosing(false); }
  };

  return (
    <ERPPage>
        <ERPPageHeader
          title="POS Opening Entry"
          description="Kelola kas awal dan sesi kasir sebelum transaksi dimulai."
          breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "Point of Sale", href: "/desk/point-of-sale" }, { label: "POS Opening Entry" }]}
          actions={<>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button onClick={() => navigate("/desk/pos-opening-entry/new")} disabled={Boolean(current)}><Plus className="size-4" /> New Opening</Button>
          </>}
        />

        {current && outdated && (
          <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="size-5" /></span>
              <div>
                <p className="font-semibold text-amber-950">POS opening saat ini sudah kedaluwarsa</p>
                <p className="mt-1 text-sm text-amber-800">Shift dimulai {dateTime(current.period_start_date)}. Tutup entry lama sebelum membuat opening baru.</p>
              </div>
            </div>
            <Button onClick={closeAndCreate} disabled={closing} className="bg-amber-950 text-white hover:bg-amber-900">
              {closing ? "Menutup shift..." : "Tutup & Buat Opening Baru"}<ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-500">Opening aktif</p><Store className="size-5 text-slate-400" /></div>
            <p className="mt-3 text-3xl font-semibold">{current ? "1" : "0"}</p>
            <p className="mt-1 text-xs text-slate-500">{current?.pos_profile || "Tidak ada shift aktif"}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-500">Saldo pembukaan</p><WalletCards className="size-5 text-slate-400" /></div>
            <p className="mt-3 text-2xl font-semibold">{money(current?.opening_balance_total || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">{current?.balance_details.length || 0} metode pembayaran</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-500">Durasi shift</p><Clock3 className="size-5 text-slate-400" /></div>
            <p className="mt-3 text-2xl font-semibold">{current ? `${Math.max(0, Math.floor((Date.now() - new Date(current.period_start_date).getTime()) / 3600000))} jam` : "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Batas rekomendasi 12 jam</p>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4"><h2 className="font-semibold">Riwayat Opening Entry</h2></div>
          <div className="p-5">
            <DataTable
              columns={entryColumns}
              data={entries}
              getRowId={(entry) => entry.id}
              onRowClick={(entry) => navigate(`/desk/pos-opening-entry/${entry.id}`)}
              searchPlaceholder="Cari opening entry..."
              emptyMessage={loading ? "Memuat opening entry..." : "Belum ada POS Opening Entry."}
            />
          </div>
        </div>
    </ERPPage>
  );
}
