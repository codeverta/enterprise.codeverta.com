import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, RefreshCw, Layers, ArrowRightLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { stockEntryApi, type StockEntry } from "../stockEntryApi";
import { toast } from "sonner";

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  Cancelled: "destructive",
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function StockEntryListPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await stockEntryApi.list({
        q: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        stock_entry_type: typeFilter === "All" ? undefined : typeFilter,
      });
      setEntries(data || []);
    } catch {
      toast.error("Gagal mengambil daftar Stock Entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEntries();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Stock Entry ${number || id}?`)) return;
    try {
      await stockEntryApi.remove(id);
      toast.success("Stock Entry berhasil dihapus");
      loadEntries();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Stock Entry");
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
            <span className="font-semibold text-slate-900 dark:text-slate-100">Stock Entry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Entry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pencatatan perpindahan material, penerimaan, pengeluaran, transfer antar gudang, dan produksi barang.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/stock-entry/new">
            <Plus className="mr-2 size-4" /> New Stock Entry
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Stock Entry, Perusahaan, Keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="flex items-center gap-1">
            {["All", "Draft", "Submitted", "Cancelled"].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="All">Semua Tipe</option>
            <option value="Material Transfer">Material Transfer</option>
            <option value="Material Receipt">Material Receipt</option>
            <option value="Material Issue">Material Issue</option>
            <option value="Manufacture">Manufacture</option>
            <option value="Repack">Repack</option>
          </select>

          <Button variant="ghost" size="sm" onClick={loadEntries} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Stock Entry Number</th>
                <th className="px-3 py-3.5">Type</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Company</th>
                <th className="px-3 py-3.5">Warehouses</th>
                <th className="px-3 py-3.5 text-right">Items / Total Qty</th>
                <th className="px-3 py-3.5 text-right">Total Amount</th>
                <th className="px-3 py-3.5">Posting Date</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat data Stock Entry...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Layers className="mx-auto size-10 text-slate-300 mb-2" />
                    Belum ada dokumen Stock Entry.
                    <div className="mt-3">
                      <Button asChild size="sm">
                        <Link to="/desk/stock-entry/new">Buat Stock Entry Baru</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 cursor-pointer dark:hover:bg-slate-900/50"
                      onClick={() => navigate(`/desk/stock-entry/${entry.id}`)}
                    >
                      <td className="py-4 pl-6 pr-3 font-semibold text-blue-600">
                        {entry.stock_entry_number || entry.id}
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          <ArrowRightLeft className="size-3" />
                          {entry.stock_entry_type}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={statusVariants[entry.status] || "outline"}>
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-slate-700 dark:text-slate-300">
                        {entry.company}
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-500">
                        {entry.from_warehouse && (
                          <div>From: <span className="font-medium text-slate-700 dark:text-slate-300">{entry.from_warehouse}</span></div>
                        )}
                        {entry.to_warehouse && (
                          <div>To: <span className="font-medium text-slate-700 dark:text-slate-300">{entry.to_warehouse}</span></div>
                        )}
                        {!entry.from_warehouse && !entry.to_warehouse && "-"}
                      </td>
                      <td className="px-3 py-4 text-right text-slate-700 dark:text-slate-300">
                        {entry.items?.length || 0} item ({entry.total_qty || 0})
                      </td>
                      <td className="px-3 py-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatRp(entry.total_amount)}
                      </td>
                      <td className="px-3 py-4 text-slate-500 whitespace-nowrap">
                        {entry.posting_date ? new Date(entry.posting_date).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td
                        className="py-4 pl-3 pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                          >
                            <Link to={`/desk/stock-entry/${entry.id}`}>Detail</Link>
                          </Button>
                          {entry.status === "Draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(entry.id!, entry.stock_entry_number)}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
