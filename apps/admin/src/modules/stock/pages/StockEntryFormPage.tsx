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
  stockEntryApi,
  type StockEntry,
  type StockEntryItem,
  type StockEntryItemOption,
  type StockEntryOptions,
} from "../stockEntryApi";
import {
  stockEntryTypeApi,
  type StockEntryType,
} from "../api";
import {
  warehouseApi,
  type CompanyOption,
} from "../warehouseApi";
import {
  SearchableSelect,
  SearchableWarehouseSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { toast } from "sonner";

type Tab = "details" | "dimensions" | "other";

const formatRp = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

const emptyItem = (): StockEntryItem => ({
  item_code: "",
  item_name: "",
  description: "",
  source_warehouse: "",
  target_warehouse: "",
  qty: 1,
  transfer_qty: 1,
  uom: "Nos",
  conversion_factor: 1,
  basic_rate: 0,
  amount: 0,
  barcode: "",
  batch_no: "",
});

const emptyEntry = (): StockEntry => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return {
    naming_series: "MAT-STE-.YYYY.-",
    stock_entry_type: "Material Transfer",
    purpose: "Material Transfer",
    company_id: "",
    company: "",
    posting_date: now.toISOString().slice(0, 10),
    posting_time: timeStr,
    set_posting_time: false,
    inspection_required: false,
    add_to_transit: false,
    apply_putaway_rule: false,
    work_order: "",
    from_bom: false,
    bom_no: "",
    from_warehouse: "",
    to_warehouse: "",
    scan_barcode: "",
    total_qty: 0,
    total_amount: 0,
    status: "Draft",
    remarks: "",
    items: [emptyItem()],
  };
};

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
  itemOptions: StockEntryItemOption[];
  onChange: (item: StockEntryItemOption) => void;
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

