import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ScanBarcode,
  Search,
  ExternalLink,
  Scale,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  stockReconciliationApi,
  type StockReconciliation,
  type StockReconciliationItem,
  type StockReconciliationItemOption,
  type StockReconciliationOptions,
} from "../stockReconciliationApi";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { DocumentActionBar } from "@/components/doctype/document-action-bar";

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

const emptyItem = (): StockReconciliationItem => ({
  item_code: "",
  item_name: "",
  warehouse: "",
  quantity: 0,
  current_qty: 0,
  stock_uom: "Nos",
  valuation_rate: 0,
  amount: 0,
  barcode: "",
});

const emptyReconciliation = (): StockReconciliation => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return {
    naming_series: "MAT-RECO-.YYYY.-",
    purpose: "Stock Reconciliation",
    company_id: "",
    company: "",
    posting_date: now.toISOString().slice(0, 10),
    posting_time: timeStr,
    set_posting_time: false,
    set_warehouse: "",
    scan_barcode: "",
    scan_mode: false,
    expense_account: "5111 - Stock Adjustment - Expense",
    cost_center: "Main - MC",
    total_qty: 0,
    total_amount: 0,
    status: "Draft",
    remarks: "",
    items: [emptyItem()],
  };
};

export default function StockReconciliationFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-stock-reconciliation");

  const [row, setRow] = useState<StockReconciliation>(emptyReconciliation());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<StockReconciliationOptions>({
    naming_series: ["MAT-RECO-.YYYY.-"],
    purposes: ["Stock Reconciliation", "Opening Stock"],
    companies: [],
    warehouses: [],
    items: [],
    expense_accounts: [],
    cost_centers: [],
  });

  // Load options
  useEffect(() => {
    stockReconciliationApi
      .options()
      .then((res) => {
        setOptions(res);
        if (isNew && res.companies.length > 0 && !row.company) {
          setRow((prev) => ({
            ...prev,
            company: res.companies[0],
            set_warehouse: res.warehouses.length > 0 ? res.warehouses[0] : "",
            expense_account: res.expense_accounts[0] || prev.expense_account,
            cost_center: res.cost_centers[0] || prev.cost_center,
          }));
        }
      })
      .catch(() => toast.error("Gagal memuat opsi form Stock Reconciliation"));
  }, [isNew]);

  // Load existing doc
  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      stockReconciliationApi
        .get(id)
        .then((data) => {
          if (data) {
            setRow({
              ...data,
              posting_date: data.posting_date ? data.posting_date.slice(0, 10) : "",
              items: data.items && data.items.length > 0 ? data.items : [emptyItem()],
            });
          }
        })
        .catch(() => {
          toast.error("Gagal memuat dokumen Stock Reconciliation");
          navigate("/desk/stock-reconciliation");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const recalculate = (items: StockReconciliationItem[]) => {
    let totalQty = 0;
    let totalAmount = 0;
    const updated = items.map((it, idx) => {
      const amount = (it.quantity || 0) * (it.valuation_rate || 0);
      totalQty += it.quantity || 0;
      totalAmount += amount;
      return {
        ...it,
        idx: idx + 1,
        amount,
      };
    });
    return { items: updated, totalQty, totalAmount };
  };

  // Helper to fetch balance for an item + warehouse
  const fetchBalanceForItem = async (itemCode: string, warehouse: string) => {
    if (!itemCode || !warehouse) return 0;
    try {
      const qty = await stockReconciliationApi.getBalance(itemCode, warehouse);
      return typeof qty === "number" ? qty : 0;
    } catch {
      return 0;
    }
  };

  const updateItem = async (index: number, patch: Partial<StockReconciliationItem>) => {
    const prevItem = row.items[index];
    const newItem = { ...prevItem, ...patch };

    // If item_code or warehouse changed and not in scan_mode, auto-fetch existing qty
    const targetItemCode = patch.item_code !== undefined ? patch.item_code : prevItem.item_code;
    const targetWarehouse = patch.warehouse !== undefined ? patch.warehouse : (prevItem.warehouse || row.set_warehouse || "");

    if (
      !row.scan_mode &&
      (patch.item_code !== undefined || patch.warehouse !== undefined) &&
      targetItemCode &&
      targetWarehouse
    ) {
      const existingQty = await fetchBalanceForItem(targetItemCode, targetWarehouse);
      newItem.current_qty = existingQty;
      // if quantity not explicitly changed by this patch, default quantity to existing balance
      if (patch.quantity === undefined) {
        newItem.quantity = existingQty;
      }
    }

    setRow((prev) => {
      const newItems = prev.items.map((it, idx) => (idx === index ? newItem : it));
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return { ...prev, items, total_qty: totalQty, total_amount: totalAmount };
    });
  };

  const handleItemSelect = async (index: number, itemCode: string) => {
    const opt = options.items.find((x) => x.item_code === itemCode) || {
      item_code: itemCode,
      item_name: itemCode,
      stock_uom: "Nos",
      valuation_rate: 0,
      barcode: "",
    };
    const warehouse = row.items[index].warehouse || row.set_warehouse || (options.warehouses[0] || "");
    let existingQty = 0;
    if (!row.scan_mode && warehouse) {
      existingQty = await fetchBalanceForItem(opt.item_code, warehouse);
    }

    setRow((prev) => {
      const updatedItem: StockReconciliationItem = {
        ...prev.items[index],
        item_code: opt.item_code,
        item_name: opt.item_name,
        warehouse,
        stock_uom: opt.stock_uom || "Nos",
        valuation_rate: opt.valuation_rate || 0,
        barcode: opt.barcode || "",
        current_qty: existingQty,
        quantity: row.scan_mode ? (prev.items[index].quantity || 0) : existingQty,
      };

      const newItems = prev.items.map((it, idx) => (idx === index ? updatedItem : it));
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return { ...prev, items, total_qty: totalQty, total_amount: totalAmount };
    });
  };

  const handleWarehouseChange = async (index: number, warehouse: string) => {
    const itemCode = row.items[index].item_code;
    let existingQty = 0;
    if (!row.scan_mode && itemCode && warehouse) {
      existingQty = await fetchBalanceForItem(itemCode, warehouse);
    }

    setRow((prev) => {
      const updatedItem: StockReconciliationItem = {
        ...prev.items[index],
        warehouse,
        current_qty: existingQty,
        quantity: row.scan_mode ? (prev.items[index].quantity || 0) : existingQty,
      };
      const newItems = prev.items.map((it, idx) => (idx === index ? updatedItem : it));
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return { ...prev, items, total_qty: totalQty, total_amount: totalAmount };
    });
  };

  const handleDefaultWarehouseChange = async (warehouse: string) => {
    setRow((prev) => ({ ...prev, set_warehouse: warehouse }));
    // Update items that do not have warehouse or match previous
    const updatedItems = await Promise.all(
      row.items.map(async (it) => {
        const wh = it.warehouse || warehouse;
        let existingQty = it.current_qty || 0;
        if (!row.scan_mode && it.item_code && warehouse && !it.warehouse) {
          existingQty = await fetchBalanceForItem(it.item_code, warehouse);
        }
        return {
          ...it,
          warehouse: wh,
          current_qty: existingQty,
          quantity: !row.scan_mode && !it.warehouse ? existingQty : it.quantity,
        };
      })
    );
    const { items, totalQty, totalAmount } = recalculate(updatedItems);
    setRow((prev) => ({ ...prev, set_warehouse: warehouse, items, total_qty: totalQty, total_amount: totalAmount }));
  };

  const addItemRow = () => {
    setRow((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...emptyItem(),
          warehouse: prev.set_warehouse || (options.warehouses[0] || ""),
        },
      ],
    }));
  };

  const removeItemRow = (index: number) => {
    if (row.items.length <= 1) {
      setRow((prev) => ({
        ...prev,
        items: [{ ...emptyItem(), warehouse: prev.set_warehouse || "" }],
        total_qty: 0,
        total_amount: 0,
      }));
      return;
    }
    setRow((prev) => {
      const newItems = prev.items.filter((_, idx) => idx !== index);
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return { ...prev, items, total_qty: totalQty, total_amount: totalAmount };
    });
  };

  const handleBarcodeSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && row.scan_barcode?.trim()) {
      e.preventDefault();
      const code = row.scan_barcode.trim();
      const found = options.items.find(
        (x) => x.barcode === code || x.item_code.toLowerCase() === code.toLowerCase()
      );

      if (!found) {
        toast.error(`Item dengan barcode atau kode '${code}' tidak ditemukan`);
        return;
      }

      const warehouse = row.set_warehouse || options.warehouses[0] || "";
      const existingIdx = row.items.findIndex(
        (it) => it.item_code === found.item_code && it.warehouse === warehouse
      );

      let existingQty = 0;
      if (!row.scan_mode && warehouse) {
        existingQty = await fetchBalanceForItem(found.item_code, warehouse);
      }

      setRow((prev) => {
        let newItems: StockReconciliationItem[];
        if (existingIdx >= 0) {
          newItems = prev.items.map((it, idx) =>
            idx === existingIdx ? { ...it, quantity: it.quantity + 1 } : it
          );
          toast.success(`Menambahkan kuantitas untuk ${found.item_name}`);
        } else {
          const newItemData: StockReconciliationItem = {
            ...emptyItem(),
            item_code: found.item_code,
            item_name: found.item_name,
            warehouse,
            stock_uom: found.stock_uom || "Nos",
            valuation_rate: found.valuation_rate || 0,
            barcode: found.barcode,
            current_qty: existingQty,
            quantity: row.scan_mode ? 1 : existingQty,
          };

          if (prev.items.length === 1 && !prev.items[0].item_code) {
            newItems = [newItemData];
          } else {
            newItems = [...prev.items, newItemData];
          }
          toast.success(`Menambahkan item ${found.item_name}`);
        }
        const { items, totalQty, totalAmount } = recalculate(newItems);
        return {
          ...prev,
          scan_barcode: "",
          items,
          total_qty: totalQty,
          total_amount: totalAmount,
        };
      });
    }
  };

  const handleSave = async () => {
    if (!row.company) {
      toast.error("Company wajib diisi");
      return;
    }
    if (!row.items || row.items.length === 0 || !row.items[0].item_code) {
      toast.error("Wajib memiliki minimal satu item");
      return;
    }

    for (const itm of row.items) {
      if (itm.item_code && !itm.warehouse && !row.set_warehouse) {
        toast.error(`Warehouse wajib diisi untuk item ${itm.item_code}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: StockReconciliation = {
        ...row,
        items: row.items.map((it) => ({
          ...it,
          warehouse: it.warehouse || row.set_warehouse || "",
        })),
      };

      if (isNew) {
        const created = await stockReconciliationApi.create(payload);
        toast.success("Stock Reconciliation berhasil disimpan sebagai Draft");
        navigate(`/desk/stock-reconciliation/${created.id}`);
      } else {
        const updated = await stockReconciliationApi.update(id!, payload);
        toast.success("Stock Reconciliation berhasil diperbarui");
        setRow(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Stock Reconciliation");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDoc = async () => {
    if (!confirm("Apakah Anda yakin ingin Submit Stock Reconciliation ini? Saldo stok di Stock Ledger akan disesuaikan.")) return;
    setSaving(true);
    try {
      const res = await stockReconciliationApi.submit(id!);
      toast.success("Stock Reconciliation berhasil di-Submit dan pergerakan stok telah dicatat");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal submit Stock Reconciliation");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDoc = async () => {
    if (!confirm("Apakah Anda yakin ingin Membatalkan Stock Reconciliation ini? Penyesuaian stok akan dibalik.")) return;
    setSaving(true);
    try {
      const res = await stockReconciliationApi.cancel(id!);
      toast.success("Stock Reconciliation berhasil dibatalkan");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal membatalkan Stock Reconciliation");
    } finally {
      setSaving(false);
    }
  };

  const isReadonly = row.status === "Submitted" || row.status === "Cancelled";

  const companySelectOptions: SearchableSelectOption[] = useMemo(() => {
    return options.companies.map((c) => ({ value: c, label: c }));
  }, [options.companies]);

  const itemSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return options.items.map((it) => ({
      value: it.item_code,
      label: `${it.item_code} - ${it.item_name}`,
      sublabel: [
        it.stock_uom ? `Unit: ${it.stock_uom}` : "",
        it.valuation_rate ? formatRp(it.valuation_rate) : "",
      ]
        .filter(Boolean)
        .join(" • "),
    }));
  }, [options.items]);

  const warehouseSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return options.warehouses.map((w) => ({ value: w, label: w }));
  }, [options.warehouses]);

  const expenseAccountSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return options.expense_accounts.map((acc) => ({ value: acc, label: acc }));
  }, [options.expense_accounts]);

  const costCenterSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return options.cost_centers.map((cc) => ({ value: cc, label: cc }));
  }, [options.cost_centers]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <Link to="/desk/stock-reconciliation" className="hover:text-blue-600">Stock Reconciliation</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Stock Reconciliation" : row.reconciliation_number || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Stock Reconciliation" : row.reconciliation_number || id}
            </h1>
            <Badge
              variant={
                row.status === "Submitted"
                  ? "default"
                  : row.status === "Cancelled"
                  ? "destructive"
                  : "secondary"
              }
              className="font-medium"
            >
              {isNew ? "Not Saved" : row.status}
            </Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/desk/stock-reconciliation">
              <ArrowLeft className="mr-1.5 size-4" /> Kembali
            </Link>
          </Button>

          {!isReadonly && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? "Menyimpan..." : isNew ? "Simpan Draft" : "Update Draft"}
            </Button>
          )}

          {!isNew && row.status === "Draft" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmitDoc}
              disabled={saving}
            >
              Submit
            </Button>
          )}

          {!isNew && row.status === "Submitted" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancelDoc}
              disabled={saving}
            >
              Cancel Dokumen
            </Button>
          )}
        </div>
      </header>

      {/* Main Form Box */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-6">
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Series</label>
              <Input
                value={row.naming_series}
                onChange={(e) => setRow({ ...row, naming_series: e.target.value })}
                disabled={isReadonly}
                className="mt-1"
              />
              <span className="text-[11px] text-slate-400">naming_series</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Company <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <SearchableSelect
                  value={row.company}
                  options={companySelectOptions}
                  onChange={(val) => setRow({ ...row, company: val })}
                  disabled={isReadonly}
                  placeholder="Begin typing for results."
                />
              </div>
              <span className="text-[11px] text-slate-400">company</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Purpose <span className="text-red-500">*</span>
              </label>
              <ERPSelect
                value={row.purpose}
                onChange={(val) => setRow({ ...row, purpose: val })}
                disabled={isReadonly}
                className="mt-1"
              >
                {options.purposes.map((p) => (
                  <ERPSelectOption key={p} value={p}>
                    {p}
                  </ERPSelectOption>
                ))}
              </ERPSelect>
              <span className="text-[11px] text-slate-400">purpose</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Posting Date</label>
              <Input
                type="date"
                value={row.posting_date}
                onChange={(e) => setRow({ ...row, posting_date: e.target.value })}
                disabled={isReadonly || !row.set_posting_time}
                className="mt-1"
              />
              <span className="text-[11px] text-slate-400">posting_date</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Posting Time</label>
              <Input
                type="time"
                step="1"
                value={row.posting_time}
                onChange={(e) => setRow({ ...row, posting_time: e.target.value })}
                disabled={isReadonly || !row.set_posting_time}
                className="mt-1"
              />
              <span className="text-[11px] text-slate-400">posting_time</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="set_posting_time"
                checked={row.set_posting_time}
                onChange={(e) => setRow({ ...row, set_posting_time: e.target.checked })}
                disabled={isReadonly}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="set_posting_time" className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Edit Posting Date and Time
              </label>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Warehouse & Scan Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Default Warehouse</label>
            <div className="mt-1">
              <SearchableSelect
                value={row.set_warehouse || ""}
                options={warehouseSelectOptions}
                onChange={(val) => handleDefaultWarehouseChange(val)}
                disabled={isReadonly}
                placeholder="Pilih default warehouse..."
              />
            </div>
            <span className="text-[11px] text-slate-400">set_warehouse</span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Scan Barcode</label>
              <div className="relative mt-1">
                <ScanBarcode className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <Input
                  placeholder="Scan barcode lalu tekan Enter..."
                  value={row.scan_barcode || ""}
                  onChange={(e) => setRow({ ...row, scan_barcode: e.target.value })}
                  onKeyDown={handleBarcodeSubmit}
                  disabled={isReadonly}
                  className="pl-9"
                />
              </div>
              <span className="text-[11px] text-slate-400">scan_barcode</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="scan_mode"
                checked={row.scan_mode}
                onChange={(e) => setRow({ ...row, scan_mode: e.target.checked })}
                disabled={isReadonly}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <label htmlFor="scan_mode" className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Scan Mode
                </label>
                <p className="text-[11px] text-slate-400">Disables auto-fetching of existing quantity</p>
                <span className="text-[11px] text-slate-400">scan_mode</span>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Items</h2>
            {!isReadonly && (
              <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                <Plus className="mr-1.5 size-3.5" /> Tambah Baris
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-semibold text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">No.</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Item Code</th>
                  <th className="px-3 py-2.5 min-w-[180px]">Warehouse</th>
                  <th className="px-3 py-2.5 w-24 text-right">Quantity</th>
                  <th className="px-3 py-2.5 w-24">Unit</th>
                  <th className="px-3 py-2.5 w-32 text-right">Valuation Rate</th>
                  <th className="px-3 py-2.5 w-32 text-right">Amount</th>
                  {!isReadonly && <th className="px-2 py-2.5 w-10 text-center"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {row.items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="px-3 py-2 text-center font-medium text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      <SearchableSelect
                        value={item.item_code}
                        options={itemSelectOptions}
                        onChange={(val) => handleItemSelect(index, val)}
                        disabled={isReadonly}
                        placeholder="Pilih item..."
                        searchPlaceholder="Cari item..."
                        buttonClassName="h-9 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 min-w-[180px]">
                      <SearchableSelect
                        value={item.warehouse || row.set_warehouse || ""}
                        options={warehouseSelectOptions}
                        onChange={(wh) => handleWarehouseChange(index, wh)}
                        disabled={isReadonly}
                        placeholder="Pilih warehouse..."
                        searchPlaceholder="Cari warehouse..."
                        buttonClassName="h-9 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                        disabled={isReadonly}
                        className="h-8 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/desk/uom/${item.stock_uom || "Nos"}`}
                        target="_blank"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {item.stock_uom || "Nos"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="any"
                        value={item.valuation_rate}
                        onChange={(e) => updateItem(index, { valuation_rate: parseFloat(e.target.value) || 0 })}
                        disabled={isReadonly}
                        className="h-8 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                      {formatRp(item.amount || 0)}
                    </td>
                    {!isReadonly && (
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-6 pt-2 text-sm font-semibold">
            <div>
              <span className="text-slate-500 font-normal mr-2">Total Quantity:</span>
              <span>{row.total_qty || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 font-normal mr-2">Total Nilai:</span>
              <span className="text-blue-600 dark:text-blue-400">{formatRp(row.total_amount || 0)}</span>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Difference Account & Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Difference Account</label>
            <div className="mt-1">
              <SearchableSelect
                value={row.expense_account || ""}
                options={expenseAccountSelectOptions}
                onChange={(val) => setRow({ ...row, expense_account: val })}
                disabled={isReadonly}
                placeholder="Begin typing for results."
              />
            </div>
            <span className="text-[11px] text-slate-400">expense_account</span>
          </div>

          <div>
            <div className="mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Accounting Dimensions</h3>
            </div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cost Center</label>
            <div className="mt-1">
              <SearchableSelect
                value={row.cost_center || ""}
                options={costCenterSelectOptions}
                onChange={(val) => setRow({ ...row, cost_center: val })}
                disabled={isReadonly}
                placeholder="Begin typing for results."
              />
            </div>
            <span className="text-[11px] text-slate-400">cost_center</span>
          </div>
        </div>
      </div>
    </div>
  );
}
