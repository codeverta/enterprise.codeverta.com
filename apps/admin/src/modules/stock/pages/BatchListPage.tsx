import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { batchApi, Batch, BatchStats } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Boxes,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Pencil,
  Calendar,
} from "lucide-react";

export default function BatchListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Batch[]>([]);
  const [stats, setStats] = useState<BatchStats>({
    total: 0,
    active: 0,
    expiring_soon: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadData = async (query = search, status = statusFilter) => {
    setLoading(true);
    try {
      const res = await batchApi.list({
        q: query || undefined,
        status: status === "All" ? undefined : status,
      });
      setList(res.data || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      toast.error("Gagal memuat data Batch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(search, statusFilter);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(search, statusFilter);
  };

  const handleDelete = async (id: string, batchId: string) => {
    if (!confirm(`Hapus Batch ${batchId}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await batchApi.remove(id);
      toast.success(`Batch ${batchId} berhasil dihapus`);
      loadData(search, statusFilter);
    } catch {
      toast.error("Gagal menghapus Batch");
    }
  };

  const getExpiryStatus = (expiryDate?: string, disabled?: boolean) => {
    if (disabled) {
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Disabled</Badge>;
    }
    if (!expiryDate) {
      return <Badge variant="outline">Tanpa Exp</Badge>;
    }
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Expired</Badge>;
    }
    if (diffDays <= 30) {
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Exp &le; {diffDays}h</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>;
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <span>Serial and Batch</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Batch No</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola pengelompokan item berdasarkan batch / nomor lot, tanggal produksi, masa kedaluwarsa, dan kepatuhan stok.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RotateCcw className="mr-1.5 size-4" /> Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/batch-no/new">
              <Plus className="mr-2 size-4" /> New Batch
            </Link>
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Batch</span>
            <Boxes className="size-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Aktif</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600">Segera Kedaluwarsa</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{stats.expiring_soon}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600">Kedaluwarsa (Expired)</span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{stats.expired}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari Batch ID, Item, Supplier, Dokumen Referensi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["All", "Active", "Expiring Soon", "Expired", "Disabled"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="text-xs"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* List Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-4">Batch ID</th>
                <th className="p-4">Item</th>
                <th className="p-4">Status Exp</th>
                <th className="p-4 text-right">Batch Qty</th>
                <th className="p-4">Mfg Date</th>
                <th className="p-4">Expiry Date</th>
                <th className="p-4">Shelf Life</th>
                <th className="p-4">Dokumen Referensi</th>
                <th className="p-4">Supplier</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    Memuat data Batch...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <Boxes className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada Batch No</p>
                    <p className="mt-1 text-sm text-slate-500">Buat Batch baru untuk melacak kelompok barang dengan tanggal manufaktur dan kedaluwarsa.</p>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700" asChild>
                      <Link to="/desk/batch-no/new">
                        <Plus className="mr-2 size-4" /> Buat Batch Baru
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50">
                    <td className="p-4 font-semibold text-blue-600">
                      <Link to={`/desk/batch-no/${row.id}`} className="hover:underline flex items-center gap-1.5">
                        <Boxes className="size-3.5 text-slate-400" />
                        {row.batch_id}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.item_code}</div>
                      {row.item_name && <div className="text-xs text-slate-500 truncate max-w-[180px]">{row.item_name}</div>}
                    </td>
                    <td className="p-4">
                      {getExpiryStatus(row.expiry_date, row.disabled)}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {row.batch_qty.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.manufacturing_date ? new Date(row.manufacturing_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.shelf_life_in_days ? `${row.shelf_life_in_days} hari` : "-"}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.reference_name ? (
                        <div>
                          <span className="font-medium">{row.reference_name}</span>
                          {row.reference_doctype && (
                            <div className="text-[11px] text-slate-400">{row.reference_doctype}</div>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.supplier || "-"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/desk/batch-no/${row.id}`)}
                          title="Lihat / Edit"
                        >
                          <Pencil className="size-3.5 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-500 hover:text-rose-600"
                          onClick={() => handleDelete(row.id || "", row.batch_id)}
                          title="Hapus"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
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
