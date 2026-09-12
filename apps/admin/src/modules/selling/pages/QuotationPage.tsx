import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { customerApi, type Customer } from "../customerApi";
import { posApi, type POSItem } from "../posApi";
import { taxCategoryApi, type TaxCategory } from "../taxCategoryApi";
import { quotationApi, type Quotation, type QuotationItem } from "../quotationApi";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";

type Tax = { charge_type: string; account_head: string; rate: number; net_amount: number; amount: number };
type QuotationItemRow = QuotationItem & { sourceIndex: number };
type Tab = "details" | "address" | "terms" | "more";

const today = () => new Date().toISOString().slice(0, 10);
const dateForInput = (value?: string) => (value ? String(value).slice(0, 10) : "");
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const blankItem = (): QuotationItem => ({
  item_code: "",
  item_name: "",
  qty: 1,
  rate: 0,
  amount: 0,
});

const defaultQuotation = (): Quotation => ({
  naming_series: "SAL-QTN-.YYYY.-",
  quotation_to: "Customer",
  party_name: "",
  customer_name: "",
  transaction_date: today(),
  valid_till: "",
  order_type: "Sales",
  company: "",
  currency: "IDR",
  selling_price_list: "Standard Selling",
  scan_barcode: "",
  total_qty: 0,
  total: 0,
  tax_category: "",
  taxes_and_charges: "",
  shipping_rule: "",
  incoterm: "",
  base_total_taxes_and_charges: 0,
  total_taxes_and_charges: 0,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
  disable_rounded_total: false,
  apply_discount_on: "Grand Total",
  coupon_code: "",
  additional_discount_percentage: 0,
  discount_amount: 0,
  sales_partner: "",
  status: "Draft",
  items: [blankItem()],
});

function calculateQuotation(q: Quotation): Quotation {
  const items = q.items.map((i) => {
    const qty = Number(i.qty) || 0;
    const rate = Number(i.rate) || 0;
    const amount = round(qty * rate);
    return { ...i, qty, rate, amount };
  });
  const total = round(items.reduce((sum, i) => sum + i.amount, 0));
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const taxTotal = round(q.total_taxes_and_charges || 0);
  const baseForDiscount = q.apply_discount_on === "Net Total" ? total : total + taxTotal;
  const discount = q.additional_discount_percentage
    ? round((baseForDiscount * q.additional_discount_percentage) / 100)
    : round(q.discount_amount || 0);

  const grand = round(Math.max(0, total + taxTotal - discount));
  const rounded = q.disable_rounded_total ? grand : Math.round(grand);
  const adjustment = round(rounded - grand);

  return {
    ...q,
    items,
    total_qty: totalQty,
    total,
    discount_amount: discount,
    grand_total: grand,
    rounded_total: rounded,
    rounding_adjustment: adjustment,
  };
}

