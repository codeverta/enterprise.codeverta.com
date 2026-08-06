import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, FileText, Trash2, CheckCircle2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { stockApi, type DeliveryNote, type DeliveryNoteStatus } from "../api";
import { toast } from "sonner";

const statusVariants: Record<DeliveryNoteStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  Cancelled: "destructive",
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function DeliveryNoteListPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await stockApi.deliveryNoteList({
        q: search,
        status: statusFilter === "All" ? undefined : statusFilter,
      });
      setNotes(data);
    } catch {
      toast.error("Gagal mengambil daftar Delivery Note");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotes();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Delivery Note ${number || id}?`)) return;
    try {
      await stockApi.deliveryNoteRemove(id);
      toast.success("Delivery Note berhasil dihapus");
      loadNotes();
    } catch {
      toast.error("Gagal menghapus Delivery Note");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <p className="text-sm font-semibold text-blue-600">Stock / Logistics</p>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Note (Surat Jalan)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola barang keluar, return masuk gudang, replacement, dan audit trail Surat Jalan.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/delivery-note/new">
            <Plus className="mr-2 size-4" /> New Delivery Note
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Surat Jalan, Customer, Perusahaan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto">
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
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="p-4">Delivery Note Number</th>
              <th className="p-4">Status</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Posting Date</th>
              <th className="p-4">Warehouse</th>
              <th className="p-4 text-right">Total Qty</th>
              <th className="p-4 text-right">Grand Total</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Memuat data Delivery Note...
                </td>
              </tr>
            ) : notes.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Belum ada dokumen Delivery Note.
                </td>
              </tr>
            ) : (
              notes.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="p-4 font-mono font-semibold text-blue-600">
                    <Link to={`/desk/delivery-note/${row.id}`} className="hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="p-4">
                    <Badge variant={statusVariants[row.status] || "outline"}>
                      {row.is_return ? "Return - " : ""}{row.status}
                    </Badge>
                  </td>
                  <td className="p-4 font-medium">{row.customer || "-"}</td>
                  <td className="p-4 text-xs font-medium">
                    {row.posting_date ? row.posting_date.slice(0, 10) : "-"} {row.posting_time}
                  </td>
                  <td className="p-4 text-xs text-slate-500">{row.set_warehouse || "Stores"}</td>
                  <td className="p-4 text-right font-medium">{row.total_qty || 0}</td>
                  <td className="p-4 text-right font-semibold">{formatRp(row.grand_total)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/desk/delivery-note/${row.id}`)}>
                        {row.status === "Draft" ? "Edit" : "View"}
                      </Button>
                      {row.id && row.status === "Draft" && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id!, row.number)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
