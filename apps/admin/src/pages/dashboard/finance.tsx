"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  Wallet as WalletIcon,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "react-router";

// --- Types ---
type Summary = { active_balance: number; total_omset: number };
type Withdrawal = {
  id: string;
  amount: number;
  admin_fee: number;
  total_deduct: number;
  status: string;
  created_at: string;
};
type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "PAYOUT";
  amount: number;
  description: string;
  balance_after: number;
  created_at: string;
};

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const exportToCSV = (data: any[], headers: string[], keys: string[], filename: string) => {
  const csvRows = [];
  // UTF-8 BOM so Excel opens it with correct encoding
  csvRows.push("\uFEFF" + headers.join(","));
  for (const row of data) {
    const values = keys.map(key => {
      let val = row[key];
      if (val === undefined || val === null) val = "";
      const stringVal = String(val);
      if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    csvRows.push(values.join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToPDF = (title: string, headers: string[], data: any[], formatters: ((row: any) => string)[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Gagal membuka jendela cetak. Pastikan pop-up diperbolehkan.");
    return;
  }
  const rowsHtml = data.map(row => 
    `<tr>${formatters.map(fmt => `<td style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px; color: #334155;">${fmt(row)}</td>`).join("")}</tr>`
  ).join("");

  const headersHtml = headers.map(h => `<th style="padding: 12px 10px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: left; font-size: 12px; font-weight: 600; color: #1e293b;">${h}</th>`).join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; }
          h1 { font-size: 24px; font-weight: 700; margin-bottom: 5px; color: #0f172a; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Laporan Keuangan KITA Future &middot; Dicetak pada: ${new Date().toLocaleString("id-ID")}</div>
        <table>
          <thead>
            <tr>${headersHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export function FinanceDashboard() {
  const [payoutSetting, setPayoutSetting] = useState<any>(null);
  const [summary, setSummary] = useState<Summary>({
    active_balance: 0,
    total_omset: 0,
  });
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawals Date Range State
  const [wdDate, setWdDate] = useState<DateRange | undefined>({
    from: dayjs().subtract(30, "day").startOf("day").toDate(),
    to: dayjs().endOf("day").toDate(),
  });
  const [wdPreset, setWdPreset] = useState("30");

  // Transactions Date Range State
  const [txDate, setTxDate] = useState<DateRange | undefined>({
    from: dayjs().subtract(30, "day").startOf("day").toDate(),
    to: dayjs().endOf("day").toDate(),
  });
  const [txPreset, setTxPreset] = useState("30");

  const handleWdPresetChange = (value: string) => {
    setWdPreset(value);
    if (value === "all") {
      setWdDate(undefined);
    } else {
      const days = parseInt(value, 10);
      setWdDate({
        from: dayjs().subtract(days, "day").startOf("day").toDate(),
        to: dayjs().endOf("day").toDate(),
      });
    }
  };

  const handleTxPresetChange = (value: string) => {
    setTxPreset(value);
    if (value === "all") {
      setTxDate(undefined);
    } else {
      const days = parseInt(value, 10);
      setTxDate({
        from: dayjs().subtract(days, "day").startOf("day").toDate(),
        to: dayjs().endOf("day").toDate(),
      });
    }
  };

  // Pagination states
  const [wdPage, setWdPage] = useState(1);
  const [wdLimit, setWdLimit] = useState(10);
  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(10);

  // --- Fetch Data ---
  const fetchFinanceData = async () => {
    setRefreshing(true);
    try {
      const [sumRes, wdRes, txRes, payoutRes] = await Promise.all([
        api.get("/finance/summary").then((res) => res.data),
        api.get("/finance/withdrawals").then((res) => res.data),
        api.get("/finance/transactions").then((res) => res.data),
        api.get("/settings/payout").then((res) => res.data),
      ]);

      setSummary({
        active_balance: sumRes.active_balance || 0,
        total_omset: sumRes.total_omset || 0,
      });
      setWithdrawals(Array.isArray(wdRes) ? wdRes : []);
      setTransactions(Array.isArray(txRes) ? txRes : []);

      if (payoutRes && payoutRes.bank_account_number) {
        setPayoutSetting(payoutRes);
      } else {
        setPayoutSetting(null);
      }
    } catch (error) {
      console.error("Failed to fetch finance data", error);
      toast.error("Gagal memperbarui data keuangan");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  // --- Filtered Data ---
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((wd) => {
      if (!wd.created_at) return true;
      const wdTime = dayjs(wd.created_at);
      if (wdDate?.from && wdTime.isBefore(dayjs(wdDate.from).startOf("day"))) return false;
      if (wdDate?.to && wdTime.isAfter(dayjs(wdDate.to).endOf("day"))) return false;
      return true;
    });
  }, [withdrawals, wdDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((trx) => {
      if (!trx.created_at) return true;
      const trxTime = dayjs(trx.created_at);
      if (txDate?.from && trxTime.isBefore(dayjs(txDate.from).startOf("day"))) return false;
      if (txDate?.to && trxTime.isAfter(dayjs(txDate.to).endOf("day"))) return false;
      return true;
    });
  }, [transactions, txDate]);

  // Reset pagination to page 1 on filter change
  useEffect(() => {
    setWdPage(1);
  }, [wdDate]);

  useEffect(() => {
    setTxPage(1);
  }, [txDate]);

  // Paginated Data
  const paginatedWithdrawals = useMemo(() => {
    const start = (wdPage - 1) * wdLimit;
    return filteredWithdrawals.slice(start, start + wdLimit);
  }, [filteredWithdrawals, wdPage, wdLimit]);

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txLimit;
    return filteredTransactions.slice(start, start + txLimit);
  }, [filteredTransactions, txPage, txLimit]);

  const totalWdPages = Math.max(1, Math.ceil(filteredWithdrawals.length / wdLimit));
  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txLimit));

  // --- Exports ---
  const handleExportCSV = (type: "withdrawal" | "transaction") => {
    if (type === "withdrawal") {
      const headers = ["Tanggal", "Nominal Tarik", "Total Potongan", "Status"];
      const keys = ["date", "amount", "total_deduct", "status"];
      const data = filteredWithdrawals.map(wd => ({
        date: dayjs(wd.created_at).format("DD MMM YYYY, HH:mm"),
        amount: wd.amount,
        total_deduct: wd.total_deduct,
        status: wd.status,
      }));
      exportToCSV(data, headers, keys, `riwayat_penarikan_${dayjs().format("YYYY-MM-DD")}.csv`);
      toast.success("CSV Riwayat Penarikan berhasil diekspor");
    } else {
      const headers = ["Waktu", "Deskripsi", "Tipe", "Nominal", "Saldo Akhir"];
      const keys = ["date", "description", "type", "amount", "balance_after"];
      const data = filteredTransactions.map(trx => ({
        date: dayjs(trx.created_at).format("DD MMM YYYY, HH:mm"),
        description: trx.description,
        type: trx.type,
        amount: trx.amount,
        balance_after: trx.balance_after,
      }));
      exportToCSV(data, headers, keys, `mutasi_saldo_${dayjs().format("YYYY-MM-DD")}.csv`);
      toast.success("CSV Mutasi Saldo berhasil diekspor");
    }
  };

  const handleExportPDF = (type: "withdrawal" | "transaction") => {
    if (type === "withdrawal") {
      const headers = ["Tanggal", "Nominal Tarik", "Total Potongan", "Status"];
      const formatters = [
        (r: any) => dayjs(r.created_at).format("DD MMM YYYY, HH:mm"),
        (r: any) => formatIDR(r.amount),
        (r: any) => formatIDR(r.total_deduct),
        (r: any) => r.status,
      ];
      exportToPDF("Riwayat Penarikan Dana", headers, filteredWithdrawals, formatters);
    } else {
      const headers = ["Waktu", "Deskripsi", "Tipe", "Nominal", "Saldo Akhir"];
      const formatters = [
        (r: any) => dayjs(r.created_at).format("DD MMM YYYY, HH:mm"),
        (r: any) => r.description,
        (r: any) => r.type,
        (r: any) => (r.amount > 0 ? "+" : "") + formatIDR(r.amount),
        (r: any) => formatIDR(r.balance_after),
      ];
      exportToPDF("Mutasi Saldo", headers, filteredTransactions, formatters);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);

    if (amount <= 0 || amount > summary.active_balance) {
      toast.error("Nominal penarikan tidak valid atau melebihi saldo.");
      return;
    }

    setIsWithdrawing(true);
    try {
      const response = await api.post("/finance/withdraw", {
        amount: amount,
        bank_name: payoutSetting?.bank_name || "",
        bank_account_number: payoutSetting?.bank_account_number || "",
        bank_account_name: payoutSetting?.bank_account_name || "",
      });

      toast.success(
        response.data?.message || "Penarikan berhasil diajukan dan sedang diproses."
      );

      setWithdrawAmount("");
      fetchFinanceData();
    } catch (error: any) {
      console.error("Withdraw error:", error);
      const errorMsg =
        error.response?.data?.error || "Terjadi kesalahan saat mengajukan penarikan.";
      toast.error(errorMsg);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handlePercentage = (percent: number) => {
    const amount = Math.floor((summary.active_balance * percent) / 100);
    setWithdrawAmount(amount.toString());
  };

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keuangan</h1>
          <p className="text-muted-foreground mt-1">
            Kelola saldo, penarikan dana, dan riwayat transaksi.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchFinanceData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* --- SECTION 1: STAT CARDS --- */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Omset (Bruto)
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatIDR(summary.total_omset)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Akumulasi seluruh penjualan
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Aktif</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatIDR(summary.active_balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dana bersih siap ditarik
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="w-full font-semibold"
                disabled={!payoutSetting || summary.active_balance <= 0}
              >
                Tarik Dana
              </Button>
            </DialogTrigger>
            {!payoutSetting && (
              <p className="text-[11px] text-red-500 text-center mt-2 leading-relaxed">
                * Rekening bank belum dikonfigurasi. Atur di{" "}
                <Link to="/desk/erpnext-settings/system-settings" className="underline font-medium hover:text-red-700">
                  Pengaturan Sistem
                </Link>
                .
              </p>
            )}
            {payoutSetting && summary.active_balance <= 0 && (
              <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">
                * Saldo aktif Anda harus lebih dari Rp 0 untuk melakukan penarikan.
              </p>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tarik Dana ke Rekening</DialogTitle>
              </DialogHeader>

              {payoutSetting && (
                <div className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 p-3 rounded-md text-sm mb-2 border border-blue-100 dark:border-blue-900">
                  <p className="font-medium">Tujuan Transfer:</p>
                  <p>
                    {payoutSetting.bank_name} -{" "}
                    {payoutSetting.bank_account_number}
                  </p>
                  <p className="uppercase">
                    A.N {payoutSetting.bank_account_name}
                  </p>
                </div>
              )}

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div className="space-y-3">
                  <Label>Nominal Penarikan</Label>
                  <Input
                    type="number"
                    placeholder="Contoh: 500000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={summary.active_balance}
                    required
                  />

                  {/* Opsi Persentase Tarik */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <Button
                        key={percent}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handlePercentage(percent)}
                      >
                        {percent === 100 ? "Semua" : `${percent}%`}
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span>
                      Saldo tersedia: {formatIDR(summary.active_balance)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isWithdrawing ||
                    Number(withdrawAmount) > summary.active_balance ||
                    Number(withdrawAmount) <= 0
                  }
                >
                  {isWithdrawing ? "Memproses..." : "Ajukan Penarikan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </Card>
      </div>

      {/* --- SECTION 2: WITHDRAWAL HISTORY --- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle>Riwayat Penarikan Dana</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Menampilkan {filteredWithdrawals.length} riwayat penarikan dana.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 w-full lg:w-auto">
            {/* 1. SHADCN SELECT FILTER */}
            <Select onValueChange={handleWdPresetChange} value={wdPreset}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Hari Terakhir</SelectItem>
                <SelectItem value="14">14 Hari Terakhir</SelectItem>
                <SelectItem value="30">30 Hari Terakhir</SelectItem>
                <SelectItem value="90">90 Hari Terakhir</SelectItem>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="custom" disabled className="hidden">Kustom</SelectItem>
              </SelectContent>
            </Select>

            {/* 2. DATE RANGE PICKER */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="wd-date"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full sm:w-[220px] justify-start text-left font-normal text-xs h-9",
                    !wdDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />
                  {wdDate?.from ? (
                    wdDate.to ? (
                      <>
                        {dayjs(wdDate.from).format("DD MMM YY")} -{" "}
                        {dayjs(wdDate.to).format("DD MMM YY")}
                      </>
                    ) : (
                      dayjs(wdDate.from).format("DD MMM YY")
                    )
                  ) : (
                    <span>Pilih Tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={wdDate?.from}
                  selected={wdDate}
                  onSelect={(range) => {
                    setWdDate(range);
                    setWdPreset("custom");
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 flex-1 sm:flex-initial h-9"
                onClick={() => handleExportCSV("withdrawal")}
                disabled={filteredWithdrawals.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> CSV / Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 flex-1 sm:flex-initial h-9"
                onClick={() => handleExportPDF("withdrawal")}
                disabled={filteredWithdrawals.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nominal Tarik</TableHead>
                <TableHead>Total Potongan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWithdrawals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground h-24"
                  >
                    Belum ada penarikan.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWithdrawals.map((wd) => (
                  <TableRow key={wd.id}>
                    <TableCell className="whitespace-nowrap">
                      {dayjs(wd.created_at).format("DD MMM YYYY, HH:mm")}
                    </TableCell>
                    <TableCell>{formatIDR(wd.amount)}</TableCell>
                    <TableCell className="font-medium">
                      {formatIDR(wd.total_deduct)}
                    </TableCell>
                    <TableCell>
                      {wd.status === "APPROVED" && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-600 border-emerald-200"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Sukses
                        </Badge>
                      )}
                      {wd.status === "PENDING" && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-600 border-amber-200"
                        >
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                      {wd.status === "REJECTED" && (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-600 border-red-200"
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Ditolak
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* WITHDRAWAL PAGINATION */}
          {filteredWithdrawals.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Menampilkan {Math.min(filteredWithdrawals.length, (wdPage - 1) * wdLimit + 1)} - {Math.min(filteredWithdrawals.length, wdPage * wdLimit)} dari {filteredWithdrawals.length} data
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(wdLimit)} onValueChange={(val) => { setWdLimit(Number(val)); setWdPage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 / hal</SelectItem>
                    <SelectItem value="10">10 / hal</SelectItem>
                    <SelectItem value="25">25 / hal</SelectItem>
                    <SelectItem value="50">50 / hal</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWdPage(1)}
                    disabled={wdPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWdPage(p => Math.max(1, p - 1))}
                    disabled={wdPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold px-2">
                    Hal {wdPage} dari {totalWdPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWdPage(p => Math.min(totalWdPages, p + 1))}
                    disabled={wdPage === totalWdPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWdPage(totalWdPages)}
                    disabled={wdPage === totalWdPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- SECTION 3: TRANSACTIONS / MUTASI --- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle>Mutasi Saldo</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Menampilkan {filteredTransactions.length} riwayat mutasi saldo.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 w-full lg:w-auto">
            {/* 1. SHADCN SELECT FILTER */}
            <Select onValueChange={handleTxPresetChange} value={txPreset}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Hari Terakhir</SelectItem>
                <SelectItem value="14">14 Hari Terakhir</SelectItem>
                <SelectItem value="30">30 Hari Terakhir</SelectItem>
                <SelectItem value="90">90 Hari Terakhir</SelectItem>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="custom" disabled className="hidden">Kustom</SelectItem>
              </SelectContent>
            </Select>

            {/* 2. DATE RANGE PICKER */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="tx-date"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full sm:w-[220px] justify-start text-left font-normal text-xs h-9",
                    !txDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />
                  {txDate?.from ? (
                    txDate.to ? (
                      <>
                        {dayjs(txDate.from).format("DD MMM YY")} -{" "}
                        {dayjs(txDate.to).format("DD MMM YY")}
                      </>
                    ) : (
                      dayjs(txDate.from).format("DD MMM YY")
                    )
                  ) : (
                    <span>Pilih Tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={txDate?.from}
                  selected={txDate}
                  onSelect={(range) => {
                    setTxDate(range);
                    setTxPreset("custom");
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 flex-1 sm:flex-initial h-9"
                onClick={() => handleExportCSV("transaction")}
                disabled={filteredTransactions.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> CSV / Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 flex-1 sm:flex-initial h-9"
                onClick={() => handleExportPDF("transaction")}
                disabled={filteredTransactions.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Saldo Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground h-24"
                  >
                    Belum ada mutasi saldo.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {dayjs(trx.created_at).format("DD MMM YYYY, HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {trx.description}
                    </TableCell>
                    <TableCell>
                      {trx.type === "INCOME" && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        >
                          Income
                        </Badge>
                      )}
                      {trx.type === "EXPENSE" && (
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-700 hover:bg-red-100"
                        >
                          Expense
                        </Badge>
                      )}
                      {trx.type === "PAYOUT" && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 hover:bg-blue-100"
                        >
                          Payout
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        trx.amount < 0 ? "text-red-500" : "text-emerald-500"
                      }`}
                    >
                      {trx.amount > 0 ? "+" : ""}
                      {formatIDR(trx.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatIDR(trx.balance_after)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* TRANSACTIONS PAGINATION */}
          {filteredTransactions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Menampilkan {Math.min(filteredTransactions.length, (txPage - 1) * txLimit + 1)} - {Math.min(filteredTransactions.length, txPage * txLimit)} dari {filteredTransactions.length} data
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(txLimit)} onValueChange={(val) => { setTxLimit(Number(val)); setTxPage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 / hal</SelectItem>
                    <SelectItem value="10">10 / hal</SelectItem>
                    <SelectItem value="25">25 / hal</SelectItem>
                    <SelectItem value="50">50 / hal</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTxPage(1)}
                    disabled={txPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    disabled={txPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold px-2">
                    Hal {txPage} dari {totalTxPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                    disabled={txPage === totalTxPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTxPage(totalTxPages)}
                    disabled={txPage === totalTxPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardLayout(FinanceDashboard);
