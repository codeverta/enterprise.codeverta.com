import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { FilePlus2, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyingApi, dateForInput, type PurchaseInvoice } from "../api";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";

const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", {
  style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2,
}).format(value || 0);

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await buyingApi.invoiceList({ q: query || undefined, status: status || undefined, page_size: 100 });
      setInvoices(response.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mengambil Purchase Invoice");
    } finally { setLoading(false); }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return <ERPPage>
    <ERPPageHeader title="Purchase Invoice" description="Catat tagihan supplier, pajak, pembayaran, dan nilai persediaan." breadcrumbs={[{ label: "Buying", href: "/desk/buying" }, { label: "Purchase Invoice" }]} actions={<Button asChild className="bg-blue-600 hover:bg-blue-700"><Link to="/desk/purchase-invoice/new"><FilePlus2 className="size-4" /> New Purchase Invoice</Link></Button>}/>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor, supplier, atau invoice supplier..." className="pl-9" /></div>
        <ERPSelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm"><ERPSelectOption value="">Semua status</ERPSelectOption><ERPSelectOption value="draft">Draft</ERPSelectOption><ERPSelectOption value="submitted">Submitted</ERPSelectOption><ERPSelectOption value="cancelled">Cancelled</ERPSelectOption></ERPSelect>
      </div>
      {loading ? <div className="p-12 text-center text-sm text-slate-500">Memuat Purchase Invoice...</div> : invoices.length === 0 ?
        <div className="flex flex-col items-center px-6 py-16 text-center"><span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ReceiptText className="size-7" /></span><h2 className="font-semibold">Belum ada Purchase Invoice</h2><p className="mt-1 text-sm text-slate-500">Buat tagihan supplier pertama untuk memulai pencatatan.</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Purchase Invoice</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Supplier Invoice</th><th className="px-5 py-3">Posting / Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Rounded Total</th></tr></thead><tbody className="divide-y">{invoices.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"><td className="px-5 py-4 font-semibold text-blue-600"><Link to={`/desk/purchase-invoice/${invoice.id}`}>{invoice.number}</Link></td><td className="px-5 py-4"><div className="font-medium">{invoice.supplier}</div><div className="text-xs text-slate-500">{invoice.company}</div></td><td className="px-5 py-4">{invoice.bill_no || "—"}</td><td className="px-5 py-4 text-slate-600"><div>{dateForInput(invoice.posting_date)}</div><div className="text-xs">Due {dateForInput(invoice.due_date)}</div></td><td className="px-5 py-4"><Badge variant={invoice.status === "submitted" ? "default" : "secondary"} className={invoice.status === "submitted" ? "bg-emerald-600" : ""}>{invoice.status}</Badge></td><td className="px-5 py-4 text-right font-semibold">{money(invoice.rounded_total, invoice.currency)}</td></tr>)}</tbody></table></div>}
    </section>
  </ERPPage>;
}
