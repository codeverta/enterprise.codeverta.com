import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Search, RefreshCw, Scale, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { stockReconciliationApi, type StockReconciliation } from "../stockReconciliationApi";
import { toast } from "sonner";

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  Cancelled: "destructive",
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function StockReconciliationListPage() {
  const [entries, setEntries] = useState<StockReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [purposeFilter, setPurposeFilter] = useState<string>("All");

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await stockReconciliationApi.list({
        q: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        purpose: purposeFilter === "All" ? undefined : purposeFilter,
      });
      setEntries(data || []);
    } catch {
      toast.error("Gagal mengambil daftar Stock Reconciliation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [statusFilter, purposeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEntries();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Stock Reconciliation ${number || id}?`)) return;
    try {
      await stockReconciliationApi.remove(id);
      toast.success("Stock Reconciliation berhasil dihapus");
      loadEntries();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Stock Reconciliation");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Stock Reconciliation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Reconciliation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Penyesuaian dan rekonsiliasi kuantitas stok aktual gudang dengan sistem atau pencatatan saldo awal (Opening Stock).
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/stock-reconciliation/new">
            <Plus className="mr-2 size-4" /> New Stock Reconciliation
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Rekonsiliasi, Perusahaan, Keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {["All", "Draft", "Submitted", "Cancelled"].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                className={statusFilter === st ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {["All", "Stock Reconciliation", "Opening Stock"].map((pur) => (
              <Button
                key={pur}
                variant={purposeFilter === pur ? "default" : "outline"}
                size="sm"
                className={purposeFilter === pur ? "bg-slate-800 text-white dark:bg-slate-700" : ""}
                onClick={() => setPurposeFilter(pur)}
              >
                {pur}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="icon" onClick={loadEntries} title="Refresh">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Table List */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-5 py-3.5">No. Rekonsiliasi</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Tujuan (Purpose)</th>
                <th className="px-5 py-3.5">Perusahaan</th>
                <th className="px-5 py-3.5">Posting Date</th>
                <th className="px-5 py-3.5 text-right">Total Qty</th>
                <th className="px-5 py-3.5 text-right">Total Nilai</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-500" />
                    Memuat data Stock Reconciliation...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Scale className="mx-auto mb-2 size-8 text-slate-300 dark:text-slate-700" />
                    Belum ada dokumen Stock Reconciliation.
                    <div className="mt-2">
                      <Link to="/desk/stock-reconciliation/new" className="text-sm font-semibold text-blue-600 hover:underline">
                        Buat Stock Reconciliation Baru
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-900/50">
                    <td className="px-5 py-3.5 font-medium">
                      <Link
                        to={`/desk/stock-reconciliation/${entry.id}`}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        {entry.reconciliation_number || entry.id}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={statusVariants[entry.status] || "outline"} className="gap-1 font-medium">
                        {entry.status === "Submitted" && <CheckCircle2 className="size-3 text-emerald-500" />}
                        {entry.status === "Draft" && <Clock className="size-3 text-slate-400" />}
                        {entry.status === "Cancelled" && <XCircle className="size-3 text-red-500" />}
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300">
                        {entry.purpose}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {entry.company}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {entry.posting_date ? new Date(entry.posting_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">
                      {entry.total_qty || 0}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatRp(entry.total_amount || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {entry.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id!, entry.reconciliation_number)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
