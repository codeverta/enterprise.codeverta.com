import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ScanBarcode,
  Building2,
  Calendar,
  Clock,
  ChevronDown,
  ExternalLink,
  Search,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect, SearchableWarehouseSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import { customerApi, type Customer } from "../customerApi";
import { posProfileApi, type POSProfile } from "../posProfileApi";
import { posApi, type POSInvoice } from "../posApi";
import { salesInvoiceApi, type SalesInvoiceItemOption } from "../salesInvoiceApi";

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 8);
const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr || new Date());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const money = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export type POSInvoiceFormItem = {
  id?: string;
  item_code: string;
  item_name?: string;
  warehouse: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
};

export type POSInvoiceTaxRow = {
  charge_type: string;
  account_head: string;
  rate: number;
  net_amount: number;
  amount: number;
  total: number;
};

export type FullPOSInvoiceData = {
  id?: string;
  invoice_number?: string;
  naming_series: string;
  status: "Draft" | "Paid" | "Submitted" | "Cancelled";
  customer: string;
  pos_profile: string;
  is_pos: boolean;
  is_return: boolean;
  company: string;
  posting_date: string;
  posting_time: string;
  set_posting_time: boolean;
  due_date: string;
  project: string;
  cost_center: string;
  update_stock: boolean;
  scan_barcode: string;
  items: POSInvoiceFormItem[];
  total_qty: number;
  base_total: number;
  base_net_total: number;
  total: number;
  net_total: number;
  taxes_and_charges: string;
  shipping_rule: string;
  tax_category: string;
  taxes: POSInvoiceTaxRow[];
  base_total_taxes_and_charges: number;
  total_taxes_and_charges: number;
  base_grand_total: number;
  base_rounding_adjustment: number;
  base_rounded_total: number;
  grand_total: number;
  rounding_adjustment: number;
  rounded_total: number;
  total_advance: number;
  outstanding_amount: number;
  mode_of_payment: string;
  paid_amount: number;
};

const emptyItem = (defaultWarehouse = ""): POSInvoiceFormItem => ({
  item_code: "",
  item_name: "",
  warehouse: defaultWarehouse,
  quantity: 1,
  uom: "Nos",
  rate: 0,
  amount: 0,
});

const defaultInvoice = (): FullPOSInvoiceData => ({
  naming_series: "ACC-PSINV-.YYYY.-",
  status: "Draft",
  customer: "",
  pos_profile: "",
  is_pos: true,
  is_return: false,
  company: "",
  posting_date: today(),
  posting_time: nowTime(),
  set_posting_time: false,
  due_date: addDays(today(), 7),
  project: "",
  cost_center: "",
  update_stock: true,
  scan_barcode: "",
  items: [emptyItem()],
  total_qty: 0,
  base_total: 0,
  base_net_total: 0,
  total: 0,
  net_total: 0,
  taxes_and_charges: "",
  shipping_rule: "",
  tax_category: "",
  taxes: [],
  base_total_taxes_and_charges: 0,
  total_taxes_and_charges: 0,
  base_grand_total: 0,
  base_rounding_adjustment: 0,
  base_rounded_total: 0,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
  total_advance: 0,
  outstanding_amount: 0,
  mode_of_payment: "Cash",
  paid_amount: 0,
});

