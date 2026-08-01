import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { posApi, type POSInvoice } from "../posApi";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export default function POSInvoicePage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setInvoices(await posApi.listInvoices()); } catch { toast.error("Gagal memuat POS Invoice"); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="min-h-full bg-slate-50/60 p-5 lg:p-8"><div className="mx-auto max-w-7xl space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Selling · Point of Sale</p><h1 className="mt-1 text-2xl font-semibold">POS Invoice</h1><p className="mt-1 text-sm text-slate-500">Transaksi penjualan terbaru dari seluruh shift POS.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button><Button onClick={() => navigate("/desk/point-of-sale")}><Plus />New Invoice</Button></div></div><div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y">{invoices.map((invoice) => <tr key={invoice.id}><td className="px-5 py-4 font-mono text-xs font-medium">{invoice.invoice_number}</td><td className="px-5 py-4">{invoice.customer || "Walk-in Customer"}</td><td className="px-5 py-4">{invoice.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="px-5 py-4">{invoice.mode_of_payment}</td><td className="px-5 py-4 font-semibold">{money(invoice.grand_total || 0)}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{invoice.status || "Paid"}</span></td><td className="px-5 py-4 text-slate-500">{invoice.created_at ? new Date(invoice.created_at).toLocaleString("id-ID") : "—"}</td></tr>)}{!loading && invoices.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-slate-500">Belum ada transaksi POS.</td></tr>}</tbody></table></div></div></div></div>;
}
