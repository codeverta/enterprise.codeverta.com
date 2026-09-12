import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  ScanBarcode,
  RotateCcw,
  Search,
  ChevronDown,
  ExternalLink,
  Layers,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ERPSelectOption } from "@/components/ui/erp-select";
import {
  purchaseReceiptApi,
  type PurchaseReceipt,
  type PurchaseReceiptItem,
  type PurchaseReceiptTax,
  type PurchaseReceiptSuppliedItem,
  type PurchaseReceiptItemOption,
  type PurchaseReceiptOptions,
} from "../purchaseReceiptApi";
import { toast } from "sonner";

type Tab = "details" | "address" | "terms" | "more";

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

const emptyItem = (): PurchaseReceiptItem => ({
  item_code: "",
  item_name: "",
  accepted_quantity: 1,
  rejected_quantity: 0,
  uom: "Nos",
  rate: 0,
  amount: 0,
  accepted_warehouse: "",
  rejected_warehouse: "",
  barcode: "",
  batch_no: "",
});

const emptyReceipt = (): PurchaseReceipt => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return {
    naming_series: "MAT-PRE-.YYYY.-",
    status: "Draft",
    supplier: "",
    supplier_delivery_note: "",
    posting_date: now.toISOString().slice(0, 10),
    posting_time: timeStr,
    set_posting_time: false,
    company: "",
    apply_putaway_rule: false,
    is_return: false,
    cost_center: "",
    project: "",
    currency: "IDR",
    buying_price_list: "Standard Buying",
    ignore_pricing_rule: false,
    scan_barcode: "",
    set_warehouse: "",
    rejected_warehouse: "",
    is_subcontracted: false,
    tax_category: "In State",
    taxes_and_charges: "PPN 11%",
    shipping_rule: "Standard Delivery",
    incoterm: "EXW",
    total_qty: 0,
    total: 0,
    base_taxes_and_charges_added: 0,
    base_taxes_and_charges_deducted: 0,
    base_total_taxes_and_charges: 0,
    taxes_and_charges_added: 0,
    taxes_and_charges_deducted: 0,
    total_taxes_and_charges: 0,
    grand_total: 0,
    disable_rounded_total: false,
    rounding_adjustment: 0,
    rounded_total: 0,
    apply_discount_on: "grand_total",
    additional_discount_percentage: 0,
    discount_amount: 0,
    remarks: "",
    items: [emptyItem()],
    taxes: [],
    supplied_items: [],
  };
};

import { SearchableWarehouseSelect } from "@/components/ui/searchable-select";

/**
 * Searchable Dropdown for Items with "+ Tambah Item" button
 */
