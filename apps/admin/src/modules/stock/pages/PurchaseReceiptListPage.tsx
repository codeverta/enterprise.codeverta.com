import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, RefreshCw, Layers, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { purchaseReceiptApi, type PurchaseReceipt } from "../purchaseReceiptApi";
import { toast } from "sonner";

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "secondary",
  Submitted: "default",
  Cancelled: "destructive",
};

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function PurchaseReceiptListPage() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const data = await purchaseReceiptApi.list({
        q: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
      });
      setReceipts(data || []);
    } catch {
      toast.error("Gagal mengambil daftar Purchase Receipt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReceipts();
  };

  const handleDelete = async (id: string, number?: string) => {
    if (!confirm(`Hapus Purchase Receipt ${number || id}?`)) return;
    try {
      await purchaseReceiptApi.remove(id);
      toast.success("Purchase Receipt berhasil dihapus");
      loadReceipts();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Purchase Receipt");
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
            <span className="font-semibold text-slate-900 dark:text-slate-100">Purchase Receipt</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Receipt</h1>
          <p className="mt-1 text-sm text-slate-500">
            Penerimaan barang fisik dari pemasok / supplier, verifikasi kuantitas yang diterima dan ditolak, serta pembaruan saldo gudang.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/purchase-receipt/new">
            <Plus className="mr-2 size-4" /> New Purchase Receipt
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            placeholder="Cari No Receipt, Supplier, No Surat Jalan Vendor..."
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
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={loadReceipts} title="Refresh">
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
                <th className="py-3.5 pl-6 pr-3">Receipt Number</th>
                <th className="px-3 py-3.5">Supplier</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Accepted Warehouse</th>
                <th className="px-3 py-3.5 text-right">Items / Accepted Qty</th>
                <th className="px-3 py-3.5 text-right">Grand Total</th>
                <th className="px-3 py-3.5">Posting Date</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                    Memuat daftar Purchase Receipt...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Layers className="mx-auto size-10 text-slate-300 mb-2" />
                    Belum ada Purchase Receipt tercatat.
                    <div className="mt-3">
                      <Button asChild size="sm">
                        <Link to="/desk/purchase-receipt/new">Buat Purchase Receipt Baru</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                receipts.map((pr) => {
                  const totalAccepted = pr.items?.reduce((s, it) => s + (it.accepted_quantity || 0), 0) || 0;
                  return (
                    <tr
                      key={pr.id}
                      className="hover:bg-slate-50/80 cursor-pointer dark:hover:bg-slate-900/50"
                      onClick={() => navigate(`/desk/purchase-receipt/${pr.id}`)}
                    >
                      <td className="py-4 pl-6 pr-3 font-semibold text-blue-600">
                        {pr.number || pr.id}
                        {pr.is_return && (
                          <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            RETURN
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {pr.supplier}
                        {pr.supplier_delivery_note && (
                          <div className="text-xs text-slate-400 font-normal">
                            DN: {pr.supplier_delivery_note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={statusVariants[pr.status] || "outline"}>
                          {pr.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-600 dark:text-slate-300">
                        {pr.set_warehouse || "-"}
                      </td>
                      <td className="px-3 py-4 text-right text-slate-700 dark:text-slate-300">
                        {pr.items?.length || 0} item ({totalAccepted})
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatRp(pr.rounded_total || pr.grand_total || 0)}
                      </td>
                      <td className="px-3 py-4 text-slate-500 whitespace-nowrap">
                        {pr.posting_date ? new Date(pr.posting_date).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td
                        className="py-4 pl-3 pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/desk/purchase-receipt/${pr.id}`}>Detail</Link>
                          </Button>
                          {pr.status === "Draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(pr.id!, pr.number)}
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
