import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { posApi, type POSInvoice } from "../posApi";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function POSInvoicePage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await posApi.listInvoices());
    } catch {
      toast.error("Gagal memuat POS Invoice");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
      (inv.customer && inv.customer.toLowerCase().includes(q)) ||
      (inv.mode_of_payment && inv.mode_of_payment.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-full bg-slate-50/60 p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
              <span>/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">POS Invoice</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold">POS Invoice</h1>
            <p className="mt-1 text-sm text-slate-500">
              Transaksi penjualan kasir POS, faktur kasir, dan ringkasan penerimaan.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}>
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/desk/point-of-sale")}>
              POS Screen
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate("/desk/pos-invoice/new")}>
              <Plus className="mr-1.5 size-4" /> New POS Invoice
            </Button>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-950">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari invoice number, customer..."
            className="max-w-md h-9 text-xs"
          />
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-mono text-xs font-medium">
                      <Link
                        to={`/desk/pos-invoice/${invoice.id || invoice.invoice_number}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4">{invoice.customer || "Walk-in Customer"}</td>
                    <td className="px-5 py-4">
                      {invoice.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-5 py-4">{invoice.mode_of_payment}</td>
                    <td className="px-5 py-4 font-semibold">{money(invoice.grand_total || 0)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {invoice.status || "Paid"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {invoice.created_at ? new Date(invoice.created_at).toLocaleString("id-ID") : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-500">
                      Belum ada transaksi POS.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