function Field({ label, name, children }: { label: string; name?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex rounded-full text-slate-400 hover:text-blue-600 focus-visible:outline-none"
              aria-label={`Info ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-xs">
            <p className="text-xs">Pengaturan untuk {label}.</p>
            {name && <p className="mt-1 text-[11px] opacity-75 font-mono">{name}</p>}
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

export function QuotationListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await quotationApi.list();
      setRows(data);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat daftar Quotation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const quotationColumns = useMemo<ColumnDef<Quotation>[]>(() => [
    { accessorKey: "quotation_number", header: "Quotation Number", cell: ({ row }) => row.original.quotation_number || row.original.id || "-", meta: { label: "Quotation Number", cellClassName: "font-semibold text-blue-600" } },
    { id: "customer", header: "Customer / Party Name", accessorFn: (row) => row.party_name || row.customer_name || "-", meta: { label: "Customer / Party Name", cellClassName: "font-medium" } },
    { accessorKey: "transaction_date", header: "Date", meta: { label: "Date" } },
    { accessorKey: "valid_till", header: "Valid Till", meta: { label: "Valid Till" } },
    { accessorKey: "grand_total", header: "Grand Total", cell: ({ row }) => money(row.original.grand_total), meta: { label: "Grand Total", cellClassName: "font-semibold" } },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={row.original.status === "Ordered" ? "default" : row.original.status === "Open" ? "secondary" : "outline"}>{row.original.status || "Draft"}</Badge>, meta: { label: "Status" } },
    { id: "actions", header: "Aksi", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => <Button aria-label={`Hapus ${row.original.quotation_number || row.original.id}`} variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600" onClick={(event) => { event.stopPropagation(); void handleDelete(row.original); }}><Trash2 className="size-4" /></Button>, meta: { headerClassName: "text-right", cellClassName: "text-right" } },
  ], []);

  const handleDelete = async (row: Quotation) => {
    if (!row.id || !confirm(`Hapus Quotation "${row.quotation_number || row.id}"?`)) return;
    try {
      await quotationApi.delete(row.id);
      toast.success("Quotation berhasil dihapus");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus Quotation");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/desk/selling" className="hover:underline">Selling</Link>
            <span>/</span>
            <span>Quotation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Quotation
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/desk/quotation/new")}>
            <Plus className="mr-1 size-4" /> Add Quotation
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-xs dark:bg-slate-900">
        <DataTable columns={quotationColumns} data={rows} getRowId={(row) => row.id || row.quotation_number || "quotation"} onRowClick={(row) => navigate(`/desk/quotation/${row.id}`)} searchPlaceholder="Cari quotation, nomor, customer..." emptyMessage={loading ? "Memuat quotation..." : "Belum ada quotation yang tersimpan."} />
      </div>
    </div>
  );
}

export function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-quotation");

  const [quotation, setQuotation] = useState<Quotation>(defaultQuotation());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Options states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [posItems, setPosItems] = useState<POSItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  useEffect(() => {
    // Load options
    customerApi.list().then(setCustomers).catch(() => {});
    posApi.listItems().then(setPosItems).catch(() => {});
    taxCategoryApi.list().then(setTaxCategories).catch(() => {});
    warehouseApi.listCompanies().then(setCompanies).catch(() => {});

    if (!isNew && id) {
      quotationApi
        .get(id)
        .then((data) => {
          if (data) {
            setQuotation(calculateQuotation(data));
          }
        })
        .catch((err: any) => {
          toast.error(err?.message || "Gagal memuat detail Quotation");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const customerOptions: SearchableSelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.customer_name,
      label: c.customer_name,
      sublabel: c.email || c.phone || undefined,
    }));
  }, [customers]);

  const itemOptions: SearchableSelectOption[] = useMemo(() => {
    return posItems.map((item) => ({
      value: item.item_code,
      label: `${item.item_code} - ${item.item_name}`,
      sublabel: money(item.rate),
    }));
  }, [posItems]);

  const taxCategoryOptions: SearchableSelectOption[] = useMemo(() => {
    return taxCategories.map((tc) => ({
      value: tc.title,
      label: tc.title,
      sublabel: tc.disabled ? "Disabled" : undefined,
    }));
  }, [taxCategories]);

  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return companies.map((c) => {
      const name = c.name || (c as any).company_name || "";
      return { value: name, label: name };
    });
  }, [companies]);

  const updateField = (field: keyof Quotation, value: any) => {
    setQuotation((prev) => calculateQuotation({ ...prev, [field]: value }));
  };

  const handleItemCodeChange = (index: number, itemCode: string) => {
    const selectedItem = posItems.find((i) => i.item_code === itemCode);
    setQuotation((prev) => {
      const nextItems = [...prev.items];
      const current = nextItems[index] || blankItem();
      const rate = selectedItem ? selectedItem.rate : current.rate;
      const itemName = selectedItem ? selectedItem.item_name : current.item_name;
      nextItems[index] = {
        ...current,
        item_code: itemCode,
        item_name: itemName,
        rate,
        amount: current.qty * rate,
      };
      return calculateQuotation({ ...prev, items: nextItems });
    });
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setQuotation((prev) => {
      const nextItems = [...prev.items];
      const current = nextItems[index] || blankItem();
      nextItems[index] = {
        ...current,
        qty,
        amount: qty * current.rate,
      };
      return calculateQuotation({ ...prev, items: nextItems });
    });
  };

  const handleItemRateChange = (index: number, rate: number) => {
    setQuotation((prev) => {
      const nextItems = [...prev.items];
      const current = nextItems[index] || blankItem();
      nextItems[index] = {
        ...current,
        rate,
        amount: current.qty * rate,
      };
      return calculateQuotation({ ...prev, items: nextItems });
    });
  };

  const handleAddItemRow = () => {
    setQuotation((prev) => calculateQuotation({ ...prev, items: [...prev.items, blankItem()] }));
  };

  const handleRemoveItemRow = (index: number) => {
    setQuotation((prev) => {
      const nextItems = prev.items.filter((_, i) => i !== index);
      return calculateQuotation({ ...prev, items: nextItems.length ? nextItems : [blankItem()] });
    });
  };

  const quotationItemColumns = useMemo<ColumnDef<QuotationItemRow>[]>(() => [
    { id: "row_number", header: "No.", cell: ({ row }) => row.index + 1, enableSorting: false, enableColumnFilter: false, meta: { headerClassName: "w-12 text-center", cellClassName: "text-center text-slate-400" } },
    { accessorKey: "item_code", header: "Item Code", cell: ({ row }) => <div><SearchableSelect value={row.original.item_code} options={itemOptions} onChange={(value) => handleItemCodeChange(row.original.sourceIndex, value)} placeholder="Pilih item code..." searchPlaceholder="Cari item code..." addNewLabel="Tambah Item Baru" addNewHref="/desk/item/new" />{row.original.item_name && <p className="mt-1 truncate text-[11px] text-slate-500">{row.original.item_name}</p>}</div>, meta: { label: "Item Code", headerClassName: "min-w-[280px]" } },
    { accessorKey: "qty", header: "Quantity", cell: ({ row }) => <Input type="number" min="1" step="1" value={row.original.qty} onChange={(event) => handleItemQtyChange(row.original.sourceIndex, parseFloat(event.target.value) || 0)} className="h-8 text-center text-xs" />, meta: { label: "Quantity", headerClassName: "w-32 text-center" } },
    { accessorKey: "rate", header: "Rate (IDR)", cell: ({ row }) => <Input type="number" min="0" step="1" value={row.original.rate} onChange={(event) => handleItemRateChange(row.original.sourceIndex, parseFloat(event.target.value) || 0)} className="h-8 text-right text-xs" />, meta: { label: "Rate (IDR)", headerClassName: "w-40 text-right" } },
    { accessorKey: "amount", header: "Amount (IDR)", cell: ({ row }) => money(row.original.amount), meta: { label: "Amount (IDR)", cellClassName: "text-right font-semibold" } },
    { id: "actions", header: "", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => <Button aria-label={`Hapus item ${row.index + 1}`} variant="ghost" size="icon" className="size-7 text-slate-400 hover:text-rose-600" onClick={() => handleRemoveItemRow(row.original.sourceIndex)}><Trash2 className="size-3.5" /></Button>, meta: { cellClassName: "text-center" } },
  ], [itemOptions]);

  const handleSave = async () => {
    if (!quotation.party_name.trim()) {
      toast.error("Customer wajib dipilih");
      return;
    }
    if (quotation.items.some((i) => !i.item_code.trim() || i.qty <= 0)) {
      toast.error("Setiap item harus memiliki Item Code dan Quantity lebih dari 0");
      return;
    }

    setSaving(true);
    const payload = calculateQuotation(quotation);
    try {
      if (isNew) {
        const created = await quotationApi.create(payload);
        toast.success("Quotation berhasil dibuat");
        navigate(`/desk/quotation/${created.id}`, { replace: true });
      } else if (id) {
        await quotationApi.update(id, payload);
        toast.success("Quotation berhasil diperbarui");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan Quotation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew || !confirm("Hapus Quotation ini?")) return;
    try {
      await quotationApi.delete(id);
      toast.success("Quotation dihapus");
      navigate("/desk/quotation");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus Quotation");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Quotation...</div>;
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/desk/quotation")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/selling" className="hover:underline">Selling</Link>
              <span>/</span>
              <Link to="/desk/quotation" className="hover:underline">Quotation</Link>
              <span>/</span>
              <span>{isNew ? "New Quotation" : quotation.quotation_number || id}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isNew ? "New Quotation" : quotation.quotation_number || id}
              </h1>
              <Badge variant={isNew ? "secondary" : "outline"}>
                {isNew ? "Not Saved" : quotation.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="icon" onClick={handleDelete}>
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="address">Address & Contact</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
          <TabsTrigger value="more">More Info</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab 1: Details */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Main Info Box */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Series" name="naming_series">
                <Input
                  value={quotation.naming_series}
                  onChange={(e) => updateField("naming_series", e.target.value)}
                  placeholder="SAL-QTN-.YYYY.-"
                />
              </Field>

              <Field label="Quotation To" name="quotation_to">
                <select
                  value={quotation.quotation_to}
                  onChange={(e) => updateField("quotation_to", e.target.value)}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-slate-900"
                >
                  <option value="Customer">Customer</option>
                  <option value="Lead">Lead</option>
                </select>
              </Field>

              <Field label="Customer" name="party_name">
                <SearchableSelect
                  value={quotation.party_name}
                  options={customerOptions}
                  onChange={(val) => {
                    updateField("party_name", val);
                    updateField("customer_name", val);
                  }}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari customer..."
                  addNewLabel="Tambah Customer Baru"
                  addNewHref="/desk/customer/new"
                />
              </Field>

              <Field label="Date" name="transaction_date">
                <Input
                  type="date"
                  value={dateForInput(quotation.transaction_date)}
                  onChange={(e) => updateField("transaction_date", e.target.value)}
                />
              </Field>

              <Field label="Valid Till" name="valid_till">
                <Input
                  type="date"
                  value={dateForInput(quotation.valid_till)}
                  onChange={(e) => updateField("valid_till", e.target.value)}
                />
              </Field>

              <Field label="Order Type" name="order_type">
                <select
                  value={quotation.order_type}
                  onChange={(e) => updateField("order_type", e.target.value)}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-slate-900"
                >
                  <option value="Sales">Sales</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Shopping Cart">Shopping Cart</option>
                </select>
              </Field>

              <Field label="Company" name="company">
                <CompanySelect
                  value={quotation.company}
                  onChange={(val) => updateField("company", val)}
                  placeholder="Begin typing for results."
                />
              </Field>
            </div>
          </div>

          {/* Currency and Price List */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
              Currency and Price List
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Currency" name="currency">
                <Input
                  value={quotation.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  placeholder="IDR"
                />
              </Field>
              <Field label="Price List" name="selling_price_list">
                <Input
                  value={quotation.selling_price_list}
                  onChange={(e) => updateField("selling_price_list", e.target.value)}
                  placeholder="Standard Selling"
                />
              </Field>
            </div>
          </div>

          {/* Barcode Section */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
              Scan Barcode
            </h3>
            <Input
              value={quotation.scan_barcode || ""}
              onChange={(e) => updateField("scan_barcode", e.target.value)}
              placeholder="Scan Barcode item..."
            />
          </div>

          {/* Items Section */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Items</h3>
                <p className="text-xs text-slate-500">Daftar item produk yang ditawarkan.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddItemRow}>
                <Plus className="mr-1 size-3.5" /> Add Row
              </Button>
            </div>

            <div className="rounded-xl border p-2">
              <DataTable columns={quotationItemColumns} data={quotation.items.map((item, sourceIndex) => ({ ...item, sourceIndex }))} getRowId={(item) => String(item.sourceIndex)} toolbar={false} pagination={false} />
            </div>
            {/* legacy table retained below only as a reference during migration */}
            {/*
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-semibold text-slate-600 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 w-12 text-center">No.</th>
                    <th className="p-3 min-w-[280px]">Item Code</th>
                    <th className="p-3 w-32 text-center">Quantity</th>
                    <th className="p-3 w-40 text-right">Rate (IDR)</th>
                    <th className="p-3 w-44 text-right">Amount (IDR)</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {quotation.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3">
                        <SearchableSelect
                          value={it.item_code}
                          options={itemOptions}
                          onChange={(val) => handleItemCodeChange(idx, val)}
                          placeholder="Pilih item code..."
                          searchPlaceholder="Cari item code..."
                          addNewLabel="Tambah Item Baru"
                          addNewHref="/desk/item/new"
                        />
                        {it.item_name && (
                          <p className="mt-1 truncate text-[11px] text-slate-500">{it.item_name}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={it.qty}
                          onChange={(e) => handleItemQtyChange(idx, parseFloat(e.target.value) || 0)}
                          className="h-8 text-center text-xs"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={it.rate}
                          onChange={(e) => handleItemRateChange(idx, parseFloat(e.target.value) || 0)}
                          className="h-8 text-right text-xs"
                        />
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-900 dark:text-white">
                        {money(it.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-rose-600"
                          onClick={() => handleRemoveItemRow(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            */}

            {/* Total Items Summary */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-3 text-xs border-t">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-bold text-slate-900 dark:text-white">{quotation.total_qty}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Total (IDR):</span>
                <span className="font-bold text-slate-900 dark:text-white">{money(quotation.total)}</span>
              </div>
            </div>
          </div>

          {/* Taxes and Charges */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Taxes and Charges
            </h3>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Tax Category" name="tax_category">
                <SearchableSelect
                  value={quotation.tax_category || ""}
                  options={taxCategoryOptions}
                  onChange={(val) => updateField("tax_category", val)}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari Tax Category..."
                  addNewLabel="Tambah Tax Category"
                  addNewHref="/desk/tax-category/new"
                />
              </Field>

              <Field label="Sales Taxes and Charges Template" name="taxes_and_charges">
                <Input
                  value={quotation.taxes_and_charges || ""}
                  onChange={(e) => updateField("taxes_and_charges", e.target.value)}
                  placeholder="Begin typing for results."
                />
              </Field>

              <Field label="Shipping Rule" name="shipping_rule">
                <Input
                  value={quotation.shipping_rule || ""}
                  onChange={(e) => updateField("shipping_rule", e.target.value)}
                  placeholder="Begin typing for results."
                />
              </Field>

              <Field label="Incoterm" name="incoterm">
                <Input
                  value={quotation.incoterm || ""}
                  onChange={(e) => updateField("incoterm", e.target.value)}
                  placeholder="Begin typing for results."
                />
              </Field>
            </div>

            <div className="flex justify-between items-center pt-3 border-t text-xs">
              <span className="text-slate-500">Total Taxes and Charges (IDR):</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {money(quotation.total_taxes_and_charges)}
              </span>
            </div>
          </div>

          {/* Totals Section */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Totals</h3>

            <div className="grid gap-4 max-w-md ml-auto text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Grand Total:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {money(quotation.grand_total)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Rounding Adjustment:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {money(quotation.rounding_adjustment)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Rounded Total:
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {money(quotation.rounded_total)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="disable-rounded-total"
                  checked={quotation.disable_rounded_total}
                  onCheckedChange={(v) => updateField("disable_rounded_total", Boolean(v))}
                />
                <label
                  htmlFor="disable-rounded-total"
                  className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Disable Rounded Total
                </label>
              </div>
            </div>
          </div>

          {/* Additional Discount */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Additional Discount
            </h3>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Apply Additional Discount On" name="apply_discount_on">
                <select
                  value={quotation.apply_discount_on}
                  onChange={(e) => updateField("apply_discount_on", e.target.value)}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-slate-900"
                >
                  <option value="Grand Total">Grand Total</option>
                  <option value="Net Total">Net Total</option>
                </select>
              </Field>

              <Field label="Coupon Code" name="coupon_code">
                <Input
                  value={quotation.coupon_code || ""}
                  onChange={(e) => updateField("coupon_code", e.target.value)}
                  placeholder="Begin typing for results."
                />
              </Field>

              <Field label="Additional Discount Percentage" name="additional_discount_percentage">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={quotation.additional_discount_percentage}
                  onChange={(e) =>
                    updateField("additional_discount_percentage", parseFloat(e.target.value) || 0)
                  }
                />
              </Field>

              <Field label="Additional Discount Amount (IDR)" name="discount_amount">
                <Input
                  type="number"
                  min="0"
                  value={quotation.discount_amount}
                  onChange={(e) => updateField("discount_amount", parseFloat(e.target.value) || 0)}
                />
              </Field>
            </div>

            <div className="pt-3 border-t">
              <Field label="Referral Sales Partner" name="sales_partner">
                <Input
                  value={quotation.sales_partner || ""}
                  onChange={(e) => updateField("sales_partner", e.target.value)}
                  placeholder="Nama Sales Partner..."
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Address & Contact */}
      {activeTab === "address" && (
        <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Address & Contact</h3>
          <p className="text-xs text-slate-500">
            Alamat penagihan dan pengiriman yang diasosiasikan dengan Customer {quotation.party_name || ""}.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Customer Address</Label>
              <textarea
                className="mt-1 w-full rounded-md border p-3 text-xs dark:bg-slate-900"
                rows={4}
                placeholder="Alamat customer..."
              />
            </div>
            <div>
              <Label className="text-xs">Shipping Address</Label>
              <textarea
                className="mt-1 w-full rounded-md border p-3 text-xs dark:bg-slate-900"
                rows={4}
                placeholder="Alamat pengiriman..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Terms */}
      {activeTab === "terms" && (
        <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Terms and Conditions</h3>
          <textarea
            className="w-full rounded-md border p-3 text-xs dark:bg-slate-900"
            rows={6}
            placeholder="Syarat dan ketentuan penawaran..."
          />
        </div>
      )}

      {/* Tab 4: More Info */}
      {activeTab === "more" && (
        <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">More Info</h3>
          <div className="grid gap-4 md:grid-cols-2 text-xs">
            <div>
              <Label>Status</Label>
              <select
                value={quotation.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="mt-1 w-full rounded-md border p-2 dark:bg-slate-900"
              >
                <option value="Draft">Draft</option>
                <option value="Open">Open</option>
                <option value="Replied">Replied</option>
                <option value="Ordered">Ordered</option>
                <option value="Lost">Lost</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuotationPage() {
  const location = useLocation();
  const { id } = useParams();
  const isForm = location.pathname.includes("/new") || Boolean(id);

  return isForm ? <QuotationFormPage /> : <QuotationListPage />;
}