export function calculatePOSInvoice(doc: FullPOSInvoiceData): FullPOSInvoiceData {
  const sign = doc.is_return ? -1 : 1;
  let totalQty = 0;

  const items = (doc.items || []).map((item) => {
    const qty = sign * Math.abs(Number(item.quantity) || 0);
    const amt = qty * Math.abs(Number(item.rate) || 0);
    totalQty += Math.abs(qty);
    return {
      ...item,
      quantity: qty,
      amount: amt,
    };
  });

  const netTotal = items.reduce((sum, it) => sum + it.amount, 0);
  const total = netTotal;

  // Taxes calculation
  let runningTotal = netTotal;
  const taxes = (doc.taxes || []).map((tax) => {
    const taxRate = Number(tax.rate) || 0;
    const taxAmount = tax.charge_type === "Actual" ? Number(tax.amount) || 0 : (netTotal * taxRate) / 100;
    runningTotal += taxAmount;
    return {
      ...tax,
      net_amount: netTotal,
      amount: taxAmount,
      total: runningTotal,
    };
  });

  const totalTaxes = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const grandTotal = netTotal + totalTaxes;
  const roundedTotal = Math.round(grandTotal);
  const roundingAdj = roundedTotal - grandTotal;

  let outstanding = 0;
  if (doc.is_return) {
    outstanding = 0;
  } else if (doc.is_pos) {
    const paid = Number(doc.paid_amount) || roundedTotal;
    outstanding = Math.max(0, roundedTotal - paid);
  } else {
    outstanding = Math.max(0, roundedTotal - (Number(doc.total_advance) || 0));
  }

  return {
    ...doc,
    items,
    total_qty: totalQty,
    base_total: total,
    base_net_total: netTotal,
    total,
    net_total: netTotal,
    taxes,
    base_total_taxes_and_charges: totalTaxes,
    total_taxes_and_charges: totalTaxes,
    base_grand_total: grandTotal,
    base_rounding_adjustment: roundingAdj,
    base_rounded_total: roundedTotal,
    grand_total: grandTotal,
    rounding_adjustment: roundingAdj,
    rounded_total: roundedTotal,
    outstanding_amount: outstanding,
  };
}

export function SearchableItemSelect({
  value,
  itemOptions,
  onChange,
  disabled,
  placeholder = "Pilih item...",
}: {
  value: string;
  itemOptions: SalesInvoiceItemOption[];
  onChange: (item: SalesInvoiceItemOption) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return setOpen(false);
        setOpen(nextOpen);
        if (nextOpen) setSearch("");
      }}
    >
      <div className="w-full">
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
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
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] max-h-64 w-[340px] max-w-[calc(100vw-24px)] rounded-lg border-slate-200 p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
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
                    <span className="truncate max-w-[200px]">{opt.item_name}</span>
                    {opt.rate > 0 && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {money(opt.rate)}
                      </span>
                    )}
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
        </PopoverContent>
      </div>
    </Popover>
  );
}

