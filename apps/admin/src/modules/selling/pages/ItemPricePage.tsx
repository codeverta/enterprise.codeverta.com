import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { currencyApi, type Currency } from "@/modules/accounting/currencyApi";
import {
  itemPriceApi,
  type ItemOption,
  type ItemPrice,
  type PriceList,
} from "../itemPriceApi";

const defaultUOMs = [
  "Nos",
  "Unit",
  "Pcs",
  "Box",
  "Kg",
  "Gram",
  "Meter",
  "Liter",
  "Set",
  "Roll",
  "Pack",
];

const defaultCurrencies = ["IDR", "USD", "EUR", "SGD", "MYR", "JPY"];

const emptyItemPrice: ItemPrice = {
  item_code: "",
  item_name: "",
  price_list: "",
  price_list_rate: 0,
  currency: "IDR",
  uom: "Nos",
  packing_unit: 1,
  batch_no: "",
  buying: false,
  selling: true,
  lead_time_days: 0,
  valid_from: "",
  valid_upto: "",
  note: "",
  reference: "",
  is_active: true,
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount?.toLocaleString("id-ID")}`;
  }
}

export default function ItemPricePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Route check
  const pathParts = location.pathname.split("/").filter(Boolean);
  // pathParts: ["desk", "item-price", ":id?"]
  const rawId = pathParts[2];
  const isForm = Boolean(rawId);
  const isNew = isForm && (rawId === "new" || rawId.startsWith("new-item-price"));

  // List States
  const [rows, setRows] = useState<ItemPrice[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [uoms, setUoms] = useState<{ id?: string; uom_name: string; symbol?: string; common_code?: string }[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriceList, setFilterPriceList] = useState("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "SELLING" | "BUYING">("ALL");
  const [loading, setLoading] = useState(false);

  // Form States
  const [formData, setFormData] = useState<ItemPrice>(emptyItemPrice);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);

  // Load Master data for Dropdowns
  const loadMasterData = useCallback(async () => {
    try {
      const [plData, itmData, uomData, curData] = await Promise.all([
        itemPriceApi.listPriceLists().catch(() => []),
        itemPriceApi.listItems().catch(() => []),
        itemPriceApi.listUOMs().catch(() => []),
        currencyApi.list({ enabled: true }).catch(() => []),
      ]);
      setPriceLists(plData || []);
      setItems(itmData || []);
      setUoms(uomData || []);
      setCurrencies(curData || []);

      if (plData && plData.length > 0) {
        setFormData((prev) => {
          if (!prev.price_list || prev.price_list === "Standard Selling" || prev.price_list === "Standar Selling") {
            const defaultPL =
              plData.find((p) => p.price_list_name === "Standar Selling") ||
              plData.find((p) => p.price_list_name === "Standard Selling") ||
              plData[0];
            if (defaultPL) {
              return {
                ...prev,
                price_list: defaultPL.price_list_name,
                currency: defaultPL.currency || prev.currency || "IDR",
                buying: defaultPL.buying,
                selling: defaultPL.selling,
              };
            }
          }
          return prev;
        });
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Load List
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await itemPriceApi.list({
        q: searchQuery,
        price_list: filterPriceList === "ALL" ? "" : filterPriceList,
      });
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal memuat daftar Item Price");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterPriceList]);

  useEffect(() => {
    if (!isForm) {
      const timer = setTimeout(loadList, 200);
      return () => clearTimeout(timer);
    }
  }, [isForm, loadList]);

  // Load Detail Form
  useEffect(() => {
    if (isForm) {
      if (!isNew && rawId) {
        setLoading(true);
        itemPriceApi
          .get(rawId)
          .then((res) => {
            setFormData(res);
            setItemQuery(res.item_code);
            setIsDirty(false);
          })
          .catch(() => {
            toast.error("Gagal mengambil data Item Price");
            navigate("/desk/item-price");
          })
          .finally(() => setLoading(false));
      } else {
        setFormData(emptyItemPrice);
        setItemQuery("");
        setIsDirty(false);
      }
    }
  }, [isForm, isNew, rawId, navigate]);

  // Form Field Updater
  const updateField = <K extends keyof ItemPrice>(key: K, value: ItemPrice[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Select Item from autocomplete
  const handleSelectItem = (item: ItemOption) => {
    setItemQuery(item.item_code);
    setShowItemSuggestions(false);
    setFormData((prev) => ({
      ...prev,
      item_code: item.item_code,
      item_name: item.item_name || prev.item_name,
      uom: item.stock_uom || prev.uom,
      price_list_rate: item.standard_rate || prev.price_list_rate,
    }));
    setIsDirty(true);
  };

  // Handle Price List Change to auto-sync type
  const handlePriceListChange = (plName: string) => {
    const matched = priceLists.find((pl) => pl.price_list_name === plName);
    updateField("price_list", plName);
    if (matched) {
      updateField("currency", matched.currency || "IDR");
      updateField("buying", matched.buying);
      updateField("selling", matched.selling);
    }
  };

  // Save Item Price
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_code.trim()) {
      return toast.error("Item Code wajib diisi");
    }
    if (!formData.price_list.trim()) {
      return toast.error("Price List wajib diisi");
    }

    setSaving(true);
    try {
      if (!isNew && rawId) {
        await itemPriceApi.update(rawId, formData);
        toast.success("Item Price berhasil diperbarui");
      } else {
        await itemPriceApi.create(formData);
        toast.success("Item Price berhasil dibuat");
      }
      setIsDirty(false);
      navigate("/desk/item-price");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Item Price");
    } finally {
      setSaving(false);
    }
  };

  // Delete Item Price
  const handleDelete = async (id: string, code?: string) => {
    if (!confirm(`Hapus Item Price untuk ${code || "item ini"}?`)) return;
    try {
      await itemPriceApi.remove(id);
      toast.success("Item Price terhapus");
      if (isForm) {
        navigate("/desk/item-price");
      } else {
        loadList();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Item Price");
    }
  };

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterType === "SELLING" && !r.selling) return false;
      if (filterType === "BUYING" && !r.buying) return false;
      return true;
    });
  }, [rows, filterType]);

  // Suggested Items
  const filteredItemSuggestions = useMemo(() => {
    if (!itemQuery.trim()) return items.slice(0, 10);
    const q = itemQuery.toLowerCase();
    return items
      .filter(
        (it) =>
          it.item_code.toLowerCase().includes(q) ||
          it.item_name.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [items, itemQuery]);

  // ==========================================
  // FORM VIEW
  // ==========================================
  if (isForm) {
    return (
      <div className="min-h-screen bg-slate-50/50 pb-20 dark:bg-slate-950">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            {/* Breadcrumbs & Title */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Link
                  to="/desk/selling"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Selling
                </Link>
                <ChevronRight className="size-3 text-slate-400" />
                <Link
                  to="/desk/item-price"
                  className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Item Price
                </Link>
                <ChevronRight className="size-3 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {isNew
                    ? "New Item Price"
                    : formData.item_code || rawId}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {isNew
                    ? "New Item Price"
                    : formData.item_name || formData.item_code || "Item Price"}
                </h1>
                {isNew || isDirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Not Saved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Saved
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/desk/item-price")}
                className="gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                <span>Batal</span>
              </Button>

              {!isNew && rawId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(rawId, formData.item_code)}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer dark:hover:bg-red-950"
                >
                  <Trash2 className="size-4" />
                  <span>Hapus</span>
                </Button>
              )}

              <Button
                type="submit"
                form="item-price-form"
                disabled={saving}
                size="sm"
                className="gap-1.5 bg-blue-600 font-semibold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
              >
                {saving && <RefreshCw className="size-3.5 animate-spin" />}
                <span>{saving ? "Menyimpan..." : "Save"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Form Body */}
        <main className="mx-auto mt-6 max-w-5xl px-6">
          <form
            id="item-price-form"
            onSubmit={handleSave}
            className="space-y-6"
          >
            {/* Section 1: Item & Unit */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Package className="size-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Item Details
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Item Code */}
                <div className="relative space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Item Code <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      required
                      placeholder="Begin typing for results..."
                      value={itemQuery}
                      onChange={(e) => {
                        setItemQuery(e.target.value);
                        updateField("item_code", e.target.value);
                        setShowItemSuggestions(true);
                      }}
                      onFocus={() => setShowItemSuggestions(true)}
                      className="rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      Search ⌘
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400">
                    item_code
                  </p>

                  {/* Autocomplete Dropdown */}
                  {showItemSuggestions && filteredItemSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                      {filteredItemSuggestions.map((it) => (
                        <div
                          key={it.item_code}
                          onClick={() => handleSelectItem(it)}
                          className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {it.item_code}
                            </p>
                            <p className="text-xs text-slate-500">
                              {it.item_name}
                            </p>
                          </div>
                          {it.standard_rate !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              {formatCurrency(it.standard_rate, "IDR")}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Item Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Item Name
                  </Label>
                  <Input
                    placeholder="Nama barang atau produk..."
                    value={formData.item_name || ""}
                    onChange={(e) => updateField("item_name", e.target.value)}
                    className="rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    item_name
                  </p>
                </div>

                {/* UOM */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      UOM
                    </Label>
                    <Link
                      to="/desk/uom"
                      target="_blank"
                      className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Master UOM ↗
                    </Link>
                  </div>
                  <SearchableSelect
                    value={formData.uom || "Nos"}
                    onChange={(val) => updateField("uom", val)}
                    options={
                      uoms.length > 0
                        ? uoms.map((u) => ({
                            value: u.uom_name,
                            label: `${u.uom_name}${u.symbol ? ` (${u.symbol})` : ""}`,
                            sublabel: u.common_code ? `Code: ${u.common_code}` : undefined,
                          }))
                        : defaultUOMs.map((u) => ({ value: u, label: u }))
                    }
                    onSearch={async (q) => {
                      try {
                        const data = await itemPriceApi.listUOMs(q);
                        return data.map((u) => ({
                          value: u.uom_name,
                          label: `${u.uom_name}${u.symbol ? ` (${u.symbol})` : ""}`,
                        }));
                      } catch {
                        return [];
                      }
                    }}
                    placeholder="Pilih UOM..."
                    searchPlaceholder="Cari UOM (Nos, Pcs, Box, Kg)..."
                    addNewLabel="Tambah UOM Baru"
                    addNewHref="/desk/uom"
                    buttonClassName="h-10 rounded-lg bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium"
                  />
                  <p className="text-[11px] font-mono text-slate-400">uom</p>
                </div>

                {/* Packing Unit */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Packing Unit
                  </Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    value={formData.packing_unit ?? 1}
                    onChange={(e) =>
                      updateField("packing_unit", Number(e.target.value) || 1)
                    }
                    className="rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quantity that must be bought or sold per UOM
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    packing_unit
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Price List & Rate */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Price List & Pricing
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Price List */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Price List <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    value={formData.price_list}
                    onChange={(val) => handlePriceListChange(val)}
                    options={priceLists.map((pl) => ({
                      value: pl.price_list_name,
                      label: pl.price_list_name,
                      sublabel: `${pl.currency} · ${pl.selling ? "Selling" : ""}${pl.buying ? (pl.selling ? " / Buying" : "Buying") : ""}`,
                      badge: pl.enabled ? "Aktif" : "Nonaktif",
                    }))}
                    placeholder="Pilih Price List..."
                    searchPlaceholder="Cari price list..."
                    addNewLabel="Tambah Price List Baru"
                    addNewHref="/desk/price-list"
                    buttonClassName="h-10 rounded-lg bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    price_list
                  </p>
                </div>

                {/* Batch No */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Batch No
                  </Label>
                  <Input
                    placeholder="Begin typing for results."
                    value={formData.batch_no || ""}
                    onChange={(e) => updateField("batch_no", e.target.value)}
                    className="rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    batch_no
                  </p>
                </div>

                {/* Buying & Selling Toggles */}
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <Checkbox
                      checked={formData.buying}
                      onCheckedChange={(c) => updateField("buying", Boolean(c))}
                    />
                    <div>
                      <span>Buying</span>
                      <p className="text-[10px] font-mono text-slate-400">
                        buying
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <Checkbox
                      checked={formData.selling}
                      onCheckedChange={(c) => updateField("selling", Boolean(c))}
                    />
                    <div>
                      <span>Selling</span>
                      <p className="text-[10px] font-mono text-slate-400">
                        selling
                      </p>
                    </div>
                  </label>
                </div>

                {/* Currency */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Currency
                  </Label>
                  <SearchableSelect
                    value={formData.currency || "IDR"}
                    onChange={(val) => updateField("currency", val)}
                    options={
                      currencies.length > 0
                        ? currencies.map((c) => ({
                            value: c.id,
                            label: `${c.id} - ${c.currency_name || c.id}`,
                            sublabel: c.symbol ? `Simbol: ${c.symbol}` : undefined,
                          }))
                        : defaultCurrencies.map((c) => ({ value: c, label: c }))
                    }
                    placeholder="Pilih Mata Uang..."
                    searchPlaceholder="Cari mata uang..."
                    buttonClassName="h-10 rounded-lg bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    currency
                  </p>
                </div>

                {/* Rate (price_list_rate) */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Rate <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      {formData.currency || "IDR"}
                    </span>
                    <Input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={formData.price_list_rate || ""}
                      onChange={(e) =>
                        updateField("price_list_rate", Number(e.target.value) || 0)
                      }
                      className="rounded-lg pl-14 text-base font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <p className="font-mono text-[11px] text-slate-400">
                      price_list_rate
                    </p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Preview: {formatCurrency(formData.price_list_rate || 0, formData.currency || "IDR")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Validity & Scheduling */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Clock className="size-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Validity & Lead Time
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {/* Valid From */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Valid From
                  </Label>
                  <Input
                    type="date"
                    value={formData.valid_from ? formData.valid_from.substring(0, 10) : ""}
                    onChange={(e) => updateField("valid_from", e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    valid_from
                  </p>
                </div>

                {/* Valid Up To */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Valid Up To
                  </Label>
                  <Input
                    type="date"
                    value={formData.valid_upto ? formData.valid_upto.substring(0, 10) : ""}
                    onChange={(e) => updateField("valid_upto", e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    valid_upto
                  </p>
                </div>

                {/* Lead Time in days */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Lead Time in days
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.lead_time_days || ""}
                    onChange={(e) =>
                      updateField("lead_time_days", Number(e.target.value) || 0)
                    }
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    lead_time_days
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4: Note & Reference */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <FileText className="size-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Note & Reference
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Note */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Note
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Catatan khusus penetapan harga..."
                    value={formData.note || ""}
                    onChange={(e) => updateField("note", e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">note</p>
                </div>

                {/* Reference */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reference
                  </Label>
                  <Input
                    placeholder="PO/Contract No, Promo code, dll..."
                    value={formData.reference || ""}
                    onChange={(e) => updateField("reference", e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    reference
                  </p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-2 pt-6">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <Checkbox
                      checked={formData.is_active}
                      onCheckedChange={(c) => updateField("is_active", Boolean(c))}
                    />
                    <span>Active / Enabled in POS & Sales Order</span>
                  </label>
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // ==========================================
  // LIST VIEW
  // ==========================================
  return (
    <ERPPage>
      {/* Header & Breadcrumb */}
      <ERPPageHeader title="Item Price" description="Daftar harga jual dan beli barang berdasarkan Price List, UOM, dan masa berlaku." breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "Item Price" }]} actions={<>
          <Button
            variant="outline"
            size="sm"
            onClick={loadList}
            disabled={loading}
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="gap-1.5 bg-blue-600 font-semibold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Link to="/desk/item-price/new">
              <Plus className="size-4" />
              <span>Add Item Price</span>
            </Link>
          </Button>
        </>}/>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500">Total Item Price</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-emerald-600">Selling Prices</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {rows.filter((r) => r.selling).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-blue-600">Buying Prices</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {rows.filter((r) => r.buying).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500">Active Lists</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {priceLists.length || 2}
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari Item Code atau Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Price List Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="size-3.5 text-slate-400" />
            <select
              value={filterPriceList}
              onChange={(e) => setFilterPriceList(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">Semua Price List</option>
              {priceLists.map((pl) => (
                <option key={pl.id || pl.price_list_name} value={pl.price_list_name}>
                  {pl.price_list_name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                filterType === "ALL"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType("SELLING")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                filterType === "SELLING"
                  ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Selling
            </button>
            <button
              type="button"
              onClick={() => setFilterType("BUYING")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                filterType === "BUYING"
                  ? "bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Buying
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Item Code & Name</th>
                <th className="px-6 py-4">Price List</th>
                <th className="px-6 py-4">Rate</th>
                <th className="px-6 py-4">UOM / Packing</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Validity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-600" />
                    <p>Memuat data Item Price...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Tag className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Tidak ada Item Price ditemukan
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Tambahkan item price baru untuk mengatur daftar harga.
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="mt-4 bg-blue-600 text-white cursor-pointer"
                    >
                      <Link to="/desk/item-price/new">
                        <Plus className="mr-1.5 size-4" />
                        Tambah Item Price
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* Item Code & Name */}
                    <td className="px-6 py-4">
                      <Link
                        to={`/desk/item-price/${row.id}`}
                        className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.item_code}
                      </Link>
                      {row.item_name && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {row.item_name}
                        </p>
                      )}
                      {row.batch_no && (
                        <span className="mt-1 inline-block text-[10px] font-mono text-slate-400">
                          Batch: {row.batch_no}
                        </span>
                      )}
                    </td>

                    {/* Price List */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {row.price_list}
                      </span>
                    </td>

                    {/* Rate */}
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(row.price_list_rate, row.currency)}
                    </td>

                    {/* UOM & Packing Unit */}
                    <td className="px-6 py-4 text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.uom || "Nos"}
                      </p>
                      {row.packing_unit && row.packing_unit > 1 && (
                        <p className="text-[11px] text-slate-400">
                          Pack: {row.packing_unit}
                        </p>
                      )}
                    </td>

                    {/* Type (Buying / Selling) */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {row.selling && (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Selling
                          </span>
                        )}
                        {row.buying && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300">
                            Buying
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Validity */}
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {row.valid_from || row.valid_upto ? (
                        <div>
                          <p>
                            From: {row.valid_from ? row.valid_from.substring(0, 10) : "Always"}
                          </p>
                          <p>
                            To: {row.valid_upto ? row.valid_upto.substring(0, 10) : "Forever"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Selalu Berlaku</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {row.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Disabled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer dark:hover:bg-blue-950"
                        >
                          <Link to={`/desk/item-price/${row.id}`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.id!, row.item_code)}
                          className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-950"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ERPPage>
  );
}