function SearchableItemSelect({
  value,
  itemOptions,
  onChange,
  disabled,
  placeholder = "Pilih item...",
}: {
  value: string;
  itemOptions: PurchaseReceiptItemOption[];
  onChange: (item: PurchaseReceiptItemOption) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedItem = itemOptions.find((x) => x.item_code === value);

  const filtered = itemOptions.filter((it) => {
    const q = search.toLowerCase();
    return (
      it.item_code.toLowerCase().includes(q) ||
      it.item_name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            setSearch("");
          }
        }}
        className={`flex h-8 w-full items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-left text-xs font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
          open ? "ring-1 ring-blue-500 border-blue-500" : ""
        }`}
      >
        <div className="truncate">
          {value ? (
            <span>
              <span className="font-semibold">{value}</span>
              {selectedItem?.item_name && (
                <span className="ml-1 text-slate-500 truncate">- {selectedItem.item_name}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="ml-1.5 size-3 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-[320px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik kode, nama, atau barcode item..."
              className="w-full bg-transparent pl-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">Tidak ada item ditemukan</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.item_code}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col rounded px-2.5 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    value === opt.item_code ? "bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-xs">
                    <span>{opt.item_code}</span>
                    <span className="text-[11px] font-normal text-slate-500">{opt.uom || "Nos"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[180px]">{opt.item_name}</span>
                    {opt.basic_rate > 0 && <span>{formatRp(opt.basic_rate)}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
            <a
              href="/desk/item/new"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <Plus className="size-3.5" />
              <span>+ Tambah Item Baru</span>
              <ExternalLink className="ml-auto size-3 opacity-60" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseReceiptFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-purchase-receipt");

  const [tab, setTab] = useState<Tab>("details");
  const [row, setRow] = useState<PurchaseReceipt>(emptyReceipt());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<PurchaseReceiptOptions>({
    naming_series: ["MAT-PRE-.YYYY.-", "MAT-PR-RET-.YYYY.-"],
    companies: [],
    suppliers: ["PT Mitra Logam Abadi", "PT Elektronika Komponen Indonesia"],
    warehouses: [
      "",
      "",
      "",
      "",
    ],
    currencies: ["IDR", "USD", "SGD", "EUR"],
    price_lists: ["Standard Buying", "Local Supplier Rate"],
    tax_categories: ["In State", "Out of State", "Import"],
    taxes_templates: ["PPN 11%", "PPN 12%", "Exempt Tax"],
    shipping_rules: ["Standard Delivery", "Express Delivery", "Vendor Trucking"],
    incoterms: ["EXW", "FOB", "CIF", "DDP", "CFR"],
    items: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const opts = await purchaseReceiptApi.options();
      if (opts) {
        setOptions(opts);
      }

      if (!isNew && id) {
        const data = await purchaseReceiptApi.get(id);
        if (data) {
          if (data.posting_date) {
            data.posting_date = data.posting_date.slice(0, 10);
          }
          if (!data.items || data.items.length === 0) {
            data.items = [emptyItem()];
          }
          if (!data.taxes) data.taxes = [];
          if (!data.supplied_items) data.supplied_items = [];
          setRow(data);
        }
      } else {
        if (opts.warehouses?.length > 0) {
          setRow((prev) => ({
            ...prev,
            set_warehouse: opts.warehouses[0],
            items: prev.items.map((it) => ({
              ...it,
              accepted_warehouse: opts.warehouses[0],
            })),
          }));
        }
      }
    } catch {
      toast.error("Gagal memuat data formulir Purchase Receipt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, isNew]);

  const recalculate = (
    items: PurchaseReceiptItem[],
    taxes: PurchaseReceiptTax[],
    applyDiscountOn: string,
    discountPct: number,
    discountAmt: number,
    disableRounding: boolean
  ) => {
    let totalQty = 0;
    let subtotal = 0;

    const updatedItems = items.map((it, idx) => {
      const amount = (it.accepted_quantity || 0) * (it.rate || 0);
      totalQty += (it.accepted_quantity || 0) + (it.rejected_quantity || 0);
      subtotal += amount;
      return {
        ...it,
        idx: idx + 1,
        amount,
      };
    });

    let taxTotalAdded = 0;
    let taxTotalDeducted = 0;
    const updatedTaxes = taxes.map((t, idx) => {
      let amt = t.amount;
      if (t.tax_rate > 0) {
        amt = (subtotal * t.tax_rate) / 100.0;
      }
      if (t.type === "Deduction") {
        taxTotalDeducted += amt;
      } else {
        taxTotalAdded += amt;
      }
      return {
        ...t,
        idx: idx + 1,
        net_amount: subtotal,
        amount: amt,
        total: subtotal + amt,
      };
    });

    const netTax = taxTotalAdded - taxTotalDeducted;
    let grandTotal = subtotal + netTax;

    let computedDiscount = discountAmt;
    if (discountPct > 0) {
      computedDiscount = (grandTotal * discountPct) / 100.0;
    }
    grandTotal -= computedDiscount;
    if (grandTotal < 0) grandTotal = 0;

    let roundingAdj = 0;
    let roundedTotal = grandTotal;
    if (!disableRounding) {
      roundedTotal = Math.round(grandTotal);
      roundingAdj = roundedTotal - grandTotal;
    }

    return {
      items: updatedItems,
      taxes: updatedTaxes,
      total_qty: totalQty,
      total: subtotal,
      base_taxes_and_charges_added: taxTotalAdded,
      taxes_and_charges_added: taxTotalAdded,
      base_taxes_and_charges_deducted: taxTotalDeducted,
      taxes_and_charges_deducted: taxTotalDeducted,
      base_total_taxes_and_charges: netTax,
      total_taxes_and_charges: netTax,
      grand_total: grandTotal,
      rounding_adjustment: roundingAdj,
      rounded_total: roundedTotal,
      discount_amount: computedDiscount,
    };
  };

  const updateField = <K extends keyof PurchaseReceipt>(key: K, val: PurchaseReceipt[K]) => {
    setRow((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "set_warehouse" && typeof val === "string") {
        next.items = next.items.map((it) => ({
          ...it,
          accepted_warehouse: it.accepted_warehouse || val,
        }));
      }
      if (key === "rejected_warehouse" && typeof val === "string") {
        next.items = next.items.map((it) => ({
          ...it,
          rejected_warehouse: it.rejected_warehouse || val,
        }));
      }
      if (
        key === "apply_discount_on" ||
        key === "additional_discount_percentage" ||
        key === "discount_amount" ||
        key === "disable_rounded_total"
      ) {
        const calc = recalculate(
          next.items,
          next.taxes,
          next.apply_discount_on,
          next.additional_discount_percentage,
          next.discount_amount,
          next.disable_rounded_total
        );
        Object.assign(next, calc);
      }
      return next;
    });
  };

  const updateItem = (index: number, key: keyof PurchaseReceiptItem, val: any) => {
    setRow((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [key]: val };
      const calc = recalculate(
        newItems,
        prev.taxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  const handleSelectItem = (index: number, opt: PurchaseReceiptItemOption) => {
    setRow((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        item_code: opt.item_code,
        item_name: opt.item_name,
        uom: opt.uom || "Nos",
        rate: opt.basic_rate || 0,
        barcode: opt.barcode || "",
      };
      const calc = recalculate(
        newItems,
        prev.taxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  const addItemRow = () => {
    setRow((prev) => {
      const newItems = [
        ...prev.items,
        {
          ...emptyItem(),
          accepted_warehouse: prev.set_warehouse || "",
          rejected_warehouse: prev.rejected_warehouse || "",
        },
      ];
      const calc = recalculate(
        newItems,
        prev.taxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  const removeItemRow = (index: number) => {
    setRow((prev) => {
      if (prev.items.length <= 1) {
        toast.info("Minimal satu baris item diperlukan");
        return prev;
      }
      const newItems = prev.items.filter((_, i) => i !== index);
      const calc = recalculate(
        newItems,
        prev.taxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  // Tax Row Management
  const addTaxRow = () => {
    setRow((prev) => {
      const newTaxes: PurchaseReceiptTax[] = [
        ...prev.taxes,
        {
          type: "Actual",
          account_head: "Tax Expense - PZTS",
          tax_rate: 11,
          net_amount: prev.total,
          amount: (prev.total * 11) / 100,
          total: prev.total + (prev.total * 11) / 100,
        },
      ];
      const calc = recalculate(
        prev.items,
        newTaxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  const updateTax = (index: number, key: keyof PurchaseReceiptTax, val: any) => {
    setRow((prev) => {
      const newTaxes = [...prev.taxes];
      newTaxes[index] = { ...newTaxes[index], [key]: val };
      const calc = recalculate(
        prev.items,
        newTaxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  const removeTaxRow = (index: number) => {
    setRow((prev) => {
      const newTaxes = prev.taxes.filter((_, i) => i !== index);
      const calc = recalculate(
        prev.items,
        newTaxes,
        prev.apply_discount_on,
        prev.additional_discount_percentage,
        prev.discount_amount,
        prev.disable_rounded_total
      );
      return { ...prev, ...calc };
    });
  };

  // Barcode Scanner
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

      setRow((prev) => {
        const existingIdx = prev.items.findIndex((it) => it.item_code === found.item_code);
        let newItems: PurchaseReceiptItem[];
        if (existingIdx >= 0) {
          newItems = prev.items.map((it, idx) =>
            idx === existingIdx ? { ...it, accepted_quantity: it.accepted_quantity + 1 } : it
          );
          toast.success(`Menambahkan kuantitas untuk ${found.item_name}`);
        } else {
          if (prev.items.length === 1 && !prev.items[0].item_code) {
            newItems = [
              {
                ...emptyItem(),
                item_code: found.item_code,
                item_name: found.item_name,
                uom: found.uom,
                rate: found.basic_rate,
                barcode: found.barcode,
                accepted_warehouse: prev.set_warehouse || "",
                rejected_warehouse: prev.rejected_warehouse || "",
                accepted_quantity: 1,
              },
            ];
          } else {
            newItems = [
              ...prev.items,
              {
                ...emptyItem(),
                item_code: found.item_code,
                item_name: found.item_name,
                uom: found.uom,
                rate: found.basic_rate,
                barcode: found.barcode,
                accepted_warehouse: prev.set_warehouse || "",
                rejected_warehouse: prev.rejected_warehouse || "",
                accepted_quantity: 1,
              },
            ];
          }
          toast.success(`Menambahkan item ${found.item_name}`);
        }
        const calc = recalculate(
          newItems,
          prev.taxes,
          prev.apply_discount_on,
          prev.additional_discount_percentage,
          prev.discount_amount,
          prev.disable_rounded_total
        );
        return { ...prev, scan_barcode: "", ...calc };
      });
    }
  };

  const handleSave = async () => {
    if (!row.supplier) {
      toast.error("Supplier wajib diisi");
      return;
    }
    if (!row.company) {
      toast.error("Company wajib diisi");
      return;
    }
    if (!row.items || row.items.length === 0 || !row.items[0].item_code) {
      toast.error("Wajib memiliki minimal satu item");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await purchaseReceiptApi.create(row);
        toast.success("Purchase Receipt berhasil dibuat");
        navigate(`/desk/purchase-receipt/${created.id}`);
      } else {
        const updated = await purchaseReceiptApi.update(id!, row);
        toast.success("Purchase Receipt berhasil diperbarui");
        setRow(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Purchase Receipt");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Submit Purchase Receipt ini? Saldo stok gudang akan bertambah sesuai Accepted Quantity.")) return;
    setSaving(true);
    try {
      const res = await purchaseReceiptApi.submit(id!);
      toast.success("Purchase Receipt berhasil di-Submit dan pergerakan stok telah dicatat");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal submit Purchase Receipt");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Batalkan Purchase Receipt ini? Saldo stok gudang akan ditarik kembali.")) return;
    setSaving(true);
    try {
      const res = await purchaseReceiptApi.cancel(id!);
      toast.success("Purchase Receipt dibatalkan dan stok disesuaikan kembali");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal membatalkan Purchase Receipt");
    } finally {
      setSaving(false);
    }
  };

  const isReadonly = row.status === "Submitted" || row.status === "Cancelled";

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <Link to="/desk/purchase-receipt" className="hover:text-blue-600">Purchase Receipt</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Purchase Receipt" : row.number || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Purchase Receipt" : row.number || id}
            </h1>
            <Badge
              variant={
                row.status === "Submitted"
                  ? "default"
                  : row.status === "Cancelled"
                  ? "destructive"
                  : "secondary"
              }
            >
              {isNew ? "Not Saved" : row.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/purchase-receipt">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          {!isReadonly && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="mr-2 size-4" />
              {saving ? "Menyimpan..." : "Save"}
            </Button>
          )}

          {!isNew && row.status === "Draft" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmit}
              disabled={saving}
            >
              <CheckCircle2 className="mr-2 size-4" />
              Submit
            </Button>
          )}

          {!isNew && row.status === "Submitted" && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={saving}
            >
              <RotateCcw className="mr-2 size-4" />
              Cancel Receipt
            </Button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-6">
        <div className="border-b bg-white px-5 rounded-2xl shadow-sm dark:bg-slate-950">
          <TabsList className="bg-transparent h-12 gap-6 p-0">
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="address"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Address & Contact
            </TabsTrigger>
            <TabsTrigger
              value="terms"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Terms
            </TabsTrigger>
            <TabsTrigger
              value="more"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              More Info
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Details */}
        <TabsContent value="details" className="space-y-6">
          {/* Section 1: Header / Document Identity */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            {/* Left Col */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Series
                </label>
                <Input
                  list="pr-series-list"
                  value={row.naming_series}
                  disabled={isReadonly}
                  onChange={(e) => updateField("naming_series", e.target.value)}
                  className="mt-1"
                />
                <datalist id="pr-series-list">
                  {options.naming_series.map((s) => (
                    <ERPSelectOption key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <Input
                  list="pr-suppliers-list"
                  value={row.supplier}
                  disabled={isReadonly}
                  onChange={(e) => updateField("supplier", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-suppliers-list">
                  {options.suppliers.map((s) => (
                    <ERPSelectOption key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Supplier Delivery Note
                </label>
                <Input
                  value={row.supplier_delivery_note || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("supplier_delivery_note", e.target.value)}
                  placeholder="Nomor Surat Jalan dari Vendor / Supplier"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <CompanySelect
                  value={row.company}
                  disabled={isReadonly}
                  onChange={(company) => updateField("company", company)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Right Col */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="set_posting_time"
                  checked={row.set_posting_time}
                  disabled={isReadonly}
                  onChange={(e) => updateField("set_posting_time", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="set_posting_time" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Edit Posting Date and Time
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={row.posting_date}
                    disabled={isReadonly || !row.set_posting_time}
                    onChange={(e) => updateField("posting_date", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Posting Time
                  </label>
                  <Input
                    type="text"
                    value={row.posting_time}
                    disabled={isReadonly || !row.set_posting_time}
                    onChange={(e) => updateField("posting_time", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="apply_putaway_rule"
                    checked={row.apply_putaway_rule}
                    disabled={isReadonly}
                    onChange={(e) => updateField("apply_putaway_rule", e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apply_putaway_rule" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    Apply Putaway Rule
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_return"
                    checked={row.is_return}
                    disabled={isReadonly}
                    onChange={(e) => {
                      const val = e.target.checked;
                      updateField("is_return", val);
                      if (val) {
                        updateField("naming_series", "MAT-PR-RET-.YYYY.-");
                      } else {
                        updateField("naming_series", "MAT-PRE-.YYYY.-");
                      }
                    }}
                    className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="is_return" className="text-sm font-semibold text-amber-700 dark:text-amber-400 cursor-pointer">
                    Is Return (Pengembalian ke Supplier)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Accounting Dimensions & Currency / Price List */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            {/* Accounting Dimensions */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accounting Dimensions</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center
                </label>
                <Input
                  value={row.cost_center || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("cost_center", e.target.value)}
                  placeholder="Main - PZTS"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project
                </label>
                <Input
                  value={row.project || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("project", e.target.value)}
                  placeholder="Optional Project Code"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Currency and Price List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Currency and Price List</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency
                </label>
                <Input
                  list="pr-currencies-list"
                  value={row.currency}
                  disabled={isReadonly}
                  onChange={(e) => updateField("currency", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-currencies-list">
                  {options.currencies.map((c) => (
                    <ERPSelectOption key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Price List
                </label>
                <Input
                  list="pr-pricelists-list"
                  value={row.buying_price_list}
                  disabled={isReadonly}
                  onChange={(e) => updateField("buying_price_list", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-pricelists-list">
                  {options.price_lists.map((p) => (
                    <ERPSelectOption key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ignore_pricing_rule"
                  checked={row.ignore_pricing_rule}
                  disabled={isReadonly}
                  onChange={(e) => updateField("ignore_pricing_rule", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ignore_pricing_rule" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  Ignore Pricing Rule
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Default Warehouses & Barcode */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Default Warehouses</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Accepted Warehouse
                </label>
                <div className="mt-1">
                  <SearchableWarehouseSelect
                    value={row.set_warehouse || ""}
                    warehouses={options.warehouses}
                    disabled={isReadonly}
                    onChange={(val) => updateField("set_warehouse", val)}
                    placeholder="Pilih default accepted warehouse..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rejected Warehouse
                </label>
                <div className="mt-1">
                  <SearchableWarehouseSelect
                    value={row.rejected_warehouse || ""}
                    warehouses={options.warehouses}
                    disabled={isReadonly}
                    onChange={(val) => updateField("rejected_warehouse", val)}
                    placeholder="Pilih default rejected warehouse..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Subcontracting</h3>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_subcontracted"
                  checked={row.is_subcontracted}
                  disabled={isReadonly}
                  onChange={(e) => updateField("is_subcontracted", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_subcontracted" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  Is Subcontracted
                </label>
              </div>

              {!isReadonly && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 mt-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1.5">
                    <ScanBarcode className="size-4 text-blue-600" />
                    <span>Scan Barcode</span>
                  </div>
                  <Input
                    value={row.scan_barcode || ""}
                    onChange={(e) => updateField("scan_barcode", e.target.value)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="Scan barcode item atau ketik kode item lalu tekan Enter..."
                    className="bg-white dark:bg-slate-900 h-8 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Items Table */}
          <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Items</h3>
              {!isReadonly && (
                <div className="flex items-center gap-2">
                  <a
                    href="/desk/item/new"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <Plus className="size-3.5" /> Tambah Item Baru
                    <ExternalLink className="size-3 opacity-60" />
                  </a>
                  <Button size="sm" variant="outline" onClick={addItemRow}>
                    <Plus className="mr-1.5 size-4" /> Add Row
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-visible rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                  <tr>
                    <th className="py-3 pl-3 pr-2 w-10">No.</th>
                    <th className="px-2 py-3 min-w-[220px]">Item Code</th>
                    <th className="px-2 py-3 w-28 text-right">Accepted Quantity</th>
                    <th className="px-2 py-3 w-28 text-right">Rejected Quantity</th>
                    <th className="px-2 py-3 w-20">Unit</th>
                    <th className="px-2 py-3 w-32 text-right">Rate (IDR)</th>
                    <th className="px-2 py-3 w-32 text-right">Amount (IDR)</th>
                    <th className="px-2 py-3 min-w-[190px]">Accepted Warehouse</th>
                    {!isReadonly && <th className="py-3 pl-2 pr-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {row.items.map((item, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 pl-3 pr-2 text-center text-xs font-medium text-slate-500">
                          {idx + 1}
                        </td>

                        <td className="px-2 py-2">
                          <SearchableItemSelect
                            value={item.item_code}
                            itemOptions={options.items}
                            disabled={isReadonly}
                            onChange={(opt) => handleSelectItem(idx, opt)}
                            placeholder="Pilih item..."
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.accepted_quantity}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "accepted_quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right font-medium"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rejected_quantity}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "rejected_quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right text-rose-600"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            value={item.uom || "Nos"}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "uom", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right"
                          />
                        </td>

                        <td className="px-2 py-2 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {formatRp(item.amount || 0)}
                        </td>

                        <td className="px-2 py-2">
                          <SearchableWarehouseSelect
                            value={item.accepted_warehouse || ""}
                            warehouses={options.warehouses}
                            disabled={isReadonly}
                            onChange={(val) => updateItem(idx, "accepted_warehouse", val)}
                            placeholder="Accepted warehouse"
                          />
                        </td>

                        {!isReadonly && (
                          <td className="py-2 pl-2 pr-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-slate-400 hover:text-red-600"
                              onClick={() => removeItemRow(idx)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Qty & Total Amount */}
            <div className="flex flex-col items-end gap-1.5 pt-2 text-sm border-t">
              <div className="flex items-center gap-8">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {row.total_qty || 0}
                </span>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-slate-500">Total (IDR):</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatRp(row.total || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Taxes and Charges */}
          <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Taxes and Charges</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tax Category
                </label>
                <Input
                  list="pr-tax-cat-list"
                  value={row.tax_category || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("tax_category", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-tax-cat-list">
                  {options.tax_categories.map((tc) => (
                    <ERPSelectOption key={tc} value={tc} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Purchase Taxes and Charges Template
                </label>
                <Input
                  list="pr-tax-tpl-list"
                  value={row.taxes_and_charges || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("taxes_and_charges", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-tax-tpl-list">
                  {options.taxes_templates.map((tt) => (
                    <ERPSelectOption key={tt} value={tt} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shipping Rule
                </label>
                <Input
                  list="pr-shipping-rules-list"
                  value={row.shipping_rule || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("shipping_rule", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-shipping-rules-list">
                  {options.shipping_rules.map((sr) => (
                    <ERPSelectOption key={sr} value={sr} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Incoterm
                </label>
                <Input
                  list="pr-incoterms-list"
                  value={row.incoterm || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("incoterm", e.target.value)}
                  placeholder="Begin typing for results."
                  className="mt-1"
                />
                <datalist id="pr-incoterms-list">
                  {options.incoterms.map((ic) => (
                    <ERPSelectOption key={ic} value={ic} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Taxes Table */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Purchase Taxes and Charges
                </span>
                {!isReadonly && (
                  <Button size="sm" variant="outline" onClick={addTaxRow}>
                    <Plus className="mr-1.5 size-3.5" /> Add Row
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 pl-3 pr-2 w-10">No.</th>
                      <th className="px-2 py-2.5 w-32">Type</th>
                      <th className="px-2 py-2.5 min-w-[200px]">Account Head</th>
                      <th className="px-2 py-2.5 w-24 text-right">Tax Rate (%)</th>
                      <th className="px-2 py-2.5 w-32 text-right">Amount (IDR)</th>
                      <th className="px-2 py-2.5 w-32 text-right">Total (IDR)</th>
                      {!isReadonly && <th className="py-2.5 pl-2 pr-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {row.taxes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                          No rows
                        </td>
                      </tr>
                    ) : (
                      row.taxes.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-2 pl-3 pr-2 text-center text-xs font-medium text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={t.type}
                              disabled={isReadonly}
                              onChange={(e) => updateTax(idx, "type", e.target.value)}
                              className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                            >
                              <option value="Actual">Actual</option>
                              <option value="On Net Total">On Net Total</option>
                              <option value="Deduction">Deduction</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              value={t.account_head}
                              disabled={isReadonly}
                              onChange={(e) => updateTax(idx, "account_head", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={t.tax_rate}
                              disabled={isReadonly}
                              onChange={(e) => updateTax(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={t.amount}
                              disabled={isReadonly}
                              onChange={(e) => updateTax(idx, "amount", parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-2 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {formatRp(t.total || 0)}
                          </td>
                          {!isReadonly && (
                            <td className="py-2 pl-2 pr-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-slate-400 hover:text-red-600"
                                onClick={() => removeTaxRow(idx)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tax Summary Lines */}
              <div className="grid gap-3 pt-4 sm:grid-cols-2 text-xs">
                <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Taxes and Charges Added (IDR):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatRp(row.taxes_and_charges_added || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes and Charges Deducted (IDR):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatRp(row.taxes_and_charges_deducted || 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">Total Taxes and Charges (IDR):</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatRp(row.total_taxes_and_charges || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Additional Discount & Totals */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            {/* Additional Discount */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Additional Discount</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Apply Additional Discount On
                </label>
                <select
                  value={row.apply_discount_on}
                  disabled={isReadonly}
                  onChange={(e) => updateField("apply_discount_on", e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="grand_total">Grand Total</option>
                  <option value="net_total">Net Total</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Additional Discount Percentage
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={row.additional_discount_percentage}
                  disabled={isReadonly}
                  onChange={(e) => updateField("additional_discount_percentage", parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Additional Discount Amount (IDR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={row.discount_amount}
                  disabled={isReadonly || row.additional_discount_percentage > 0}
                  onChange={(e) => updateField("discount_amount", parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Totals (IDR) */}
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Totals (IDR)</h3>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Grand Total:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatRp(row.grand_total || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="disable_rounded_total"
                  checked={row.disable_rounded_total}
                  disabled={isReadonly}
                  onChange={(e) => updateField("disable_rounded_total", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="disable_rounded_total" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Disable Rounded Total
                </label>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Rounding Adjustment:</span>
                <span>{formatRp(row.rounding_adjustment || 0)}</span>
              </div>

              <div className="flex items-center justify-between border-t pt-2 text-base">
                <span className="font-bold text-slate-900 dark:text-slate-100">Rounded Total:</span>
                <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                  {formatRp(row.rounded_total || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 7: Raw Materials Consumed (Subcontracted Items) */}
          <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Raw Materials Consumed</h3>
            <p className="text-xs text-slate-500">
              Bahan mentah yang dikonsumsi jika transaksi penerimaan merupakan pekerjaan Subkontrak (*Subcontracted*).
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 pl-3 pr-2 w-10">No.</th>
                    <th className="px-2 py-2.5">Item Code</th>
                    <th className="px-2 py-2.5">Raw Material Item Code</th>
                    <th className="px-2 py-2.5 text-right">Available Qty For Consumption</th>
                    <th className="px-2 py-2.5 text-right">Qty to Be Consumed</th>
                    <th className="px-2 py-2.5 text-right">Current Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {row.supplied_items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-xs text-slate-400">
                        No rows
                      </td>
                    </tr>
                  ) : (
                    row.supplied_items.map((si, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pl-3 pr-2 text-center text-xs font-medium text-slate-500">{idx + 1}</td>
                        <td className="px-2 py-2 text-xs font-medium">{si.item_code}</td>
                        <td className="px-2 py-2 text-xs">{si.raw_material_item_code}</td>
                        <td className="px-2 py-2 text-xs text-right">{si.available_qty_for_consumption}</td>
                        <td className="px-2 py-2 text-xs text-right">{si.qty_to_be_consumed}</td>
                        <td className="px-2 py-2 text-xs text-right">{si.current_stock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Address & Contact */}
        <TabsContent value="address" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              Address & Contact Info
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Supplier Address
                </label>
                <textarea
                  rows={3}
                  disabled={isReadonly}
                  placeholder="Alamat penagihan / pengiriman supplier..."
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shipping Address
                </label>
                <textarea
                  rows={3}
                  disabled={isReadonly}
                  placeholder="Alamat gudang penerimaan..."
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Terms */}
        <TabsContent value="terms" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              Terms & Conditions
            </h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Terms and Conditions Details
              </label>
              <textarea
                rows={5}
                disabled={isReadonly}
                placeholder="Ketentuan pengembalian, garansi barang, syarat penerimaan barang vendor..."
                className="mt-1 w-full rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab: More Info */}
        <TabsContent value="more" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              More Info & Remarks
            </h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Remarks / Catatan Penerimaan
              </label>
              <textarea
                rows={4}
                value={row.remarks || ""}
                disabled={isReadonly}
                onChange={(e) => updateField("remarks", e.target.value)}
                placeholder="Catatan tambahan mengenai kondisi fisik kemasan atau barang saat diterima..."
                className="mt-1 w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
