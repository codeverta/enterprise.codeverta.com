import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowUpDown,
  BookOpen,
  Calendar,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { glEntryApi, type GLEntry, type GLEntryFilter } from "../glEntryApi";

const formatCurrency = (val: number, currency: string = "IDR") => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getVoucherPath = (type: string, no: string) => {
  if (!type || !no) return "#";
  const slug = type.toLowerCase().replace(/\s+/g, "-");
  return `/desk/${slug}/${encodeURIComponent(no)}`;
};

export default function GLEntryListPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<GLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [difference, setDifference] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [isCancelled, setIsCancelled] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [voucherTypes, setVoucherTypes] = useState<string[]>([]);

  const fetchOptions = async () => {
    try {
      const opts = await glEntryApi.getOptions();
      if (opts?.voucher_types) {
        setVoucherTypes(opts.voucher_types);
      }
    } catch {
      // ignore
    }
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const filter: GLEntryFilter = {
        q: search || undefined,
        voucher_type: voucherType || undefined,
        is_cancelled: isCancelled !== "" ? isCancelled : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };
      const res = await glEntryApi.list(filter);
      setEntries(res?.data || []);
      setTotal(res?.total || 0);
      setTotalDebit(res?.total_debit || 0);
      setTotalCredit(res?.total_credit || 0);
      setDifference(res?.difference || 0);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal memuat GL Entry");
    } finally {
      setLoading(false);
    }
  }, [search, voucherType, isCancelled, fromDate, toDate]);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEntries();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchEntries]);

  const resetFilters = () => {
    setSearch("");
    setVoucherType("");
    setIsCancelled("");
    setFromDate("");
    setToDate("");
  };

  const hasFilters = Boolean(search || voucherType || isCancelled || fromDate || toDate);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Link to="/desk/accounting" className="hover:text-blue-600 transition-colors">
              Akuntansi
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-800">GL Entry</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100/70 text-blue-700">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                GL Entry
              </h1>
              <p className="text-xs text-slate-500">
                Buku Besar Umum (General Ledger Entries) untuk seluruh transaksi keuangan ERP
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEntries}
            disabled={loading}
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/desk/gl-entry/new")}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
          >
            <Plus className="size-4 mr-1.5" />
            New GL Entry
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Entries</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
          <span className="text-[11px] text-slate-400">Terekam di General Ledger</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Debit</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {formatCurrency(totalDebit)}
          </p>
          <span className="text-[11px] text-slate-400">Akumulasi mutasi debit</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Credit</span>
          <p className="mt-1 text-2xl font-bold text-indigo-600">
            {formatCurrency(totalCredit)}
          </p>
          <span className="text-[11px] text-slate-400">Akumulasi mutasi kredit</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Status Keseimbangan</span>
          <div className="mt-1.5 flex items-center gap-2">
            {Math.abs(difference) < 0.01 ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-1">
                <CheckCircle2 className="size-3.5 mr-1" /> Balanced (Seimbang)
              </Badge>
            ) : (
              <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs px-2.5 py-1">
                Selisih: {formatCurrency(difference)}
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {Math.abs(difference) < 0.01 ? "Debit dan kredit seimbang" : "Perlu verifikasi posting"}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari voucher no, akun, lawan akun, remarks, ID..."
              className="pl-9 h-10 rounded-xl text-sm border-slate-200 bg-slate-50/50 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="">Semua Voucher Type</option>
              {voucherTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={isCancelled}
              onChange={(e) => setIsCancelled(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="">Semua Status</option>
              <option value="false">Aktif (Berlaku)</option>
              <option value="true">Dibatalkan (Cancelled)</option>
            </select>

            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 text-xs w-36"
                title="Dari Tanggal"
              />
              <span className="text-slate-400 text-xs">-</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 text-xs w-36"
                title="Sampai Tanggal"
              />
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-10 text-xs text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3.5">ID</th>
                <th className="py-3 px-3.5">Posting Date</th>
                <th className="py-3 px-3.5">Account</th>
                <th className="py-3 px-3.5 text-right">Debit</th>
                <th className="py-3 px-3.5 text-right">Credit</th>
                <th className="py-3 px-3.5">Voucher Type</th>
                <th className="py-3 px-3.5">Voucher No</th>
                <th className="py-3 px-3.5">Against</th>
                <th className="py-3 px-3.5">Cost Center</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-6 animate-spin text-blue-500" />
                      <span>Memuat data GL Entry...</span>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BookOpen className="size-8 text-slate-300" />
                      <span className="font-medium text-slate-600">Tidak ada GL Entry ditemukan</span>
                      <span className="text-xs text-slate-400">
                        {hasFilters
                          ? "Coba sesuaikan kata kunci pencarian atau filter Anda."
                          : "Belum ada mutasi General Ledger yang tercatat."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-slate-50/80 cursor-pointer ${
                      item.is_cancelled ? "bg-rose-50/20 opacity-80" : ""
                    }`}
                    onClick={() => navigate(`/desk/gl-entry/${item.id}`)}
                  >
                    <td className="py-3 px-3.5 font-mono text-[11px] font-semibold text-blue-600 hover:underline">
                      <Link
                        to={`/desk/gl-entry/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.id}
                      </Link>
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {formatDate(item.posting_date)}
                    </td>

                    <td className="py-3 px-3.5 max-w-[200px] truncate" title={item.account}>
                      <span className="font-semibold text-slate-800">
                        {item.account}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                      {item.debit > 0 ? (
                        <span className="text-blue-700 font-semibold">
                          {formatCurrency(item.debit, item.account_currency)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Rp 0</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                      {item.credit > 0 ? (
                        <span className="text-indigo-700 font-semibold">
                          {formatCurrency(item.credit, item.account_currency)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Rp 0</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-medium border-slate-200">
                        {item.voucher_type}
                      </Badge>
                    </td>

                    <td className="py-3 px-3.5 font-mono text-[11px] whitespace-nowrap">
                      <Link
                        to={getVoucherPath(item.voucher_type, item.voucher_no)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-700 hover:text-blue-600 hover:underline font-medium"
                      >
                        {item.voucher_no}
                      </Link>
                    </td>

                    <td className="py-3 px-3.5 max-w-[180px] truncate text-slate-500" title={item.against}>
                      {item.against || "-"}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-500">
                      {item.cost_center || "-"}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {item.is_cancelled ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                          Cancelled
                        </Badge>
                      ) : item.is_opening ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                          Opening
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-3.5 max-w-[200px] truncate text-slate-500" title={item.remarks}>
                      {item.remarks || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
          <span>Menampilkan {entries.length} dari {total} data GL Entry</span>
          <span className="font-mono text-[11px]">General Ledger • Codeverta ERP</span>
        </div>
      </div>
    </div>
  );
}
