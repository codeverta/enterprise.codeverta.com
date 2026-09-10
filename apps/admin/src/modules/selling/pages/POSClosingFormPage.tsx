import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Clock,
  Building2,
  Store,
  User,
  Calendar,
  WalletCards,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  posApi,
  type POSClosingEntry,
  type POSOpeningEntry,
  type POSInvoice,
  type POSReconciliation,
} from "../posApi";

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
};

export default function POSClosingFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-pos-closing-entry");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openings, setOpenings] = useState<POSOpeningEntry[]>([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>("");
  const [selectedOpening, setSelectedOpening] = useState<POSOpeningEntry | null>(null);
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [existingClosing, setExistingClosing] = useState<POSClosingEntry | null>(null);

  // Form fields
  const [periodEndDate, setPeriodEndDate] = useState<string>(localDateTime());
  const [postingDate, setPostingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [postingTime, setPostingTime] = useState<string>(
    new Date().toTimeString().slice(0, 8)
  );
  const [actualAmounts, setActualAmounts] = useState<Record<string, number>>({});

  // 1. Load active openings or existing closing entry
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        if (!isNew && id) {
          const closing = await posApi.getClosing(id);
          if (closing) {
            setExistingClosing(closing);
            setSelectedOpeningId(closing.pos_opening_entry);
            setPeriodEndDate(closing.period_end_date ? closing.period_end_date.slice(0, 19) : localDateTime());
            setPostingDate(closing.posting_date ? closing.posting_date.slice(0, 10) : "");
            setPostingTime(closing.posting_time || "");
            const actuals: Record<string, number> = {};
            (closing.payment_reconciliation || []).forEach((r) => {
              actuals[r.mode_of_payment] = r.closing_amount;
            });
            setActualAmounts(actuals);
          }
        } else {
          // New Closing: fetch open openings
          const openList = await posApi.listOpenings({ status: "Open" });
          setOpenings(openList || []);
          if (openList && openList.length > 0) {
            setSelectedOpeningId(openList[0].id);
          }
        }
      } catch {
        toast.error("Gagal memuat data POS Closing");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isNew]);

  // 2. When selected opening changes, fetch opening details and invoices
  useEffect(() => {
    if (!selectedOpeningId) {
      setSelectedOpening(null);
      setInvoices([]);
      return;
    }

    const loadOpeningDetails = async () => {
      try {
        const [opData, invList] = await Promise.all([
          posApi.getOpening(selectedOpeningId),
          posApi.listInvoices(selectedOpeningId),
        ]);
        setSelectedOpening(opData);
        setInvoices(invList || []);
      } catch {
        // If from list
        const match = openings.find((o) => o.id === selectedOpeningId);
        if (match) setSelectedOpening(match);
      }
    };

    if (isNew) {
      loadOpeningDetails();
    }
  }, [selectedOpeningId, isNew]);

  // Payment Reconciliations calculation
  const paymentRows = useMemo(() => {
    if (!isNew && existingClosing) {
      return (existingClosing.payment_reconciliation || []).map((r) => ({
        mode: r.mode_of_payment,
        openingAmount: r.opening_amount,
        expectedAmount: r.expected_amount,
        closingAmount: r.closing_amount,
        difference: r.difference,
      }));
    }

    if (!selectedOpening) {
      // When POS Opening Entry has not been selected yet
      return [
        { mode: "Cash", openingAmount: 0, expectedAmount: 0, closingAmount: 0, difference: 0 },
        { mode: "Bank Transfer", openingAmount: 0, expectedAmount: 0, closingAmount: 0, difference: 0 },
      ];
    }

    const salesByMode = invoices.reduce<Record<string, number>>((acc, inv) => {
      acc[inv.mode_of_payment] = (acc[inv.mode_of_payment] || 0) + Number(inv.paid_amount || inv.grand_total || 0);
      return acc;
    }, {});

    const modes = new Set([
      ...(selectedOpening.balance_details || []).map((b) => b.mode_of_payment),
      ...Object.keys(salesByMode),
    ]);

    return [...modes].map((mode) => {
      const openingRow = (selectedOpening.balance_details || []).find((b) => b.mode_of_payment === mode);
      const openingAmount = openingRow?.opening_amount || 0;
      const expectedAmount = openingAmount + (salesByMode[mode] || 0);
      const closingAmount = actualAmounts[mode] !== undefined ? actualAmounts[mode] : expectedAmount;
      return {
        mode,
        openingAmount,
        expectedAmount,
        closingAmount,
        difference: closingAmount - expectedAmount,
      };
    });
  }, [isNew, existingClosing, selectedOpening, invoices, actualAmounts]);

  // Totals calculation
  const totals = useMemo(() => {
    if (!isNew && existingClosing) {
      return {
        totalQuantity: existingClosing.total_quantity || 0,
        netTotal: existingClosing.net_total || 0,
        totalTaxes: existingClosing.total_taxes_and_charges || 0,
        grandTotal: existingClosing.grand_total || 0,
      };
    }

    let qty = 0;
    let net = 0;
    let tax = 0;
    let grand = 0;

    invoices.forEach((inv) => {
      net += Number(inv.net_total || 0);
      tax += Number(inv.tax_total || 0);
      grand += Number(inv.grand_total || 0);
      (inv.items || []).forEach((it) => {
        qty += Number(it.quantity || 0);
      });
    });

    return {
      totalQuantity: qty,
      netTotal: net,
      totalTaxes: tax,
      grandTotal: grand,
    };
  }, [isNew, existingClosing, invoices]);

  const handleSubmitClosing = async () => {
    if (!selectedOpeningId) {
      toast.error("POS Opening Entry wajib dipilih");
      return;
    }

    setSubmitting(true);
    try {
      const closingMap: Record<string, number> = {};
      paymentRows.forEach((r) => {
        closingMap[r.mode] = r.closingAmount;
      });

      const closed = await posApi.closeOpening(selectedOpeningId, closingMap);
      toast.success("POS Closing Entry berhasil disimpan dan shift resmi ditutup");
      navigate(`/desk/pos-closing-entry`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Gagal menutup shift");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadonly = !isNew;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-7">
      {/* Top Header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <Link to="/desk/pos-closing-entry" className="hover:text-blue-600">POS Closing Entry</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New POS Closing Entry" : existingClosing?.id || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New POS Closing Entry" : existingClosing?.id || "POS Closing Entry"}
            </h1>
            <Badge variant={isNew ? "secondary" : "default"}>
              {isNew ? "Not Saved" : existingClosing?.status || "Submitted"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/pos-closing-entry">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          {!isReadonly && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmitClosing}
              disabled={submitting || !selectedOpeningId}
            >
              <CheckCircle2 className="mr-2 size-4" />
              {submitting ? "Menyimpan..." : "Save & Close Shift"}
            </Button>
          )}
        </div>
      </div>

      {/* Period Details */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
          Period Details
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* If opening is selected, display Period Start Date */}
          {selectedOpening && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Period Start Date
              </label>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900">
                {new Date(selectedOpening.period_start_date).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}
              </div>
              <span className="mt-0.5 block text-[10px] text-slate-400">Asia/Jakarta</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Period End Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={periodEndDate}
              disabled={isReadonly}
              onChange={(e) => setPeriodEndDate(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
            <span className="mt-0.5 block text-[10px] text-slate-400">Asia/Jakarta</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Posting Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={postingDate}
              disabled={isReadonly}
              onChange={(e) => setPostingDate(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Posting Time
            </label>
            <Input
              type="time"
              value={postingTime}
              disabled={isReadonly}
              onChange={(e) => setPostingTime(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              POS Opening Entry <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              {isReadonly ? (
                <div className="p-2.5 rounded-lg border bg-slate-50 font-mono text-xs font-medium dark:bg-slate-900">
                  {selectedOpeningId}
                </div>
              ) : (
                <SearchableSelect
                  value={selectedOpeningId}
                  options={openings.map((o) => ({
                    value: o.id,
                    label: `${o.id} - ${o.pos_profile} (${o.user})`,
                    sublabel: `Mulai: ${new Date(o.period_start_date).toLocaleString("id-ID")}`,
                  }))}
                  onChange={(val) => setSelectedOpeningId(val)}
                  placeholder="Pilih POS Opening Entry yang masih aktif..."
                  searchPlaceholder="Cari ID Opening..."
                />
              )}
            </div>
            {!selectedOpeningId && isNew && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="size-3.5" /> Pilih POS Opening Entry terlebih dahulu untuk memuat data transaksi.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* User Details (Only shown when POS Opening is selected) */}
      {selectedOpening && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
          <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
            User Details
          </h2>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company
              </label>
              <div className="mt-1">
                <Link
                  to={`/desk/company/${encodeURIComponent(selectedOpening.company)}`}
                  className="font-semibold text-blue-600 hover:underline text-xs"
                >
                  {selectedOpening.company}
                </Link>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                POS Profile
              </label>
              <div className="mt-1">
                <Link
                  to={`/desk/pos-profile/${encodeURIComponent(selectedOpening.pos_profile)}`}
                  className="font-semibold text-blue-600 hover:underline text-xs"
                >
                  {selectedOpening.pos_profile}
                </Link>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cashier
              </label>
              <div className="mt-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                  {selectedOpening.user}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Totals Section */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
          Totals
        </h2>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Total Quantity</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {totals.totalQuantity}
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Net Total</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatRp(totals.netTotal)}
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Total Taxes and Charges</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatRp(totals.totalTaxes)}
            </p>
          </div>

          <div className="rounded-xl border bg-blue-50/70 p-4 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Grand Total</p>
            <p className="mt-1 text-xl font-extrabold text-blue-700 dark:text-blue-300">
              {formatRp(totals.grandTotal)}
            </p>
          </div>
        </div>
      </section>

      {/* Payment Reconciliation Table */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <div className="border-b pb-3">
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
            Modes of Payment (Payment Reconciliation)
          </h3>
          <p className="text-xs text-slate-500">
            Bandingkan saldo kas awal, penjualan yang diharapkan (Expected Amount), dan hitungan kas fisik penutupan (Closing Amount).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">No.</th>
                <th className="py-2.5 px-3 min-w-[180px]">Mode of Payment</th>
                <th className="py-2.5 px-3 min-w-[140px] text-right">Opening Amount</th>
                <th className="py-2.5 px-3 min-w-[140px] text-right">Expected Amount</th>
                <th className="py-2.5 px-3 min-w-[170px] text-right">Closing Amount</th>
                <th className="py-2.5 px-3 min-w-[140px] text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paymentRows.map((row, idx) => (
                <tr key={row.mode}>
                  <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-blue-600 hover:underline">
                    {row.mode}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    {formatRp(row.openingAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatRp(row.expectedAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isReadonly ? (
                      <span className="font-bold">{formatRp(row.closingAmount)}</span>
                    ) : (
                      <div className="flex h-8 items-center rounded-md border px-2.5 bg-white dark:bg-slate-900 ml-auto max-w-[160px]">
                        <span className="mr-1.5 text-slate-400 font-medium">Rp</span>
                        <input
                          type="number"
                          step="any"
                          value={row.closingAmount}
                          onChange={(e) =>
                            setActualAmounts({
                              ...actualAmounts,
                              [row.mode]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full text-xs font-bold text-right outline-none bg-transparent"
                        />
                      </div>
                    )}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      row.difference === 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatRp(row.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
