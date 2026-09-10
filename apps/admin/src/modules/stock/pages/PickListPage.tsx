import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, RefreshCw, ClipboardList, CheckCircle2, XCircle, Clock, Trash2, Edit3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { pickListApi, type PickList } from "../pickListApi";
import { toast } from "sonner";

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  Completed: "outline",
  Cancelled: "destructive",
};

export default function PickListPage() {
  const navigate = useNavigate();
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [purposeFilter, setPurposeFilter] = useState<string>("All");

  const loadPickLists = async () => {
    setLoading(true);
    try {
      const data = await pickListApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        purpose: purposeFilter === "All" ? undefined : purposeFilter,
      });
      setPickLists(data || []);
    } catch {
      toast.error("Gagal mengambil daftar Pick List");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPickLists();
  }, [statusFilter, purposeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPickLists();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Pick List ${number || id}?`)) return;
    try {
      await pickListApi.delete(id);
      toast.success("Pick List berhasil dihapus");
      loadPickLists();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Pick List");
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
            <span className="font-semibold text-slate-900 dark:text-slate-100">Pick List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Pick List</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dokumen instruksi pengambilan barang dari gudang berdasarkan pesanan penjualan, transfer material, atau manufaktur.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/pick-list/new">
            <Plus className="mr-2 size-4" /> New Pick List
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Pick List, Perusahaan, Keterangan..."
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
            {["All", "Draft", "Submitted", "Completed", "Cancelled"].map((st) => (
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

          <select
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value)}
            aria-label="Filter Purpose"
            className="rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-slate-900"
          >
            <option value="All">All Purposes</option>
            <option value="Delivery">Delivery</option>
            <option value="Material Transfer for Manufacture">Material Transfer for Manufacture</option>
            <option value="Material Transfer">Material Transfer</option>
          </select>

          <Button variant="ghost" size="icon" onClick={loadPickLists} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Table List */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600 font-medium dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4">No. Pick List</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4 text-center">Total Qty</th>
                <th className="py-3.5 px-4 text-center">Picked Qty</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin mb-2" />
                    Memuat data Pick List...
                  </td>
                </tr>
              ) : pickLists.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <ClipboardList className="mx-auto size-12 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Belum ada data Pick List</p>
                    <p className="text-xs text-slate-400 mt-1">Buat Pick List baru untuk memulai picking barang gudang</p>
                    <Button className="mt-4 bg-blue-600" asChild>
                      <Link to="/desk/pick-list/new">
                        <Plus className="mr-2 size-4" /> Buat Pick List
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                pickLists.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors dark:hover:bg-slate-900/50"
                    onClick={() => navigate(`/desk/pick-list/${item.id}`)}
                  >
                    <td className="py-3.5 px-4 font-semibold text-blue-600 hover:underline">
                      {item.pick_list_number || item.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="font-normal text-xs">
                        {item.purpose}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {item.company}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium">
                      {item.total_qty}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">
                      <span className={item.total_picked_qty >= item.total_qty && item.total_qty > 0 ? "text-emerald-600" : ""}>
                        {item.total_picked_qty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={statusVariants[item.status] || "default"}>
                        {item.status === "Draft" && <Clock className="mr-1 size-3 inline" />}
                        {item.status === "Submitted" && <CheckCircle2 className="mr-1 size-3 inline" />}
                        {item.status === "Completed" && <CheckCircle2 className="mr-1 size-3 inline text-emerald-500" />}
                        {item.status === "Cancelled" && <XCircle className="mr-1 size-3 inline" />}
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/desk/pick-list/${item.id}`)}
                          title="View / Edit"
                        >
                          <Edit3 className="size-4 text-slate-600" />
                        </Button>
                        {item.status === "Draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDelete(item.id!, item.pick_list_number)}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-blue-600"
                          onClick={() => navigate(`/desk/pick-list/${item.id}`)}
                        >
                          <ArrowRight className="size-4" />
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