export default function POSInvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-pos-invoice");

  const [form, setForm] = useState<FullPOSInvoiceData>(calculatePOSInvoice(defaultInvoice()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Master Data
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [posProfiles, setPOSProfiles] = useState<POSProfile[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([
    "",
    "",
    "Stores - MC",
  ]);
  const [itemOptions, setItemOptions] = useState<SalesInvoiceItemOption[]>([]);

  // Metadata options
  const [namingSeriesOptions] = useState<string[]>([
    "ACC-PSINV-.YYYY.-",
    "ACC-PSINV-RET-.YYYY.-",
    "POS-INV-.YYYY.-",
  ]);
  const [costCenters] = useState<string[]>([
    "Main - PZTS",
    "Sales - PZTS",
    "Stores - PZTS",
  ]);
  const [projects] = useState<string[]>([
    "Retail Store",
    "Customer Delivery",
    "Internal Project",
  ]);
  const [taxTemplates] = useState<string[]>([
    "PPN 11%",
    "PPN 12%",
    "Exempt Tax",
  ]);
  const [shippingRules] = useState<string[]>([
    "Standard Delivery",
    "Express Delivery",
    "Store Pickup",
  ]);
  const [taxCategories] = useState<string[]>([
    "In State",
    "Out of State",
    "Export",
  ]);

  useEffect(() => {
    const loadMaster = async () => {
      setLoading(true);
      try {
        const [compRes, custRes, profRes, whRes, invoiceOpts] = await Promise.all([
          warehouseApi.listCompanies().catch(() => [] as CompanyOption[]),
          customerApi.list().catch(() => [] as Customer[]),
          posProfileApi.list().catch(() => [] as POSProfile[]),
          warehouseApi.list().catch(() => []),
          salesInvoiceApi.options().catch(() => null),
        ]);

        if (compRes && compRes.length > 0) {
          setCompanies(compRes);
          if (isNew && !form.company) {
            setForm((prev) => ({ ...prev, company: compRes[0].name }));
          }
        }

        if (custRes && custRes.length > 0) {
          setCustomers(custRes);
        }

        if (profRes && profRes.length > 0) {
          setPOSProfiles(profRes);
          if (isNew && !form.pos_profile) {
            const firstActive = profRes.find((p) => !p.disabled) || profRes[0];
            setForm((prev) => ({
              ...prev,
              pos_profile: firstActive.name,
              company: firstActive.company || prev.company,
            }));
          }
        }

        const whNames: string[] = [];
        if (whRes && whRes.length > 0) {
          whNames.push(...whRes.map((w: any) => w.warehouse_name));
        }
        if (invoiceOpts?.warehouses) {
          invoiceOpts.warehouses.forEach((w) => {
            if (!whNames.includes(w)) whNames.push(w);
          });
        }
        if (whNames.length > 0) {
          setWarehouses(whNames);
        }

        if (invoiceOpts?.items) {
          setItemOptions(invoiceOpts.items);
        }

        // If editing existing invoice
        if (!isNew && id) {
          const invoices = await posApi.listInvoices();
          const found = invoices.find((inv) => inv.id === id || inv.invoice_number === id);
          if (found) {
            setForm(
              calculatePOSInvoice({
                ...defaultInvoice(),
                id: found.id,
                invoice_number: found.invoice_number,
                status: (found.status as any) || "Paid",
                customer: found.customer || "Walk-in Customer",
                mode_of_payment: found.mode_of_payment || "Cash",
                paid_amount: found.paid_amount || found.grand_total || 0,
                posting_date: found.created_at ? found.created_at.slice(0, 10) : today(),
                posting_time: found.created_at ? found.created_at.slice(11, 19) : nowTime(),
                items: found.items.map((it) => ({
                  item_code: it.item_code,
                  item_name: it.item_name,
                  warehouse: warehouses[0] || "",
                  quantity: it.quantity,
                  uom: "Nos",
                  rate: it.rate,
                  amount: it.amount || it.quantity * it.rate,
                })),
              })
            );
          }
        }
      } catch {
        toast.error("Gagal memuat master data POS Invoice");
      } finally {
        setLoading(false);
      }
    };
    loadMaster();
  }, [id, isNew]);

  const update = <K extends keyof FullPOSInvoiceData>(key: K, value: FullPOSInvoiceData[K]) => {
    setForm((prev) => calculatePOSInvoice({ ...prev, [key]: value }));
  };

  const updateItem = (index: number, patch: Partial<POSInvoiceFormItem>) => {
    setForm((prev) => {
      const items = prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
      return calculatePOSInvoice({ ...prev, items });
    });
  };

  const addItem = () => {
    setForm((prev) => {
      const defWarehouse = prev.items[0]?.warehouse || warehouses[0] || "";
      return calculatePOSInvoice({ ...prev, items: [...prev.items, emptyItem(defWarehouse)] });
    });
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) {
      toast.error("Minimal harus ada 1 item");
      return;
    }
    setForm((prev) =>
      calculatePOSInvoice({ ...prev, items: prev.items.filter((_, i) => i !== index) })
    );
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = (form.scan_barcode || "").trim();
      if (!code) return;

      const foundOpt = itemOptions.find(
        (it) =>
          it.item_code.toLowerCase() === code.toLowerCase() ||
          (it.barcode && it.barcode.toLowerCase() === code.toLowerCase())
      );

      const itemCodeToMatch = foundOpt ? foundOpt.item_code : code;
      const matchIdx = form.items.findIndex(
        (it) => it.item_code.toLowerCase() === itemCodeToMatch.toLowerCase()
      );

      if (matchIdx >= 0) {
        updateItem(matchIdx, { quantity: (form.items[matchIdx].quantity || 0) + 1 });
        toast.success(`Item ${itemCodeToMatch} quantity +1`);
      } else {
        const defWarehouse = form.items[0]?.warehouse || warehouses[0] || "";
        setForm((prev) =>
          calculatePOSInvoice({
            ...prev,
            items: [
              ...prev.items,
              {
                item_code: itemCodeToMatch,
                item_name: foundOpt ? foundOpt.item_name : code,
                warehouse: defWarehouse,
                quantity: 1,
                uom: foundOpt?.uom || "Nos",
                rate: foundOpt?.rate || 0,
                amount: foundOpt?.rate || 0,
              },
            ],
            scan_barcode: "",
          })
        );
        toast.success(`Item ${foundOpt ? foundOpt.item_name : itemCodeToMatch} ditambahkan`);
        return;
      }
      update("scan_barcode", "");
    }
  };

  const handlePOSProfileSelect = (profileName: string) => {
    update("pos_profile", profileName);
    const matched = posProfiles.find((p) => p.name === profileName);
    if (matched) {
      if (matched.company) update("company", matched.company);
      if (matched.customer) update("customer", matched.customer);
      if (matched.warehouse) {
        setForm((prev) =>
          calculatePOSInvoice({
            ...prev,
            pos_profile: profileName,
            items: prev.items.map((it) => ({
              ...it,
              warehouse: matched.warehouse || it.warehouse,
            })),
          })
        );
      }
    }
  };

  const handleTaxTemplateChange = (templateName: string) => {
    let rate = 0;
    if (templateName.includes("11")) rate = 11;
    else if (templateName.includes("12")) rate = 12;

    const newTaxes: POSInvoiceTaxRow[] = templateName
      ? [
          {
            charge_type: "On Net Total",
            account_head: templateName,
            rate: rate,
            net_amount: form.net_total,
            amount: (form.net_total * rate) / 100,
            total: form.net_total + (form.net_total * rate) / 100,
          },
        ]
      : [];

    setForm((prev) =>
      calculatePOSInvoice({
        ...prev,
        taxes_and_charges: templateName,
        taxes: newTaxes,
      })
    );
  };

  const save = async () => {
    if (!form.customer.trim()) return toast.error("Customer wajib diisi");
    if (!form.company.trim()) return toast.error("Company wajib diisi");
    if (form.items.some((it) => !it.item_code.trim() || Math.abs(it.quantity) <= 0)) {
      return toast.error("Item code dan quantity wajib valid");
    }

    setSaving(true);
    try {
      const calculated = calculatePOSInvoice(form);
      const payload: POSInvoice = {
        id: calculated.id,
        invoice_number:
          calculated.invoice_number ||
          `ACC-PSINV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        opening_entry_id: "POS-OPEN-MANUAL",
        customer: calculated.customer,
        net_total: calculated.net_total,
        tax_total: calculated.total_taxes_and_charges,
        grand_total: calculated.rounded_total || calculated.grand_total,
        mode_of_payment: calculated.mode_of_payment || "Cash",
        paid_amount: calculated.is_pos ? calculated.rounded_total : 0,
        status: calculated.is_pos ? "Paid" : "Draft",
        created_at: `${calculated.posting_date}T${calculated.posting_time || "00:00:00"}Z`,
        items: calculated.items.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name || it.item_code,
          quantity: it.quantity,
          rate: it.rate,
          amount: it.amount,
        })),
      };

      await posApi.createInvoice(payload);
      toast.success("POS Invoice berhasil disimpan");
      navigate("/desk/pos-invoice");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan POS Invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-slate-500">
        Memuat form POS Invoice...
      </div>
    );
  }

  const isReadonly = form.status === "Paid" && !isNew;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <Link to="/desk/pos-invoice" className="hover:text-blue-600">
              POS Invoice
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? (form.is_return ? "New Return POS Invoice" : "New POS Invoice") : form.invoice_number}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? (form.is_return ? "New Return POS Invoice" : "New POS Invoice") : form.invoice_number}
            </h1>
            <Badge variant={form.status === "Paid" ? "default" : "secondary"}>
              {isNew ? "Not Saved" : form.status}
            </Badge>
            {form.is_return && (
              <Badge className="bg-amber-100 text-amber-700">Credit Note</Badge>
            )}
            {form.is_pos && (
              <Badge className="bg-blue-100 text-blue-700">POS Included</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/pos-invoice">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          {!isReadonly && (
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      {/* Form Content */}
      <div className="space-y-6">
        {/* Section 1: Header / General Fields */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Series */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Series <span className="text-slate-400 font-normal">(naming_series)</span>
              </label>
              <select
                value={form.naming_series}
                disabled={isReadonly}
                onChange={(e) => update("naming_series", e.target.value)}
                className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
              >
                {namingSeriesOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer <span className="text-red-500">*</span>{" "}
                <span className="text-slate-400 font-normal">(customer)</span>
              </label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.customer}
                  disabled={isReadonly}
                  options={
                    customers.length > 0
                      ? customers.map((c) => ({
                          value: c.customer_name,
                          label: c.customer_name,
                          sublabel: c.phone || c.email || undefined,
                          badge: c.customer_group || undefined,
                        }))
                      : [{ value: "Walk-in Customer", label: "Walk-in Customer" }]
                  }
                  onSearch={async (query) => {
                    try {
                      const res = await customerApi.list(query);
                      return res.map((c) => ({
                        value: c.customer_name,
                        label: c.customer_name,
                        sublabel: c.phone || c.email || undefined,
                        badge: c.customer_group || undefined,
                      }));
                    } catch {
                      return [];
                    }
                  }}
                  onChange={(val) => update("customer", val)}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari customer..."
                  addNewLabel="Buat Customer Baru"
                  addNewHref="/desk/customer/new"
                />
              </div>
            </div>

            {/* POS Profile */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                POS Profile <span className="text-slate-400 font-normal">(pos_profile)</span>
              </label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.pos_profile}
                  disabled={isReadonly}
                  options={posProfiles.map((p) => ({
                    value: p.name,
                    label: p.name,
                    sublabel: p.company,
                    badge: p.warehouse,
                  }))}
                  onChange={handlePOSProfileSelect}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari POS Profile..."
                  addNewLabel="Tambah POS Profile"
                  addNewHref="/desk/pos-profile/new"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company <span className="text-red-500">*</span>{" "}
                <span className="text-slate-400 font-normal">(company)</span>
              </label>
              <div className="mt-1">
                <CompanySelect
                  value={form.company}
                  disabled={isReadonly}
                  onChange={(val) => update("company", val)}
                  placeholder="Begin typing for results."
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Date <span className="text-slate-400 font-normal">(posting_date)</span>
              </label>
              <Input
                type="date"
                value={form.posting_date?.slice(0, 10)}
                disabled={isReadonly}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) =>
                    calculatePOSInvoice({
                      ...prev,
                      posting_date: val,
                      due_date: addDays(val, 7),
                    })
                  );
                }}
                className="mt-1 text-xs"
              />
            </div>

            {/* Posting Time */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Posting Time <span className="text-slate-400 font-normal">(posting_time)</span>
              </label>
              <Input
                type="time"
                step="1"
                value={form.posting_time}
                disabled={isReadonly || !form.set_posting_time}
                onChange={(e) => update("posting_time", e.target.value)}
                className="mt-1 text-xs"
              />
              <label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer text-slate-500">
                <Checkbox
                  checked={form.set_posting_time}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("set_posting_time", !!c)}
                />
                Edit Posting Date and Time <span className="text-slate-400 font-normal">(set_posting_time)</span>
              </label>
            </div>

            {/* Payment Due Date */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Due Date <span className="text-slate-400 font-normal">(due_date)</span>
              </label>
              <Input
                type="date"
                value={form.due_date?.slice(0, 10)}
                disabled={isReadonly}
                onChange={(e) => update("due_date", e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Checkboxes: is_pos & is_return */}
          <div className="grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 border-t">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <Checkbox
                checked={form.is_pos}
                disabled={isReadonly}
                onCheckedChange={(c) => update("is_pos", !!c)}
              />
              <div>
                <span>Include Payment (POS)</span>
                <span className="ml-1 text-slate-400 font-normal">(is_pos)</span>
              </div>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <Checkbox
                checked={form.is_return}
                disabled={isReadonly}
                onCheckedChange={(c) => update("is_return", !!c)}
              />
              <div>
                <span>Is Return (Credit Note)</span>
                <span className="ml-1 text-slate-400 font-normal">(is_return)</span>
              </div>
            </label>
          </div>

          {/* Accounting Dimensions: Project & Cost Center */}
          <div className="pt-3 border-t space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Accounting Dimensions
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project <span className="text-slate-400 font-normal">(project)</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.project}
                    disabled={isReadonly}
                    options={projects.map((p) => ({ value: p, label: p }))}
                    onChange={(val) => update("project", val)}
                    placeholder="Begin typing for results."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center <span className="text-slate-400 font-normal">(cost_center)</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.cost_center}
                    disabled={isReadonly}
                    options={costCenters.map((c) => ({ value: c, label: c }))}
                    onChange={(val) => update("cost_center", val)}
                    placeholder="Begin typing for results."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Items Table */}
        <div className="min-w-0 max-w-full rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                  Items
                </h3>
                <span className="text-xs text-slate-400 font-normal">(items)</span>
              </div>
              <p className="text-xs text-slate-500">
                Daftar barang transaksi kasir beserta warehouse sumber stock.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <Checkbox
                  checked={form.update_stock}
                  disabled={isReadonly}
                  onCheckedChange={(c) => update("update_stock", !!c)}
                />
                Update Stock <span className="text-slate-400 font-normal">(update_stock)</span>
              </label>
              {!isReadonly && (
                <Button size="sm" onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-1.5 size-3.5" /> Add Row
                </Button>
              )}
            </div>
          </div>

          {/* Scan Barcode */}
          {!isReadonly && (
            <div className="flex items-center gap-2 max-w-md">
              <ScanBarcode className="size-4 text-blue-600 shrink-0" />
              <div className="w-full">
                <Input
                  value={form.scan_barcode || ""}
                  onChange={(e) => update("scan_barcode", e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  placeholder="Scan Barcode / ketik kode item lalu tekan Enter... (scan_barcode)"
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}

          {/* Grid Table */}
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">No.</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Item</th>
                  <th className="py-2.5 px-3 w-28 text-right">Quantity</th>
                  <th className="py-2.5 px-3 w-32 text-right">Rate</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Warehouse</th>
                  {!isReadonly && <th className="py-2.5 px-3 w-12 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {form.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        <SearchableItemSelect
                          value={it.item_code}
                          itemOptions={itemOptions}
                          disabled={isReadonly}
                          onChange={(opt) => {
                            const qty = Math.abs(it.quantity) || 1;
                            updateItem(idx, {
                              item_code: opt.item_code,
                              item_name: opt.item_name,
                              uom: opt.uom || it.uom || "Nos",
                              rate: opt.rate,
                              amount: qty * opt.rate,
                            });
                          }}
                        />
                        <Input
                          value={it.item_name || ""}
                          disabled={isReadonly}
                          onChange={(e) => updateItem(idx, { item_name: e.target.value })}
                          placeholder="Deskripsi/nama item..."
                          className="h-7 text-[11px] text-slate-500"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Input
                        type="number"
                        step="any"
                        value={Math.abs(it.quantity)}
                        disabled={isReadonly}
                        onChange={(e) =>
                          updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-xs text-right font-medium"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <Input
                        type="number"
                        step="any"
                        value={it.rate}
                        disabled={isReadonly}
                        onChange={(e) =>
                          updateItem(idx, { rate: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-xs text-right font-medium"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      {money(it.amount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <SearchableWarehouseSelect
                        value={it.warehouse || ""}
                        warehouses={warehouses}
                        disabled={isReadonly}
                        onChange={(wh) => updateItem(idx, { warehouse: wh })}
                      />
                    </td>
                    {!isReadonly && (
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          disabled={form.items.length === 1}
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Totals, Taxes, and Charges */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Totals Summary & Taxes Form */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Totals & Taxes Configuration
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Total Quantity */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total Quantity <span className="text-slate-400 font-normal">(total_qty)</span>
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {form.total_qty}
                </div>
              </div>

              {/* Total (Company Currency) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total (Company Currency) <span className="text-slate-400 font-normal">(base_total)</span>
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {money(form.base_total)}
                </div>
              </div>

              {/* Net Total (Company Currency) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Net Total (Company Currency) <span className="text-slate-400 font-normal">(base_net_total)</span>
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {money(form.base_net_total)}
                </div>
              </div>

              {/* Total */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total <span className="text-slate-400 font-normal">(total)</span>
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {money(form.total)}
                </div>
              </div>

              {/* Net Total */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Net Total <span className="text-slate-400 font-normal">(net_total)</span>
                </label>
                <div className="mt-1 p-2 border rounded-md font-semibold text-xs bg-slate-50 dark:bg-slate-900">
                  {money(form.net_total)}
                </div>
              </div>

              {/* Tax Category */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tax Category <span className="text-slate-400 font-normal">(tax_category)</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.tax_category}
                    disabled={isReadonly}
                    options={taxCategories.map((t) => ({ value: t, label: t }))}
                    onChange={(val) => update("tax_category", val)}
                    placeholder="Begin typing for results."
                  />
                </div>
              </div>

              {/* Sales Taxes and Charges Template */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sales Taxes and Charges Template <span className="text-slate-400 font-normal">(taxes_and_charges)</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.taxes_and_charges}
                    disabled={isReadonly}
                    options={taxTemplates.map((t) => ({ value: t, label: t }))}
                    onChange={handleTaxTemplateChange}
                    placeholder="Begin typing for results."
                  />
                </div>
              </div>

              {/* Shipping Rule */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shipping Rule <span className="text-slate-400 font-normal">(shipping_rule)</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.shipping_rule}
                    disabled={isReadonly}
                    options={shippingRules.map((s) => ({ value: s, label: s }))}
                    onChange={(val) => update("shipping_rule", val)}
                    placeholder="Begin typing for results."
                  />
                </div>
              </div>
            </div>

            {/* Sales Taxes and Charges Table */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Sales Taxes and Charges Table
                </h4>
                {!isReadonly && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm((prev) =>
                        calculatePOSInvoice({
                          ...prev,
                          taxes: [
                            ...prev.taxes,
                            {
                              charge_type: "On Net Total",
                              account_head: "Sales Tax - PZTS",
                              rate: 11,
                              net_amount: prev.net_total,
                              amount: (prev.net_total * 11) / 100,
                              total: prev.net_total + (prev.net_total * 11) / 100,
                            },
                          ],
                        })
                      )
                    }
                  >
                    <Plus className="mr-1 size-3" /> Add Tax
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900">
                    <tr>
                      <th className="p-2 w-8 text-center">No.</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Account Head</th>
                      <th className="p-2 w-16 text-right">Tax Rate</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-right">Total</th>
                      {!isReadonly && <th className="p-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {form.taxes.map((t, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-medium">{t.charge_type}</td>
                        <td className="p-2">{t.account_head}</td>
                        <td className="p-2 text-right">{t.rate}%</td>
                        <td className="p-2 text-right font-semibold">{money(t.amount)}</td>
                        <td className="p-2 text-right font-semibold text-blue-600">{money(t.total)}</td>
                        {!isReadonly && (
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-rose-500"
                              onClick={() =>
                                setForm((prev) =>
                                  calculatePOSInvoice({
                                    ...prev,
                                    taxes: prev.taxes.filter((_, i) => i !== idx),
                                  })
                                )
                              }
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {form.taxes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          Tidak ada taxes & charges diterapkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
                <span>
                  Base Total Taxes and Charges <span className="text-slate-400 font-normal">(base_total_taxes_and_charges)</span>:
                </span>
                <span className="font-semibold">{money(form.base_total_taxes_and_charges)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>
                  Total Taxes and Charges <span className="text-slate-400 font-normal">(total_taxes_and_charges)</span>:
                </span>
                <span className="font-semibold">{money(form.total_taxes_and_charges)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Grand Totals & Payment Settlement */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                Grand Totals & Payment Details
              </h3>

              {form.is_pos && (
                <div className="mt-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    POS Payment Mode
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] text-slate-500">Mode of Payment</label>
                      <select
                        value={form.mode_of_payment}
                        disabled={isReadonly}
                        onChange={(e) => update("mode_of_payment", e.target.value)}
                        className="mt-1 w-full rounded-md border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="QRIS">QRIS</option>
                        <option value="Credit Card">Credit Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500">Paid Amount (IDR)</label>
                      <Input
                        type="number"
                        step="any"
                        value={form.paid_amount || form.rounded_total}
                        disabled={isReadonly}
                        onChange={(e) => update("paid_amount", parseFloat(e.target.value) || 0)}
                        className="mt-1 h-8 text-xs text-right font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Grand Total Summary Box */}
              <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-2.5 border dark:bg-slate-900 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    Base Grand Total <span className="text-slate-400 font-normal">(base_grand_total)</span>:
                  </span>
                  <span className="font-semibold">{money(form.base_grand_total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Base Rounding Adjustment <span className="text-slate-400 font-normal">(base_rounding_adjustment)</span>:
                  </span>
                  <span className="font-semibold">{money(form.base_rounding_adjustment)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Base Rounded Total <span className="text-slate-400 font-normal">(base_rounded_total)</span>:
                  </span>
                  <span className="font-semibold">{money(form.base_rounded_total)}</span>
                </div>

                <div className="border-t pt-2 flex justify-between text-slate-600">
                  <span>
                    Grand Total <span className="text-slate-400 font-normal">(grand_total)</span>:
                  </span>
                  <span className="font-semibold">{money(form.grand_total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Rounding Adjustment <span className="text-slate-400 font-normal">(rounding_adjustment)</span>:
                  </span>
                  <span className="font-semibold">{money(form.rounding_adjustment)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-blue-600 border-t pt-2">
                  <span>
                    Rounded Total <span className="text-slate-400 font-normal text-xs">(rounded_total)</span>:
                  </span>
                  <span>{money(form.rounded_total)}</span>
                </div>

                <div className="border-t pt-2 flex justify-between text-slate-600">
                  <span>
                    Total Advance <span className="text-slate-400 font-normal">(total_advance)</span>:
                  </span>
                  <span className="font-semibold">{money(form.total_advance)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t pt-2 text-slate-900 dark:text-slate-100">
                  <span>
                    Outstanding Amount <span className="text-slate-400 font-normal text-xs">(outstanding_amount)</span>:
                  </span>
                  <span className={form.outstanding_amount > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {money(form.outstanding_amount)}
                  </span>
                </div>
              </div>
            </div>

            {!isReadonly && (
              <div className="pt-4 border-t flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to="/desk/pos-invoice">Cancel</Link>
                </Button>
                <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="mr-2 size-4" /> {saving ? "Saving..." : "Save Invoice"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
