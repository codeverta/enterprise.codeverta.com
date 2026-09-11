import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { stockLedgerApi, StockLedgerEntry, StockLedgerStats, StockLedgerOptions } from "../api";
import api from "@/lib/api";
import { SearchableSelect, SearchableOption } from "@/components/ui/searchable-select";
import { SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { toast } from "sonner";
import {
  Search,
  RotateCcw,
  Download,
  Printer,
  FileBarChart,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function StockLedgerPage() {
  const navigate = useNavigate();

  // Date defaults: 1 month ago to today
  const defaultToDate = new Date().toISOString().slice(0, 10);
  const defaultFromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({
    company: "",
    from_date: defaultFromDate,
    to_date: defaultToDate,
    warehouse: "",
    item_code: "",
    item_group: "",
    batch_no: "",
    brand: "",
    voucher_no: "",
    project: "",
    include_uom: true,
    currency: "IDR",
    segregate_serial_batch_bundle: false,
    table_search: "",
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [list, setList] = useState<StockLedgerEntry[]>([]);
  const [stats, setStats] = useState<StockLedgerStats>({
    total_entries: 0,
    total_in_qty: 0,
    total_out_qty: 0,
    net_balance: 0,
  });
  const [loading, setLoading] = useState(true);

  const [options, setOptions] = useState<StockLedgerOptions>({
    companies: [],
    warehouses: [],
    items: [],
    item_groups: [],
    brands: [],
    batches: [],
  });

  // Load options on mount
  useEffect(() => {
    stockLedgerApi
      .options()
      .then((res) => {
        if (res) {
          setOptions(res);
          if (res.companies?.length && !filters.company) {
            setFilters((prev) => ({ ...prev, company: res.companies[0] }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await stockLedgerApi.list({
        company: filters.company || undefined,
        from_date: filters.from_date || undefined,
        to_date: filters.to_date || undefined,
        warehouse: filters.warehouse || undefined,
        item_code: filters.item_code || undefined,
        item_group: filters.item_group || undefined,
        batch_no: filters.batch_no || undefined,
        brand: filters.brand || undefined,
        voucher_no: filters.voucher_no || undefined,
        project: filters.project || undefined,
      });
      setList(res.data || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      toast.error("Gagal memuat data Stock Ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters.company,
    filters.from_date,
    filters.to_date,
    filters.warehouse,
    filters.item_code,
    filters.item_group,
    filters.batch_no,
    filters.brand,
  ]);

  // Search items from DB with debounce
  const searchItemsFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/buying/items", {
        params: { q: query, limit: 30 },
      });
      const rows = res.data?.data || [];
      return rows.map((item) => ({
        value: item.item_code,
        label: `${item.item_code} - ${item.item_name || ""}`,
        sublabel: item.stock_uom ? `UOM: ${item.stock_uom}` : undefined,
      }));
    } catch {
      return (options.items || [])
        .filter(
          (it) =>
            it.item_code.toLowerCase().includes(query.toLowerCase()) ||
            it.item_name.toLowerCase().includes(query.toLowerCase())
        )
        .map((it) => ({
          value: it.item_code,
          label: `${it.item_code} - ${it.item_name}`,
          sublabel: it.stock_uom ? `UOM: ${it.stock_uom}` : undefined,
        }));
    }
  };

  // Search batches from DB
  const searchBatchesFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/stock/batches", {
        params: { q: query, limit: 30 },
      });
      const rows = res.data?.data || [];
      return rows.map((b) => ({
        value: b.batch_id,
        label: b.batch_id,
        sublabel: b.item_code ? `Item: ${b.item_code}` : undefined,
      }));
    } catch {
      return (options.batches || [])
        .filter((b) => b.toLowerCase().includes(query.toLowerCase()))
        .map((b) => ({ value: b, label: b }));
    }
  };

  // Client-side comparison filter support (>5, <10, =324, 5:10)
  const parseQtyFilter = (val: number, expr: string): boolean => {
    const clean = expr.trim();
    if (!clean) return true;
    if (clean.startsWith(">")) {
      const target = parseFloat(clean.slice(1));
      return !isNaN(target) && val > target;
    }
    if (clean.startsWith("<")) {
      const target = parseFloat(clean.slice(1));
      return !isNaN(target) && val < target;
    }
    if (clean.startsWith("=")) {
      const target = parseFloat(clean.slice(1));
      return !isNaN(target) && val === target;
    }
    if (clean.includes(":")) {
      const parts = clean.split(":");
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        return val >= min && val <= max;
      }
    }
    return true;
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    let result = list;
    const q = filters.table_search.trim().toLowerCase();
    if (q) {
      if (q.startsWith(">") || q.startsWith("<") || q.startsWith("=") || q.includes(":")) {
        result = result.filter(
          (row) =>
            parseQtyFilter(row.balance_qty, q) ||
            parseQtyFilter(row.in_qty, q) ||
            parseQtyFilter(row.out_qty, q)
        );
      } else {
        result = result.filter(
          (row) =>
            row.item_code.toLowerCase().includes(q) ||
            row.item_name.toLowerCase().includes(q) ||
            row.warehouse.toLowerCase().includes(q) ||
            row.voucher_number.toLowerCase().includes(q) ||
            row.voucher_type.toLowerCase().includes(q) ||
            row.batch_no.toLowerCase().includes(q) ||
            row.serial_no.toLowerCase().includes(q) ||
            row.item_group.toLowerCase().includes(q) ||
            row.brand.toLowerCase().includes(q) ||
            row.description.toLowerCase().includes(q)
        );
      }
    }
    return result;
  }, [list, filters.table_search]);

  // Total balance value sum
  const totalBalanceValue = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (r.balance_value || 0), 0);
  }, [filteredRows]);

  const money = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: filters.currency || "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const getVoucherLink = (type: string, id: string) => {
    switch (type) {
      case "Stock Entry":
        return `/desk/stock-entry/${id}`;
      case "Purchase Receipt":
        return `/desk/purchase-receipt/${id}`;
      case "Delivery Note":
        return `/desk/delivery-note/${id}`;
      default:
        return "#";
    }
  };

  const handleExportCSV = () => {
    if (!filteredRows.length) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const headers = [
      "No",
      "Date",
      "Item Code",
      "Item Name",
      "Stock UOM",
      "In Qty",
      "Out Qty",
      "Balance Qty",
      "Warehouse",
      "Item Group",
      "Brand",
      "Description",
      "Incoming Rate",
      "Valuation Rate",
      "Balance Value",
      "Voucher Type",
      "Voucher Number",
      "Batch No",
      "Serial No",
      "Company",
    ];
    const rows = filteredRows.map((r, i) => [
      i + 1,
      r.posting_date,
      `"${r.item_code}"`,
      `"${r.item_name}"`,
      `"${r.stock_uom}"`,
      r.in_qty,
      r.out_qty,
      r.balance_qty,
      `"${r.warehouse}"`,
      `"${r.item_group}"`,
      `"${r.brand}"`,
      `"${(r.description || "").replace(/"/g, '""')}"`,
      r.incoming_rate,
      r.valuation_rate,
      r.balance_value,
      `"${r.voucher_type}"`,
      `"${r.voucher_number}"`,
      `"${r.batch_no}"`,
      `"${r.serial_no}"`,
      `"${r.company}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Ledger_${filters.company}_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("File CSV berhasil diekspor");
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <span>Reports & Analytics</span>
            <span>/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">Stock Ledger</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Stock Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit trail historis buku besar stok untuk semua transaksi penerimaan, pengeluaran, transfer, dan saldo akhir inventaris.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} title="Export ke CSV">
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} title="Cetak Laporan">
            <Printer className="mr-1.5 size-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} title="Refresh Data">
            <RotateCcw className="mr-1.5 size-4" /> Refresh
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Transaksi</span>
            <FileBarChart className="size-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total_entries}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Total Masuk (In Qty)</span>
            <ArrowDownLeft className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{stats.total_in_qty.toLocaleString("id-ID")}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600">Total Keluar (Out Qty)</span>
            <ArrowUpRight className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{stats.total_out_qty.toLocaleString("id-ID")}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">Perubahan Bersih (Net Qty)</span>
            <TrendingUp className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.net_balance.toLocaleString("id-ID")}</p>
        </div>
      </div>

      {/* Filter Box (ERPNext Style) */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <SlidersHorizontal className="size-4 text-blue-600" />
            Filter Buku Besar Stok
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-500"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? <ChevronUp className="size-3.5 mr-1" /> : <ChevronDown className="size-3.5 mr-1" />}
            {showAdvancedFilters ? "Sembunyikan Filter Lanjutan" : "Filter Lanjutan"}
          </Button>
        </div>

        {/* Row 1 Primary Filters */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Company</label>
            <CompanySelect
              placeholder="Pilih Company..."
              value={filters.company}
              onChange={(val) => setFilters({ ...filters, company: val })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">From Date</label>
            <Input
              type="date"
              className="h-9"
              value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
            <Input
              type="date"
              className="h-9"
              value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Warehouses</label>
            <SearchableWarehouseSelect
              value={filters.warehouse}
              onChange={(val) => setFilters({ ...filters, warehouse: val })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Items</label>
            <SearchableSelect
              placeholder="Cari Item..."
              value={filters.item_code}
              onChange={(val) => setFilters({ ...filters, item_code: val })}
              onSearch={searchItemsFromDB}
              options={options.items.map((it) => ({
                value: it.item_code,
                label: `${it.item_code} - ${it.item_name}`,
                sublabel: it.stock_uom ? `UOM: ${it.stock_uom}` : undefined,
              }))}
            />
          </div>
        </div>

        {/* Row 2 Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 pt-2 border-t">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Item Group</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.item_group}
                onChange={(e) => setFilters({ ...filters, item_group: e.target.value })}
              >
                <option value="">Semua Item Group</option>
                {options.item_groups.map((ig) => (
                  <option key={ig} value={ig}>{ig}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Batch No</label>
              <SearchableSelect
                placeholder="Cari Batch No..."
                value={filters.batch_no}
                onChange={(val) => setFilters({ ...filters, batch_no: val })}
                onSearch={searchBatchesFromDB}
                options={options.batches.map((b) => ({ value: b, label: b }))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Brand</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.brand}
                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              >
                <option value="">Semua Brand</option>
                {options.brands.map((br) => (
                  <option key={br} value={br}>{br}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Voucher #</label>
              <Input
                placeholder="No Voucher..."
                className="h-9"
                value={filters.voucher_no}
                onChange={(e) => setFilters({ ...filters, voucher_no: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Project</label>
              <Input
                placeholder="Project..."
                className="h-9"
                value={filters.project}
                onChange={(e) => setFilters({ ...filters, project: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
            </div>
          </div>
        )}

        {/* Checkboxes & Helpers */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.include_uom}
                onChange={(e) => setFilters({ ...filters, include_uom: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Include UOM</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.segregate_serial_batch_bundle}
                onChange={(e) => setFilters({ ...filters, segregate_serial_batch_bundle: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Segregate Serial / Batch Bundle</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span>Currency:</span>
              <select
                className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                value={filters.currency}
                onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
              >
                <option value="IDR">IDR (Rp)</option>
                <option value="USD">USD ($)</option>
                <option value="SGD">SGD (S$)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            For comparison, use &gt;5, &lt;10 or =324. For ranges, use 5:10 (for values between 5 &amp; 10).
          </div>
        </div>
      </div>

      {/* Table Search & Total Summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Cari atau filter kuantitas (>5, <10, 5:10)..."
            className="pl-9 h-9 text-sm"
            value={filters.table_search}
            onChange={(e) => setFilters({ ...filters, table_search: e.target.value })}
          />
        </div>

        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-semibold text-slate-900 dark:text-slate-100">{filteredRows.length}</span> baris ledger
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b bg-slate-50 font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 min-w-[130px]">Date</th>
                <th className="p-3 min-w-[120px]">Item</th>
                <th className="p-3 min-w-[160px]">Item Name</th>
                {filters.include_uom && <th className="p-3 min-w-[80px]">Stock UOM</th>}
                <th className="p-3 text-right min-w-[80px]">In Qty</th>
                <th className="p-3 text-right min-w-[80px]">Out Qty</th>
                <th className="p-3 text-right min-w-[90px] font-semibold text-slate-900 dark:text-slate-100">Balance Qty</th>
                <th className="p-3 min-w-[140px]">Warehouse</th>
                <th className="p-3 min-w-[100px]">Item Group</th>
                <th className="p-3 min-w-[90px]">Brand</th>
                <th className="p-3 min-w-[180px]">Description</th>
                <th className="p-3 text-right min-w-[100px]">Incoming Rate</th>
                <th className="p-3 text-right min-w-[100px]">Valuation Rate</th>
                <th className="p-3 text-right min-w-[110px] font-semibold">Balance Value</th>
                <th className="p-3 min-w-[110px]">Voucher Type</th>
                <th className="p-3 min-w-[150px]">Voucher #</th>
                <th className="p-3 min-w-[110px]">Batch No</th>
                <th className="p-3 min-w-[110px]">Serial No</th>
                <th className="p-3 min-w-[140px]">Company</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={20} className="p-12 text-center text-slate-500">
                    Memuat data Stock Ledger...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={20} className="p-14 text-center text-slate-500">
                    <Boxes className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Tidak ada riwayat pergerakan stok</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Transaksi Stock Entry, Purchase Receipt, atau Delivery Note yang telah disubmit akan tercatat di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-900/60">
                    <td className="p-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {row.posting_date}
                    </td>
                    <td className="p-3 font-semibold text-blue-600">
                      <Link to={`/desk/item/${encodeURIComponent(row.item_code)}`} className="hover:underline">
                        {row.item_code}
                      </Link>
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={row.item_name}>
                      {row.item_name}
                    </td>
                    {filters.include_uom && (
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {row.stock_uom || "Nos"}
                      </td>
                    )}
                    <td className="p-3 text-right font-medium">
                      {row.in_qty > 0 ? (
                        <span className="text-emerald-600">+{row.in_qty.toLocaleString("id-ID")}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {row.out_qty > 0 ? (
                        <span className="text-rose-600">-{row.out_qty.toLocaleString("id-ID")}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {row.balance_qty.toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {row.warehouse}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {row.item_group || "-"}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {row.brand || "-"}
                    </td>
                    <td className="p-3 text-slate-500 max-w-[200px] truncate" title={row.description}>
                      {row.description || "-"}
                    </td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                      {money(row.incoming_rate)}
                    </td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                      {money(row.valuation_rate)}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {money(row.balance_value)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          row.voucher_type === "Purchase Receipt"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : row.voucher_type === "Delivery Note"
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }
                      >
                        {row.voucher_type}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono">
                      {row.voucher_id ? (
                        <Link
                          to={getVoucherLink(row.voucher_type, row.voucher_id)}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {row.voucher_number}
                          <ExternalLink className="size-3 text-slate-400" />
                        </Link>
                      ) : (
                        row.voucher_number
                      )}
                    </td>
                    <td className="p-3">
                      {row.batch_no ? (
                        <Link to={`/desk/batch-no?q=${encodeURIComponent(row.batch_no)}`} className="text-blue-600 hover:underline">
                          {row.batch_no}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="p-3">
                      {row.serial_no ? (
                        <Link to={`/desk/serial-no?q=${encodeURIComponent(row.serial_no)}`} className="text-blue-600 hover:underline">
                          {row.serial_no}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {row.company || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="border-t bg-slate-50/80 font-bold text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                <tr>
                  <td colSpan={filters.include_uom ? 5 : 4} className="p-3 text-right">
                    Total
                  </td>
                  <td className="p-3 text-right text-emerald-600">
                    +{stats.total_in_qty.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right text-rose-600">
                    -{stats.total_out_qty.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right text-blue-600">
                    {stats.net_balance.toLocaleString("id-ID")}
                  </td>
                  <td colSpan={6}></td>
                  <td colSpan={3} className="p-3 text-right">
                    {money(totalBalanceValue)}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