export default function StockEntryFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-stock-entry");

  const [tab, setTab] = useState<Tab>("details");
  const [row, setRow] = useState<StockEntry>(emptyEntry());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockEntryTypes, setStockEntryTypes] = useState<StockEntryType[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [options, setOptions] = useState<StockEntryOptions>({
    stock_entry_types: [
      "Material Transfer",
      "Material Receipt",
      "Material Issue",
      "Manufacture",
      "Repack",
    ],
    naming_series: ["MAT-STE-.YYYY.-"],
    companies: [],
    warehouses: [],
    items: [],
  });

  const loadOptionsAndData = async () => {
    setLoading(true);
    try {
      const [opts, typesRes, companyList] = await Promise.all([
        stockEntryApi.options(),
        stockEntryTypeApi.list(),
        warehouseApi.listCompanies(),
      ]);

      if (opts) {
        setOptions(opts);
      }

      let compOptions: CompanyOption[] = [];
      if (companyList && companyList.length > 0) {
        compOptions = companyList;
      } else if (opts?.company_options && opts.company_options.length > 0) {
        compOptions = opts.company_options;
      } else if (opts?.companies && opts.companies.length > 0) {
        compOptions = opts.companies.map((c) => ({ name: c }));
      }
      setCompanies(compOptions);

      let typesList = typesRes?.data || [];
      if (typesList.length === 0) {
        try {
          await stockEntryTypeApi.seed();
          const reloaded = await stockEntryTypeApi.list();
          typesList = reloaded.data || [];
        } catch {
          // ignore seeding error
        }
      }
      setStockEntryTypes(typesList);

      if (!isNew && id) {
        const data = await stockEntryApi.get(id);
        if (data) {
          if (data.posting_date) {
            data.posting_date = data.posting_date.slice(0, 10);
          }
          if (!data.items || data.items.length === 0) {
            data.items = [emptyItem()];
          }
          if (!data.purpose && data.stock_entry_type) {
            const matched = typesList.find((t) => t.name === data.stock_entry_type);
            if (matched?.purpose) {
              data.purpose = matched.purpose;
            }
          }
          if (!data.company_id && data.company && compOptions.length > 0) {
            const foundComp = compOptions.find((c) => c.name === data.company);
            if (foundComp?.id) {
              data.company_id = foundComp.id;
            }
          }
          setRow(data);
        }
      } else {
        const initialCompany = compOptions.length > 0 ? compOptions[0] : null;
        setRow((prev) => ({
          ...prev,
          company: prev.company || initialCompany?.name || "",
          company_id: prev.company_id || (initialCompany?.id ? initialCompany.id : ""),
          from_warehouse: opts?.warehouses?.length ? opts.warehouses[0] : prev.from_warehouse,
          to_warehouse: opts?.warehouses && opts.warehouses.length >= 2 ? opts.warehouses[1] : prev.to_warehouse,
          items: prev.items.map((it) => ({
            ...it,
            source_warehouse: opts?.warehouses?.length ? opts.warehouses[0] : it.source_warehouse,
            target_warehouse: opts?.warehouses && opts.warehouses.length >= 2 ? opts.warehouses[1] : it.target_warehouse,
          })),
        }));
      }
    } catch {
      toast.error("Gagal memuat data formulir Stock Entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptionsAndData();
  }, [id, isNew]);

  const handleSelectCompany = (val: string) => {
    const matched = companies.find((c) => c.name === val || c.id === val);
    const companyName = matched?.name || val;
    const companyId = matched?.id || "";

    setRow((prev) => ({
      ...prev,
      company: companyName,
      company_id: companyId || prev.company_id || "",
    }));
  };

  const selectedType = stockEntryTypes.find((t) => t.name === row.stock_entry_type);
  const currentPurpose = selectedType?.purpose || row.purpose || row.stock_entry_type || "Material Transfer";

  const showSourceWarehouse = currentPurpose !== "Material Receipt";
  const showTargetWarehouse =
    currentPurpose !== "Material Issue" && currentPurpose !== "Material Consumption for Manufacture";
  const showWorkOrder = [
    "Manufacture",
    "Disassemble",
    "Material Transfer for Manufacture",
    "Material Consumption for Manufacture",
  ].includes(currentPurpose);
  const showInspectionRequired = currentPurpose === "Manufacture";
  const showTransitOptions = currentPurpose === "Material Transfer";

  const handleSelectStockEntryType = (val: string) => {
    const matched = stockEntryTypes.find((t) => t.name === val);
    const purpose = matched?.purpose || val;
    const isReceipt = purpose === "Material Receipt";
    const isIssueOrConsumption =
      purpose === "Material Issue" || purpose === "Material Consumption for Manufacture";

    setRow((prev) => {
      const nextFromWarehouse = isReceipt ? "" : prev.from_warehouse;
      const nextToWarehouse = isIssueOrConsumption ? "" : prev.to_warehouse;
      const nextItems = prev.items.map((it) => ({
        ...it,
        source_warehouse: isReceipt ? "" : it.source_warehouse || nextFromWarehouse,
        target_warehouse: isIssueOrConsumption ? "" : it.target_warehouse || nextToWarehouse,
      }));

      return {
        ...prev,
        stock_entry_type: val,
        purpose,
        from_warehouse: nextFromWarehouse,
        to_warehouse: nextToWarehouse,
        items: nextItems,
      };
    });
  };

  const recalculate = (items: StockEntryItem[]) => {
    let totalQty = 0;
    let totalAmount = 0;
    const updated = items.map((it, idx) => {
      const conv = it.conversion_factor && it.conversion_factor > 0 ? it.conversion_factor : 1;
      const transferQty = it.qty * conv;
      const amount = it.qty * (it.basic_rate || 0);
      totalQty += it.qty;
      totalAmount += amount;
      return {
        ...it,
        idx: idx + 1,
        transfer_qty: transferQty,
        amount,
      };
    });
    return { items: updated, totalQty, totalAmount };
  };

  const updateField = <K extends keyof StockEntry>(key: K, val: StockEntry[K]) => {
    setRow((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "from_warehouse" && typeof val === "string") {
        next.items = next.items.map((it) => ({
          ...it,
          source_warehouse: it.source_warehouse ? it.source_warehouse : val,
        }));
      }
      if (key === "to_warehouse" && typeof val === "string") {
        next.items = next.items.map((it) => ({
          ...it,
          target_warehouse: it.target_warehouse ? it.target_warehouse : val,
        }));
      }
      return next;
    });
  };

  const updateItem = (index: number, key: keyof StockEntryItem, val: any) => {
    setRow((prev) => {
      const newItems = [...prev.items];
      const current = { ...newItems[index], [key]: val };
      newItems[index] = current;
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return {
        ...prev,
        items,
        total_qty: totalQty,
        total_amount: totalAmount,
      };
    });
  };

  const handleSelectItem = (index: number, opt: StockEntryItemOption) => {
    setRow((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        item_code: opt.item_code,
        item_name: opt.item_name,
        uom: opt.uom || "Nos",
        basic_rate: opt.basic_rate || 0,
        barcode: opt.barcode || "",
        description: opt.description || "",
      };
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return {
        ...prev,
        items,
        total_qty: totalQty,
        total_amount: totalAmount,
      };
    });
  };

  const addItemRow = () => {
    setRow((prev) => {
      const newItems = [
        ...prev.items,
        {
          ...emptyItem(),
          source_warehouse: showSourceWarehouse ? (prev.from_warehouse || "") : "",
          target_warehouse: showTargetWarehouse ? (prev.to_warehouse || "") : "",
        },
      ];
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return {
        ...prev,
        items,
        total_qty: totalQty,
        total_amount: totalAmount,
      };
    });
  };

  const removeItemRow = (index: number) => {
    setRow((prev) => {
      if (prev.items.length <= 1) {
        toast.info("Minimal satu baris item diperlukan");
        return prev;
      }
      const newItems = prev.items.filter((_, i) => i !== index);
      const { items, totalQty, totalAmount } = recalculate(newItems);
      return {
        ...prev,
        items,
        total_qty: totalQty,
        total_amount: totalAmount,
      };
    });
  };

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
        let newItems: StockEntryItem[];
        const defaultSource = showSourceWarehouse ? (prev.from_warehouse || "") : "";
        const defaultTarget = showTargetWarehouse ? (prev.to_warehouse || "") : "";

        if (existingIdx >= 0) {
          newItems = prev.items.map((it, idx) =>
            idx === existingIdx ? { ...it, qty: it.qty + 1 } : it
          );
          toast.success(`Menambahkan kuantitas untuk ${found.item_name}`);
        } else {
          const newItemData: StockEntryItem = {
            ...emptyItem(),
            item_code: found.item_code,
            item_name: found.item_name,
            uom: found.uom,
            basic_rate: found.basic_rate,
            barcode: found.barcode,
            description: found.description,
            source_warehouse: defaultSource,
            target_warehouse: defaultTarget,
            qty: 1,
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
    if (!row.stock_entry_type) {
      toast.error("Stock Entry Type wajib dipilih");
      return;
    }
    if (!row.items || row.items.length === 0 || !row.items[0].item_code) {
      toast.error("Wajib memiliki minimal satu item");
      return;
    }

    // Clean up warehouse data based on purpose
    const cleanedItems = row.items.map((it) => ({
      ...it,
      source_warehouse: showSourceWarehouse ? (it.source_warehouse || row.from_warehouse || "") : "",
      target_warehouse: showTargetWarehouse ? (it.target_warehouse || row.to_warehouse || "") : "",
    }));

    if (showSourceWarehouse) {
      const missingSource = cleanedItems.some((it) => !it.source_warehouse && it.item_code);
      if (missingSource) {
        toast.error(`Source Warehouse wajib diisi untuk tujuan ${currentPurpose}`);
        return;
      }
    }

    if (showTargetWarehouse) {
      const missingTarget = cleanedItems.some((it) => !it.target_warehouse && it.item_code);
      if (missingTarget) {
        toast.error(`Target Warehouse wajib diisi untuk tujuan ${currentPurpose}`);
        return;
      }
    }

    const payload: StockEntry = {
      ...row,
      purpose: currentPurpose,
      from_warehouse: showSourceWarehouse ? (row.from_warehouse || "") : "",
      to_warehouse: showTargetWarehouse ? (row.to_warehouse || "") : "",
      items: cleanedItems,
    };

    setSaving(true);
    try {
      if (isNew) {
        const created = await stockEntryApi.create(payload);
        toast.success("Stock Entry berhasil dibuat");
        navigate(`/desk/stock-entry/${created.id}`);
      } else {
        const updated = await stockEntryApi.update(id!, payload);
        toast.success("Stock Entry berhasil diperbarui");
        setRow(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Stock Entry");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEntry = async () => {
    if (!confirm("Apakah Anda yakin ingin Submit Stock Entry ini? Stock ledger akan diperbarui.")) return;
    setSaving(true);
    try {
      const res = await stockEntryApi.submit(id!);
      toast.success("Stock Entry berhasil di-Submit dan pergerakan stok telah dicatat");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal submit Stock Entry");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEntry = async () => {
    if (!confirm("Apakah Anda yakin ingin Membatalkan Stock Entry ini? Pergerakan stok akan dibalik.")) return;
    setSaving(true);
    try {
      const res = await stockEntryApi.cancel(id!);
      toast.success("Stock Entry berhasil dibatalkan dan stok telah disesuaikan kembali");
      setRow(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal membatalkan Stock Entry");
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
            <Link to="/desk/stock-entry" className="hover:text-blue-600">Stock Entry</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Stock Entry" : row.stock_entry_number || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Stock Entry" : row.stock_entry_number || id}
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
            <Link to="/desk/stock-entry">
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
              onClick={handleSubmitEntry}
              disabled={saving}
            >
              <CheckCircle2 className="mr-2 size-4" />
              Submit
            </Button>
          )}

          {!isNew && row.status === "Submitted" && (
            <Button
              variant="destructive"
              onClick={handleCancelEntry}
              disabled={saving}
            >
              <RotateCcw className="mr-2 size-4" />
              Cancel Entry
            </Button>
          )}
        </div>
      </header>

      {/* Tabs Layout */}
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
              value="dimensions"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Accounting Dimensions
            </TabsTrigger>
            <TabsTrigger
              value="other"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Other Info
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content: Details */}
        <TabsContent value="details" className="space-y-6">
          {/* Main Info Card */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <CompanySelect
                    value={row.company}
                    disabled={isReadonly}
                    onChange={(val) => handleSelectCompany(val)}
                  />
                </div>
                {row.company_id && (
                  <p className="mt-1 text-[10px] text-slate-400 font-mono truncate">
                    ID: {row.company_id}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Series
                </label>
                <Input
                  list="naming-series-list"
                  value={row.naming_series}
                  disabled={isReadonly}
                  onChange={(e) => updateField("naming_series", e.target.value)}
                  className="mt-1"
                />
                <datalist id="naming-series-list">
                  {options.naming_series.map((s) => (
                    <ERPSelectOption key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Stock Entry Type <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.stock_entry_type}
                    disabled={isReadonly}
                    options={(stockEntryTypes.length > 0
                      ? stockEntryTypes
                      : (options.stock_entry_types || []).map((name) => ({
                          id: name,
                          name,
                          purpose: name,
                          is_standard: true,
                          disabled: false,
                        }))
                    ).map((t) => ({
                      value: t.name,
                      label: t.name,
                      sublabel: t.purpose && t.purpose !== t.name ? `Purpose: ${t.purpose}` : undefined,
                      badge: t.is_standard ? "Standard" : undefined,
                    }))}
                    onChange={(val) => handleSelectStockEntryType(val)}
                    placeholder="Pilih Stock Entry Type..."
                    searchPlaceholder="Cari tipe atau purpose..."
                    addNewLabel="Tambah Stock Entry Type"
                    addNewHref="/desk/stock-entry-type/new"
                  />
                </div>
                {selectedType?.purpose && selectedType.purpose !== row.stock_entry_type && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Purpose: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedType.purpose}</span>
                  </p>
                )}
              </div>

              {showWorkOrder && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Work Order
                  </label>
                  <Input
                    value={row.work_order || ""}
                    disabled={isReadonly}
                    onChange={(e) => updateField("work_order", e.target.value)}
                    placeholder="MFG-WO-YYYY-00001"
                    className="mt-1"
                  />
                </div>
              )}

              {showInspectionRequired && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="inspection_required"
                    checked={!!row.inspection_required}
                    disabled={isReadonly}
                    onChange={(e) => updateField("inspection_required", e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="inspection_required"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Inspection Required
                  </label>
                </div>
              )}

              {showTransitOptions && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add_to_transit"
                      checked={!!row.add_to_transit}
                      disabled={isReadonly}
                      onChange={(e) => updateField("add_to_transit", e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="add_to_transit"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Add to Transit
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="apply_putaway_rule"
                      checked={!!row.apply_putaway_rule}
                      disabled={isReadonly}
                      onChange={(e) => updateField("apply_putaway_rule", e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="apply_putaway_rule"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Apply Putaway Rule
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
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
                    Posting Date
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
            </div>
          </div>

          {/* BOM Info & Default Warehouses */}
          <div className="grid gap-6 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-950">
            {/* BOM Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">BOM Info</h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="from_bom"
                  checked={row.from_bom}
                  disabled={isReadonly}
                  onChange={(e) => updateField("from_bom", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="from_bom" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  From BOM
                </label>
              </div>

              {row.from_bom && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    BOM No
                  </label>
                  <Input
                    value={row.bom_no || ""}
                    disabled={isReadonly}
                    onChange={(e) => updateField("bom_no", e.target.value)}
                    placeholder="BOM-PRD-..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* Default Warehouses */}
            {(showSourceWarehouse || showTargetWarehouse) && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Default Warehouse</h3>
                {showSourceWarehouse && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Default Source Warehouse
                    </label>
                    <div className="mt-1">
                      <SearchableWarehouseSelect
                        value={row.from_warehouse || ""}
                        warehouses={options.warehouses}
                        disabled={isReadonly}
                        onChange={(val) => updateField("from_warehouse", val)}
                        placeholder="Pilih default source warehouse..."
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Sets 'Source Warehouse' in each row of the items table.
                    </p>
                  </div>
                )}

                {showTargetWarehouse && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Default Target Warehouse
                    </label>
                    <div className="mt-1">
                      <SearchableWarehouseSelect
                        value={row.to_warehouse || ""}
                        warehouses={options.warehouses}
                        disabled={isReadonly}
                        onChange={(val) => updateField("to_warehouse", val)}
                        placeholder="Pilih default target warehouse..."
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Sets 'Target Warehouse' in each row of the items table.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barcode Scanner Box */}
          {!isReadonly && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-300">
                  <ScanBarcode className="size-5 text-blue-600" />
                  <span>Scan Barcode</span>
                </div>
                <div className="flex-1">
                  <Input
                    value={row.scan_barcode || ""}
                    onChange={(e) => updateField("scan_barcode", e.target.value)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="Scan barcode item atau ketik kode item lalu tekan Enter..."
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
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
                    {showSourceWarehouse && (
                      <th className="px-2 py-3 min-w-[190px]">Source Warehouse</th>
                    )}
                    {showTargetWarehouse && (
                      <th className="px-2 py-3 min-w-[190px]">Target Warehouse</th>
                    )}
                    <th className="px-2 py-3 w-24 text-right">Qty</th>
                    <th className="px-2 py-3 w-20">UOM</th>
                    <th className="px-2 py-3 w-32 text-right">Basic Rate</th>
                    <th className="px-2 py-3 w-32 text-right">Amount</th>
                    {!isReadonly && <th className="py-3 pl-2 pr-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {row.items.map((item, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        {/* No */}
                        <td className="py-3 pl-3 pr-2 text-center text-xs font-medium text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Item Code (Searchable dropdown with + Tambah Item) */}
                        <td className="px-2 py-2">
                          <SearchableItemSelect
                            value={item.item_code}
                            itemOptions={options.items}
                            disabled={isReadonly}
                            onChange={(opt) => handleSelectItem(idx, opt)}
                            placeholder="Pilih item..."
                          />
                        </td>

                        {/* Source Warehouse (Searchable dropdown with + Tambah Warehouse) */}
                        {showSourceWarehouse && (
                          <td className="px-2 py-2">
                            <SearchableWarehouseSelect
                              value={item.source_warehouse || ""}
                              warehouses={options.warehouses}
                              disabled={isReadonly}
                              onChange={(val) => updateItem(idx, "source_warehouse", val)}
                              placeholder="Source warehouse"
                            />
                          </td>
                        )}

                        {/* Target Warehouse (Searchable dropdown with + Tambah Warehouse) */}
                        {showTargetWarehouse && (
                          <td className="px-2 py-2">
                            <SearchableWarehouseSelect
                              value={item.target_warehouse || ""}
                              warehouses={options.warehouses}
                              disabled={isReadonly}
                              onChange={(val) => updateItem(idx, "target_warehouse", val)}
                              placeholder="Target warehouse"
                            />
                          </td>
                        )}

                        {/* Qty */}
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.qty}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right"
                          />
                        </td>

                        {/* UOM */}
                        <td className="px-2 py-2">
                          <Input
                            value={item.uom || "Nos"}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "uom", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>

                        {/* Basic Rate */}
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.basic_rate}
                            disabled={isReadonly}
                            onChange={(e) => updateItem(idx, "basic_rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right"
                          />
                        </td>

                        {/* Amount */}
                        <td className="px-2 py-2 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {formatRp(item.amount || 0)}
                        </td>

                        {/* Delete action */}
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

            {/* Totals Summary */}
            <div className="flex flex-col items-end gap-2 pt-2 text-sm">
              <div className="flex items-center gap-6">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {row.total_qty || 0}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-slate-500">Total Amount:</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatRp(row.total_amount || 0)}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab Content: Accounting Dimensions */}
        <TabsContent value="dimensions" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              Accounting Dimensions & Cost Centers
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center
                </label>
                <Input
                  value={row.purpose || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("purpose", e.target.value)}
                  placeholder="Main - PZTS"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project
                </label>
                <Input
                  disabled={isReadonly}
                  placeholder="Optional Project Code"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab Content: Other Info */}
        <TabsContent value="other" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              Other Info & Remarks
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Remarks / Notes
                </label>
                <textarea
                  rows={4}
                  value={row.remarks || ""}
                  disabled={isReadonly}
                  onChange={(e) => updateField("remarks", e.target.value)}
                  placeholder="Tambahkan catatan khusus terkait Stock Entry ini..."
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
