import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { serialNoApi, SerialNo, SerialNoStats } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Barcode,
  Package,
  CheckCircle2,
  Truck,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Pencil,
  Eye,
} from "lucide-react";

export default function SerialNoListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<SerialNo[]>([]);
  const [stats, setStats] = useState<SerialNoStats>({
    total: 0,
    available: 0,
    delivered: 0,
    expired: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadData = async (query = search, status = statusFilter) => {
    setLoading(true);
    try {
      const res = await serialNoApi.list({
        q: query || undefined,
        status: status === "All" ? undefined : status,
      });
      setList(res.data || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      toast.error("Gagal memuat data Serial No");
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

  const handleDelete = async (id: string, sn: string) => {
    if (!confirm(`Hapus Serial No ${sn}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await serialNoApi.remove(id);
      toast.success(`Serial No ${sn} berhasil dihapus`);
      loadData(search, statusFilter);
    } catch {
      toast.error("Gagal menghapus Serial No");
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "Available":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Available</Badge>;
      case "Delivered":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Delivered</Badge>;
      case "Expired":
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Expired</Badge>;
      case "Inactive":
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Inactive</Badge>;
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Serial No</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lacak unit inventaris individual, lokasi gudang, riwayat garansi, pembelian dari supplier, dan pengiriman ke customer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RotateCcw className="mr-1.5 size-4" /> Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/serial-no/new">
              <Plus className="mr-2 size-4" /> New Serial No
            </Link>
          </Button>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Serial No</span>
            <Barcode className="size-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Available</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{stats.available}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">Delivered</span>
            <Truck className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.delivered}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600">Expired</span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{stats.expired}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari Serial No, Item, Gudang, Supplier, Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["All", "Available", "Delivered", "Expired", "Inactive"].map((st) => (
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
                <th className="p-4">Serial No</th>
                <th className="p-4">Item</th>
                <th className="p-4">Status</th>
                <th className="p-4">Warehouse</th>
                <th className="p-4">Batch No</th>
                <th className="p-4">Garansi Berakhir</th>
                <th className="p-4">Supplier / Pembelian</th>
                <th className="p-4">Customer / Pengiriman</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    Memuat data Serial No...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <Barcode className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada Serial No</p>
                    <p className="mt-1 text-sm text-slate-500">Buat Serial No baru secara manual atau otomatis melalui Stock Entry.</p>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700" asChild>
                      <Link to="/desk/serial-no/new">
                        <Plus className="mr-2 size-4" /> Buat Serial No Baru
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50">
                    <td className="p-4 font-semibold text-blue-600">
                      <Link to={`/desk/serial-no/${row.id}`} className="hover:underline flex items-center gap-1.5">
                        <Barcode className="size-3.5 text-slate-400" />
                        {row.serial_no}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.item_code}</div>
                      {row.item_name && <div className="text-xs text-slate-500 truncate max-w-[180px]">{row.item_name}</div>}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(row.status)}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {row.warehouse || "-"}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {row.batch_no ? (
                        <Link to={`/desk/batch-no?q=${encodeURIComponent(row.batch_no)}`} className="text-blue-600 hover:underline">
                          {row.batch_no}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.warranty_expiry_date ? new Date(row.warranty_expiry_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      <div>{row.supplier || row.supplier_name || "-"}</div>
                      {row.purchase_document_no && <div className="text-[11px] text-slate-400">{row.purchase_document_no}</div>}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      <div>{row.customer || row.customer_name || "-"}</div>
                      {row.delivery_document_no && <div className="text-[11px] text-slate-400">{row.delivery_document_no}</div>}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/desk/serial-no/${row.id}`)}
                          title="Lihat / Edit"
                        >
                          <Pencil className="size-3.5 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-500 hover:text-rose-600"
                          onClick={() => handleDelete(row.id || "", row.serial_no)}
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
