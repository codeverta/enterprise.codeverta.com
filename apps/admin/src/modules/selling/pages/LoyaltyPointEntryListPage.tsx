import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Coins,
  Filter,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { customerApi, type Customer } from "../customerApi";
import {
  loyaltyApi,
  type LoyaltyPointEntry,
  type LoyaltyProgram,
} from "../loyaltyApi";

export default function LoyaltyPointEntryListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialProgramFilter = searchParams.get("program") || "all";

  const [entries, setEntries] = useState<LoyaltyPointEntry[]>([]);
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState(initialProgramFilter);
  const [typeFilter, setTypeFilter] = useState("all");

  // Create Manual Entry Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newProgram, setNewProgram] = useState("");
  const [newType, setNewType] = useState<"Earned" | "Redeemed" | "Expired">("Earned");
  const [newPoints, setNewPoints] = useState<string>("");
  const [newPurchaseAmount, setNewPurchaseAmount] = useState<string>("");
  const [newReference, setNewReference] = useState("");
  const [newPostingDate, setNewPostingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [entryData, progData, custList] = await Promise.all([
        loyaltyApi.entriesList(),
        loyaltyApi.list(),
        customerApi.list().catch(() => []),
      ]);
      setEntries(entryData || []);
      setPrograms(progData || []);
      setCustomers(custList || []);

      const qProgram = searchParams.get("program");
      if (qProgram) {
        setProgramFilter(qProgram);
      }
    } catch {
      toast.error("Gagal memuat data Loyalty Point Entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleProgramFilterChange = (val: string) => {
    setProgramFilter(val);
    if (val && val !== "all") {
      setSearchParams({ program: val });
    } else {
      searchParams.delete("program");
      setSearchParams(searchParams);
    }
  };

  const programNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    programs.forEach((p) => {
      if (p.id) map.set(p.loyalty_program_name, p.id);
    });
    return map;
  }, [programs]);

  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    return customers.map((c) => ({
      value: c.customer_name,
      label: c.customer_name,
      sublabel: c.customer_group ? `${c.customer_group} · ${c.territory || ""}` : c.email || undefined,
    }));
  }, [customers]);

  const programOptions = useMemo<SearchableSelectOption[]>(() => {
    return programs.map((p) => ({
      value: p.loyalty_program_name,
      label: p.loyalty_program_name,
      sublabel: `${p.loyalty_program_type} · Expiry: ${p.expiry_duration || 0} hari`,
      badge: p.auto_opt_in ? "Auto Opt-in" : undefined,
    }));
  }, [programs]);

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      if (programFilter !== "all" && item.loyalty_program !== programFilter) {
        return false;
      }
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchesCustomer = item.customer?.toLowerCase().includes(q);
        const matchesId = item.id?.toLowerCase().includes(q);
        const matchesProgram = item.loyalty_program?.toLowerCase().includes(q);
        const matchesInvoice = item.sales_invoice?.toLowerCase().includes(q);
        if (!matchesCustomer && !matchesId && !matchesProgram && !matchesInvoice) {
          return false;
        }
      }
      return true;
    });
  }, [entries, programFilter, typeFilter, search]);

  const metrics = useMemo(() => {
    let earned = 0;
    let redeemed = 0;
    const activeCustomers = new Set<string>();

    entries.forEach((e) => {
      if (e.type === "Earned") {
        earned += Math.abs(e.loyalty_points || 0);
      } else if (e.type === "Redeemed") {
        redeemed += Math.abs(e.loyalty_points || 0);
      }
      if (e.customer) activeCustomers.add(e.customer);
    });

    return {
      earned,
      redeemed,
      balance: earned - redeemed,
      activeCustomerCount: activeCustomers.size,
    };
  }, [entries]);

  const handleOpenCreate = () => {
    setNewCustomer(customers[0]?.customer_name || "");
    setNewProgram(programs[0]?.loyalty_program_name || "");
    setNewType("Earned");
    setNewPoints("");
    setNewPurchaseAmount("");
    setNewReference("");
    setNewPostingDate(new Date().toISOString().slice(0, 10));
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer) {
      toast.error("Pilih customer terlebih dahulu");
      return;
    }
    if (!newProgram) {
      toast.error("Pilih Loyalty Program terlebih dahulu");
      return;
    }
    const pointsNum = parseFloat(newPoints);
    if (isNaN(pointsNum) || pointsNum === 0) {
      toast.error("Masukkan jumlah poin yang valid (tidak boleh 0)");
      return;
    }

    setSubmitting(true);
    try {
      const finalPoints = newType === "Redeemed" ? -Math.abs(pointsNum) : Math.abs(pointsNum);
      await loyaltyApi.createEntry({
        customer: newCustomer,
        loyalty_program: newProgram,
        type: newType,
        loyalty_points: finalPoints,
        purchase_amount: parseFloat(newPurchaseAmount) || 0,
        sales_invoice: newReference || undefined,
        reference_type: "Manual Entry",
        posting_date: newPostingDate,
      });

      toast.success("Point Entry berhasil disimpan");
      setCreateOpen(false);
      void loadData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuat Loyalty Point Entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm(`Hapus point entry ${id}?`)) return;
    try {
      await loyaltyApi.deleteEntry(id);
      toast.success("Point entry berhasil dihapus");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error("Gagal menghapus point entry");
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/desk/loyalty-program")}
            title="Kembali ke Loyalty Program"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">Selling</span>
              <span className="text-xs text-slate-400">/</span>
              <Link
                to="/desk/loyalty-program"
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
              >
                Loyalty Program
              </Link>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Point Entries
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Coins className="size-6 text-amber-500" />
              Loyalty Point Entries
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Riwayat transaksi perolehan, penukaran, dan kadaluarsa poin pelanggan yang terintegrasi langsung dengan Program Loyalty.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            className="flex items-center gap-1.5"
            title="Muat Ulang"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/desk/loyalty-program")}
            className="flex items-center gap-1.5"
          >
            <Gift className="size-4 text-blue-600" />
            Kelola Program
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            Tambah Point Entry
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Poin Diperoleh</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            +{metrics.earned.toLocaleString("id-ID")} <span className="text-xs font-normal">LP</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Total reward dari transaksi penjualan</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Poin Ditukarkan</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40">
              <TrendingDown className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            -{metrics.redeemed.toLocaleString("id-ID")} <span className="text-xs font-normal">LP</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Poin yang telah ditukar menjadi benefit</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Saldo Poin Beredar</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {metrics.balance.toLocaleString("id-ID")} <span className="text-xs font-normal">LP</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Net poin aktif milik seluruh pelanggan</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Program Loyalty Terdaftar</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {programs.length} <span className="text-xs font-normal text-slate-400">skema</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics.activeCustomerCount} pelanggan memiliki riwayat poin
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari customer, invoice, ID entry, atau program..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Program Filter */}
          <div className="flex items-center gap-1.5">
            <Gift className="size-4 text-slate-400 shrink-0" />
            <ERPSelect
              className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs shadow-sm focus:outline-none dark:border-slate-800 dark:text-slate-200 min-w-44"
              value={programFilter}
              onChange={(e) => handleProgramFilterChange(e.target.value)}
            >
              <ERPSelectOption value="all">Semua Program Loyalty</ERPSelectOption>
              {programs.map((p) => (
                <ERPSelectOption key={p.id || p.loyalty_program_name} value={p.loyalty_program_name}>
                  {p.loyalty_program_name}
                </ERPSelectOption>
              ))}
            </ERPSelect>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="size-4 text-slate-400 shrink-0" />
            <ERPSelect
              className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs shadow-sm focus:outline-none dark:border-slate-800 dark:text-slate-200"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <ERPSelectOption value="all">Semua Tipe</ERPSelectOption>
              <ERPSelectOption value="Earned">Earned (Perolehan)</ERPSelectOption>
              <ERPSelectOption value="Redeemed">Redeemed (Penukaran)</ERPSelectOption>
              <ERPSelectOption value="Expired">Expired (Kadaluarsa)</ERPSelectOption>
            </ERPSelect>
          </div>

          {(programFilter !== "all" || typeFilter !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProgramFilter("all");
                setTypeFilter("all");
                setSearch("");
                searchParams.delete("program");
                setSearchParams(searchParams);
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="p-4">Entry ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Loyalty Program</th>
                <th className="p-4">Referensi Transaksi</th>
                <th className="p-4 text-right">Purchase Amount</th>
                <th className="p-4 text-right">Loyalty Points</th>
                <th className="p-4 text-center">Posting Date</th>
                <th className="p-4 text-center">Tipe</th>
                <th className="w-16 p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw className="mx-auto size-5 animate-spin text-slate-400 mb-2" />
                    Memuat data riwayat poin...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <Coins className="mx-auto size-8 text-amber-400/60 mb-2" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Belum ada riwayat transaksi poin
                    </p>
                    <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                      Poin akan otomatis diperoleh saat transaksi penjualan diselesaikan oleh pelanggan yang memenuhi kriteria program loyalty, atau tambahkan point entry manual.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button size="sm" onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="size-4 mr-1.5" />
                        Tambah Point Entry
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/desk/loyalty-program")}
                      >
                        Buka Loyalty Program
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => {
                  const progId = programNameToIdMap.get(item.loyalty_program);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="p-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {item.id}
                      </td>
                      <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                        {item.customer}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {progId ? (
                          <Link
                            to={`/desk/loyalty-program/${progId}`}
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
                            title="Buka detail program loyalty ini"
                          >
                            <Gift className="size-3.5 text-blue-500 shrink-0" />
                            {item.loyalty_program}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                            <Gift className="size-3.5 text-slate-400 shrink-0" />
                            {item.loyalty_program}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-mono text-slate-800 dark:text-slate-200">
                          {item.sales_invoice || "-"}
                        </div>
                        {item.reference_type && (
                          <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {item.reference_type}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                        {item.purchase_amount > 0
                          ? `Rp ${item.purchase_amount.toLocaleString("id-ID")}`
                          : "-"}
                      </td>
                      <td
                        className={`p-4 text-right font-bold ${
                          item.loyalty_points > 0
                            ? "text-emerald-600"
                            : item.loyalty_points < 0
                            ? "text-amber-600"
                            : "text-slate-500"
                        }`}
                      >
                        {item.loyalty_points > 0
                          ? `+${item.loyalty_points.toLocaleString("id-ID")}`
                          : item.loyalty_points.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-normal">LP</span>
                      </td>
                      <td className="p-4 text-center text-xs text-slate-500">
                        <div>{item.posting_date}</div>
                        {item.expiry_date && (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            Exp: {item.expiry_date.slice(0, 10)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          variant={
                            item.type === "Earned"
                              ? "default"
                              : item.type === "Redeemed"
                              ? "secondary"
                              : "outline"
                          }
                          className={
                            item.type === "Earned"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : item.type === "Redeemed"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                              : ""
                          }
                        >
                          {item.type}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEntry(item.id)}
                          className="size-8 text-slate-400 hover:text-red-600"
                          title="Hapus point entry ini"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Point Entry */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="size-5 text-amber-500" />
                Tambah Loyalty Point Entry
              </DialogTitle>
              <DialogDescription>
                Buat entri poin manual untuk reward, penukaran (redeem), atau penyesuaian saldo poin pelanggan di bawah Program Loyalty yang dipilih.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={customerOptions}
                  value={newCustomer}
                  onChange={setNewCustomer}
                  placeholder="Pilih atau cari customer..."
                  searchPlaceholder="Ketik nama customer..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Loyalty Program <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={programOptions}
                  value={newProgram}
                  onChange={setNewProgram}
                  placeholder="Pilih Loyalty Program..."
                  searchPlaceholder="Cari program..."
                  addNewLabel="Buat Loyalty Program Baru"
                  addNewHref="/desk/loyalty-program/new"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipe Transaksi Poin</Label>
                  <ERPSelect
                    className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs shadow-sm focus:outline-none dark:border-slate-800"
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as "Earned" | "Redeemed" | "Expired")
                    }
                  >
                    <ERPSelectOption value="Earned">Earned (Perolehan / Penambahan)</ERPSelectOption>
                    <ERPSelectOption value="Redeemed">Redeemed (Penukaran / Pengurangan)</ERPSelectOption>
                    <ERPSelectOption value="Expired">Expired (Kadaluarsa)</ERPSelectOption>
                  </ERPSelect>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Jumlah Loyalty Points <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="Contoh: 100"
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nilai Belanja (Purchase Amount)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Contoh: 1000000"
                    value={newPurchaseAmount}
                    onChange={(e) => setNewPurchaseAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tanggal Posting</Label>
                  <Input
                    type="date"
                    required
                    value={newPostingDate}
                    onChange={(e) => setNewPostingDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Referensi Penjualan / Keterangan</Label>
                <Input
                  placeholder="Contoh: INV-2026-0012 atau Bonus Promo Ulang Tahun"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? "Menyimpan..." : "Simpan Point Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
