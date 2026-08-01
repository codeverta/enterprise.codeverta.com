import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { posApi, type POSClosingEntry, type POSInvoice, type POSOpeningEntry } from "../posApi";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function POSClosingEntryPage() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState<POSOpeningEntry | null>(null);
  const [closings, setClosings] = useState<POSClosingEntry[]>([]);
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [actual, setActual] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, history] = await Promise.all([posApi.currentOpening(), posApi.listClosings()]);
      setOpening(current.data); setClosings(history);
      if (current.data) setInvoices(await posApi.listInvoices(current.data.id)); else setInvoices([]);
    } catch { toast.error("Gagal memuat data closing"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!opening) return [];
    const sales = invoices.reduce<Record<string, number>>((result, invoice) => {
      result[invoice.mode_of_payment] = (result[invoice.mode_of_payment] || 0) + Number(invoice.paid_amount || invoice.grand_total || 0);
      return result;
    }, {});
    const modes = new Set([...opening.balance_details.map((row) => row.mode_of_payment), ...Object.keys(sales)]);
    return [...modes].map((mode) => {
      const openingAmount = opening.balance_details.find((row) => row.mode_of_payment === mode)?.opening_amount || 0;
      const expected = openingAmount + (sales[mode] || 0);
      const closingAmount = actual[mode] ?? expected;
      return { mode, openingAmount, expected, closingAmount, difference: closingAmount - expected };
    });
  }, [opening, invoices, actual]);
  const netTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.net_total || 0), 0);
  const grandTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);

  const closeShift = async () => {
    if (!opening) return;
    setSubmitting(true);
    try {
      await posApi.closeOpening(opening.id, Object.fromEntries(rows.map((row) => [row.mode, row.closingAmount])));
      toast.success("POS Closing Entry berhasil dibuat");
      await load();
    } catch (error: any) { toast.error(error?.message || "Gagal menutup shift"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-full bg-slate-50/60 p-5 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Selling · Point of Sale</p><h1 className="mt-1 text-2xl font-semibold">POS Closing Entry</h1><p className="mt-1 text-sm text-slate-500">Rekonsiliasi pembayaran dan akhiri shift kasir.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div>

      {opening ? <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between border-b pb-4"><h2 className="font-semibold">Period Details</h2><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Open</span></div><dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm"><div><dt className="text-slate-500">Period Start Date</dt><dd className="mt-1 font-medium">{dateTime(opening.period_start_date)}</dd></div><div><dt className="text-slate-500">Period End Date</dt><dd className="mt-1 font-medium">{dateTime(new Date().toISOString())}</dd></div><div className="col-span-2"><dt className="text-slate-500">POS Opening Entry</dt><dd className="mt-1 font-mono text-xs font-medium">{opening.id}</dd></div><div><dt className="text-slate-500">Company</dt><dd className="mt-1 font-medium">{opening.company}</dd></div><div><dt className="text-slate-500">Cashier</dt><dd className="mt-1 font-medium">{opening.user}</dd></div></dl><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Net Total</p><p className="mt-1 text-lg font-semibold">{money(netTotal)}</p></div><div className="rounded-lg bg-slate-950 p-4 text-white"><p className="text-xs text-white/60">Grand Total</p><p className="mt-1 text-lg font-semibold">{money(grandTotal)}</p></div></div></section>
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">Payment Reconciliation</h2><p className="mt-1 text-sm text-slate-500">Hitung kas fisik dan isi jumlah aktual sebelum closing.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Opening</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Closing</th><th className="px-4 py-3">Difference</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.mode}><td className="px-4 py-4 font-medium">{row.mode}</td><td className="px-4 py-4">{money(row.openingAmount)}</td><td className="px-4 py-4 font-medium">{money(row.expected)}</td><td className="px-4 py-3"><div className="flex h-9 min-w-40 items-center rounded-md border px-2"><span className="mr-1 text-slate-400">Rp</span><input type="number" value={row.closingAmount} onChange={(e) => setActual({ ...actual, [row.mode]: Number(e.target.value) })} className="w-full outline-none" /></div></td><td className={`px-4 py-4 font-semibold ${row.difference === 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(row.difference)}</td></tr>)}</tbody></table></div><div className="flex justify-end border-t p-4"><Button onClick={closeShift} disabled={submitting}>{submitting ? "Submitting..." : "Submit Closing Entry"}<ArrowRight /></Button></div></section>
      </div> : <section className="rounded-xl border bg-white p-10 text-center shadow-sm"><CheckCircle2 className="mx-auto size-12 text-emerald-500" /><h2 className="mt-4 text-xl font-semibold">Tidak ada shift aktif</h2><p className="mt-2 text-sm text-slate-500">Semua POS Opening Entry sudah ditutup.</p><Button className="mt-6" onClick={() => navigate("/desk/pos-opening-entry/new")}><ArrowRight /> Buat Opening Baru</Button></section>}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">Closing History</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Entry</th><th className="px-5 py-3">Opening Entry</th><th className="px-5 py-3">Cashier</th><th className="px-5 py-3">Period End</th><th className="px-5 py-3">Grand Total</th><th className="px-5 py-3">Difference</th></tr></thead><tbody className="divide-y">{closings.map((entry) => { const difference = entry.payment_reconciliation.reduce((sum, row) => sum + row.difference, 0); return <tr key={entry.id}><td className="px-5 py-4 font-mono text-xs">{entry.id}</td><td className="px-5 py-4 font-mono text-xs">{entry.pos_opening_entry}</td><td className="px-5 py-4">{entry.user}</td><td className="px-5 py-4 text-slate-600">{dateTime(entry.period_end_date)}</td><td className="px-5 py-4 font-medium">{money(entry.grand_total)}</td><td className={`px-5 py-4 font-semibold ${difference === 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(difference)}</td></tr>; })}{!loading && closings.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Belum ada closing entry.</td></tr>}</tbody></table></div></section>
    </div></div>
  );
}
