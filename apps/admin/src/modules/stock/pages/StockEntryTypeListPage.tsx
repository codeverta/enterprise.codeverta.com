import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { stockEntryTypeApi, StockEntryType, STANDARD_STOCK_ENTRY_PURPOSES } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  RotateCcw,
  Sparkles,
  Boxes,
  Trash2,
  Pencil,
  ArrowRight,
} from "lucide-react";

export default function StockEntryTypeListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<StockEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("All");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await stockEntryTypeApi.list({
        q: search || undefined,
        purpose: purposeFilter === "All" ? undefined : purposeFilter,
      });
      setList(res.data || []);
    } catch {
      toast.error("Gagal memuat data Stock Entry Type");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [purposeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await stockEntryTypeApi.seed();
      toast.success(res.message || "Berhasil memuat 13 Stock Entry Type standar");
      loadData();
    } catch {
      toast.error("Gagal menjalankan seeder");
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus Stock Entry Type "${name}"?`)) return;
    try {
      await stockEntryTypeApi.remove(id);
      toast.success(`Stock Entry Type "${name}" berhasil dihapus`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus");
    }
  };

  const getPurposeBadge = (purpose: string) => {
    switch (purpose) {
      case "Material Issue":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300">Material Issue</Badge>;
      case "Material Receipt":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">Material Receipt</Badge>;
      case "Material Transfer":
      case "Material Transfer for Manufacture":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">{purpose}</Badge>;
      case "Manufacture":
      case "Material Consumption for Manufacture":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">{purpose}</Badge>;
      case "Repack":
      case "Disassemble":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">{purpose}</Badge>;
      case "Send to Subcontractor":
      case "Subcontracting Delivery":
      case "Subcontracting Return":
        return <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300">{purpose}</Badge>;
      case "Receive from Customer":
      case "Return Raw Material to Customer":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">{purpose}</Badge>;
      default:
        return <Badge variant="outline">{purpose}</Badge>;
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("id-ID");
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">Stock Entry Type</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold tracking-tight">Stock Entry Type</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {list.length} of {list.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Definisikan jenis dan tujuan pergerakan stok barang (Issue, Receipt, Transfer, Manufacture, Repack, Subcontracting).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} title="Muat 13 Type Default">
            <Sparkles className="mr-1.5 size-4 text-amber-500" />
            {seeding ? "Seeding..." : "Seed Default (13 Types)"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} title="Refresh Data">
            <RotateCcw className="mr-1.5 size-4" /> Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/stock-entry-type/new">
              <Plus className="mr-2 size-4" /> New Stock Entry Type
            </Link>
          </Button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari Name atau Purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Purpose:</span>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm max-w-[220px]"
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value)}
          >
            <option value="All">Semua Purpose</option>
            {STANDARD_STOCK_ENTRY_PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-4 min-w-[200px]">Name</th>
                <th className="p-4 min-w-[140px]">ID</th>
                <th className="p-4 min-w-[200px]">Purpose</th>
                <th className="p-4 min-w-[220px]">Description</th>
                <th className="p-4 min-w-[100px]">Status</th>
                <th className="p-4 min-w-[110px]">Modified</th>
                <th className="p-4 text-right min-w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Memuat data Stock Entry Type...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Boxes className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada Stock Entry Type</p>
                    <p className="mt-1 text-sm text-slate-500">Klik tombol di bawah untuk membuat atau memuat 13 tipe standar ERPNext.</p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <Button onClick={handleSeed} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Sparkles className="mr-1.5 size-4 text-amber-500" /> Seed 13 Tipe Standar
                      </Button>
                      <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                        <Link to="/desk/stock-entry-type/new">
                          <Plus className="mr-2 size-4" /> Buat Tipe Baru
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50">
                    <td className="p-4 font-semibold text-blue-600">
                      <Link
                        to={`/desk/stock-entry-type/${encodeURIComponent(row.id || row.name)}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {row.name}
                        {row.is_standard && (
                          <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Standard
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500">
                      {row.id}
                    </td>
                    <td className="p-4">
                      {getPurposeBadge(row.purpose)}
                    </td>
                    <td className="p-4 text-xs text-slate-500 max-w-[260px] truncate" title={row.description}>
                      {row.description || "-"}
                    </td>
                    <td className="p-4">
                      {row.disabled ? (
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Disabled</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>
                      )}
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-500">
                      {formatRelativeTime(row.updated_at || row.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/desk/stock-entry-type/${encodeURIComponent(row.id || row.name)}`)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-500 hover:text-rose-600"
                          onClick={() => handleDelete(row.id || "", row.name)}
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
