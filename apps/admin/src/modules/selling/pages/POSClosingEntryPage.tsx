import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, RefreshCw, Plus, LogOut, Trash2, Edit3, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { posApi, type POSClosingEntry, type POSOpeningEntry } from "../posApi";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateTime = (value?: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function POSClosingEntryPage() {
  const navigate = useNavigate();
  const [closings, setClosings] = useState<POSClosingEntry[]>([]);
  const [activeOpening, setActiveOpening] = useState<POSOpeningEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, history] = await Promise.all([
        posApi.currentOpening(),
        posApi.listClosings(),
      ]);
      setActiveOpening(current.data);
      setClosings(history || []);
    } catch {
      toast.error("Gagal memuat data POS Closing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">POS Closing Entry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">POS Closing Entry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rekonsiliasi pembayaran, audit kas fisik, dan penutupan shift kasir Point of Sale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/pos-closing-entry/new">
              <Plus className="mr-2 size-4" /> New POS Closing Entry
            </Link>
          </Button>
        </div>
      </header>

      {/* Active Shift Card (if any) */}
      {activeOpening && (
        <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-blue-900 dark:bg-blue-950/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Shift Kasir Sedang Aktif: <span className="font-mono text-blue-600">{activeOpening.id}</span>
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Profile: <b>{activeOpening.pos_profile}</b> · Cashier: <b>{activeOpening.user}</b> · Mulai: {dateTime(activeOpening.period_start_date)}
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link to="/desk/pos-closing-entry/new">
              <LogOut className="mr-2 size-4" /> Tutup Shift Sekarang
            </Link>
          </Button>
        </div>
      )}

      {/* Closing History Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-base text-slate-800 dark:text-slate-200">
            Daftar POS Closing Entry
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-3.5 px-4">No. Closing Entry</th>
                <th className="py-3.5 px-4">POS Opening Entry</th>
                <th className="py-3.5 px-4">POS Profile</th>
                <th className="py-3.5 px-4">Cashier</th>
                <th className="py-3.5 px-4">Period End Date</th>
                <th className="py-3.5 px-4 text-right">Grand Total</th>
                <th className="py-3.5 px-4 text-right">Difference</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin mb-2" />
                    Memuat daftar Closing Entry...
                  </td>
                </tr>
              ) : closings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <LogOut className="mx-auto size-12 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Belum ada POS Closing Entry</p>
                    <p className="text-xs text-slate-400 mt-1">Tutup shift kasir untuk membuat rekonsiliasi pembayaran.</p>
                  </td>
                </tr>
              ) : (
                closings.map((entry) => {
                  const difference = (entry.payment_reconciliation || []).reduce(
                    (sum, row) => sum + row.difference,
                    0
                  );
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors dark:hover:bg-slate-900/50"
                      onClick={() => navigate(`/desk/pos-closing-entry/${entry.id}`)}
                    >
                      <td className="py-3.5 px-4 font-semibold text-blue-600 hover:underline">
                        {entry.id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {entry.pos_opening_entry}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">
                        {entry.pos_profile || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {entry.user}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {dateTime(entry.period_end_date)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {money(entry.grand_total)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          difference === 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {money(difference)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="default">
                          <CheckCircle2 className="mr-1 size-3 inline" />
                          {entry.status || "Submitted"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-blue-600"
                            onClick={() => navigate(`/desk/pos-closing-entry/${entry.id}`)}
                          >
                            <ArrowRight className="size-4" />
                          </Button>
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
