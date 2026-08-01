import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { FilePlus2, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyingApi, dateForInput, type PurchaseOrder } from "../api";

const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency,
  maximumFractionDigits: currency === "IDR" ? 0 : 2,
}).format(value || 0);

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await buyingApi.list({ q: query || undefined, status: status || undefined, page_size: 100 });
      setOrders(response.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mengambil Purchase Order");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-5 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Buying</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Purchase Order</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola pesanan pembelian supplier dalam satu workflow.</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/purchase-order/new"><FilePlus2 className="size-4" /> New Purchase Order</Link>
        </Button>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor, supplier, atau company..." className="pl-9" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Memuat Purchase Order...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShoppingCart className="size-7" /></span>
            <h2 className="font-semibold text-slate-900 dark:text-white">Belum ada Purchase Order</h2>
            <p className="mt-1 text-sm text-slate-500">Buat dokumen pertama untuk memulai proses pembelian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr><th className="px-5 py-3">Purchase Order</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Required By</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Grand Total</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="px-5 py-4 font-semibold text-blue-600"><Link to={`/desk/purchase-order/${order.id}`}>{order.number}</Link></td>
                    <td className="px-5 py-4"><div className="font-medium">{order.supplier}</div><div className="text-xs text-slate-500">{order.company}</div></td>
                    <td className="px-5 py-4 text-slate-600">{dateForInput(order.transaction_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{dateForInput(order.schedule_date)}</td>
                    <td className="px-5 py-4"><Badge variant={order.status === "submitted" ? "default" : "secondary"} className={order.status === "submitted" ? "bg-emerald-600" : ""}>{order.status}</Badge></td>
                    <td className="px-5 py-4 text-right font-semibold">{money(order.rounded_total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
