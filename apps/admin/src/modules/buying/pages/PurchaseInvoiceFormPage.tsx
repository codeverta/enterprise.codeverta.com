import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Barcode, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelect } from "@/components/CompanySelect";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
buyingApi,
dateForApi,
  dateForInput,
  type PurchaseInvoice,
  type PurchaseInvoiceItem,
  type PurchaseInvoiceOptions,
  type PurchaseInvoiceTax,
} from "../api";

type Tab = "details" | "payments" | "address" | "terms" | "more";

const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
const localTime = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
const dueDate = () => {
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return localDate(value);
};
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const blankItem = (): PurchaseInvoiceItem => ({
  item_code: "",
  item_name: "",
  description: "",
  accepted_qty: 1,
  uom: "Unit",
  rate: 0,
  amount: 0,
  warehouse: "",
});

const blankTax = (): PurchaseInvoiceTax => ({
  add_deduct: "add",
  charge_type: "on_net_total",
  account_head: "",
  description: "",
  rate: 0,
  net_amount: 0,
  tax_amount: 0,
  total: 0,
});

const emptyInvoice = (): PurchaseInvoice => ({
  naming_series: "ACC-PINV-.YYYY.-",
  status: "draft",
  supplier: "",
  company: "",
  posting_date: localDate(),
  posting_time: localTime(),
  set_posting_time: false,
  due_date: dueDate(),
  is_paid: false,
  is_return: false,
  apply_tds: false,
  bill_no: "",
  bill_date: null,
  cost_center: "",
  project: "",
  currency: "IDR",
  use_transaction_date_exchange_rate: false,
  buying_price_list: "Standard Buying",
  ignore_pricing_rule: false,
  update_stock: false,
  is_subcontracted: false,
  tax_category: "",
  taxes_and_charges: "",
  shipping_rule: "",
  incoterm: "",
  total_qty: 0,
  total: 0,
  base_taxes_and_charges_added: 0,
  base_taxes_and_charges_deducted: 0,
  base_total_taxes_and_charges: 0,
  taxes_and_charges_added: 0,
  taxes_and_charges_deducted: 0,
  total_taxes_and_charges: 0,
  use_company_roundoff_cost_center: false,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
  total_advance: 0,
  apply_discount_on: "grand_total",
  additional_discount_percentage: 0,
  additional_discount_amount: 0,
  mode_of_payment: "",
  cash_bank_account: "",
  paid_amount: 0,
  supplier_address: "",
  shipping_address: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  terms: "",
  payment_terms_template: "",
  letter_head: "",
  remarks: "",
  items: [blankItem()],
  taxes: [],
});

const initialOptions: PurchaseInvoiceOptions = {
  companies: [],
  suppliers: [],
  warehouses: [],
  items: [],
  cost_centers: [],
  projects: [],
  currencies: ["IDR", "USD", "SGD", "EUR"],
  price_lists: ["Standard Buying"],
  uoms: ["Unit", "Pcs", "Box", "Kg", "Meter", "Set"],
  modes_of_payment: ["Cash", "Bank Transfer", "Credit Card", "Cheque"],
  accounts: [],
};

function calculate(invoice: PurchaseInvoice): PurchaseInvoice {
  const sign = invoice.is_return ? -1 : 1;
  const items = invoice.items.map((item) => ({ ...item, amount: round(item.accepted_qty * item.rate) }));
  const totalQty = items.reduce((sum, item) => sum + (Number(item.accepted_qty) || 0), 0);
  const total = round(items.reduce((sum, item) => sum + item.amount, 0) * sign);
  let running = total,
    added = 0,
    deducted = 0;
  const taxes = invoice.taxes.map((tax) => {
    const base = Math.abs(tax.charge_type === "on_previous_row_total" ? running : total);
    const amount = round(
      (tax.charge_type === "actual" ? Math.abs(tax.tax_amount) : (base * (Number(tax.rate) || 0)) / 100) *
        sign
    );
    if (tax.add_deduct === "deduct") {
      deducted += amount;
      running -= amount;
    } else {
      added += amount;
      running += amount;
    }
    return { ...tax, net_amount: total, tax_amount: amount, total: round(running) };
  });
  added = round(added);
  deducted = round(deducted);
  const taxTotal = round(added - deducted),
    beforeDiscount = round(total + taxTotal);
  const discountBase = invoice.apply_discount_on === "net_total" ? total : beforeDiscount;
  const discount =
    invoice.additional_discount_percentage > 0
      ? round((Math.abs(discountBase) * invoice.additional_discount_percentage) / 100)
      : round(invoice.additional_discount_amount);
  const grandTotal = round(beforeDiscount - sign * discount),
    roundedTotal = Math.round(grandTotal);
  return {
    ...invoice,
    items,
    taxes,
    total_qty: totalQty,
    total,
    taxes_and_charges_added: added,
    taxes_and_charges_deducted: deducted,
    total_taxes_and_charges: taxTotal,
    base_taxes_and_charges_added: added,
    base_taxes_and_charges_deducted: deducted,
    base_total_taxes_and_charges: taxTotal,
    additional_discount_amount: discount,
    grand_total: grandTotal,
    rounded_total: roundedTotal,
    rounding_adjustment: round(roundedTotal - grandTotal),
    paid_amount: invoice.is_paid ? Math.abs(roundedTotal) : invoice.paid_amount,
  };
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value || 0);

function Field({
  label,
  name,
  children,
  required,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {name && <p className="text-[11px] text-slate-400">{name}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-0 first:pt-0">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function Combo({
  value,
  values,
  onChange,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  const id = useMemo(() => `list-${Math.random().toString(36).slice(2)}`, []);
  return (
    <>
      <Input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Begin typing for results."
      />
      <datalist id={id}>
        {values.map((option) => (
          <ERPSelectOption key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

function Check({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  name: string;
}) {
  return (
    <div className="flex items-start gap-2 pt-2">
      <Checkbox id={name} checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
      <div>
        <Label htmlFor={name} className="cursor-pointer">{label}</Label>
        <p className="text-[11px] text-slate-400">{name}</p>
      </div>
    </div>
  );
}

function Summary({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <strong>{money(value, currency)}</strong>
    </div>
  );
}

export default function PurchaseInvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [tab, setTab] = useState<Tab>("details");
  const [invoice, setInvoice] = useState<PurchaseInvoice>(emptyInvoice);
  const [options, setOptions] = useState(initialOptions);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [scan, setScan] = useState("");

  useEffect(() => {
    buyingApi
      .invoiceOptions()
      .then((data) => setOptions({ ...initialOptions, ...data }))
      .catch(() => undefined);
    if (!isNew && id) {
      setLoading(true);
      buyingApi
        .invoiceGet(id)
        .then((data) =>
          setInvoice(
            calculate({
              ...emptyInvoice(),
              ...data,
              posting_date: dateForInput(data.posting_date),
              due_date: dateForInput(data.due_date),
              bill_date: data.bill_date ? dateForInput(data.bill_date) : null,
              items: data.items || [],
              taxes: data.taxes || [],
            })
          )
        )
        .catch((error: any) => {
          toast.error(error?.response?.data?.error || "Purchase Invoice tidak ditemukan");
          navigate("/desk/purchase-invoice");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const update = <K extends keyof PurchaseInvoice>(key: K, value: PurchaseInvoice[K]) =>
    setInvoice((current) => calculate({ ...current, [key]: value }));

  const updateItem = (index: number, patch: Partial<PurchaseInvoiceItem>) =>
    setInvoice((current) =>
      calculate({
        ...current,
        items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      })
    );

  const updateTax = (index: number, patch: Partial<PurchaseInvoiceTax>) =>
    setInvoice((current) =>
      calculate({
        ...current,
        taxes: current.taxes.map((tax, i) => (i === index ? { ...tax, ...patch } : tax)),
      })
    );

  const addScannedItem = () => {
    if (!scan.trim()) return;
    setInvoice((current) =>
      calculate({
        ...current,
        items: [...current.items, { ...blankItem(), item_code: scan.trim() }],
      })
    );
    setScan("");
  };

  const payload = () => ({
    ...calculate(invoice),
    posting_date: dateForApi(invoice.posting_date),
    due_date: dateForApi(invoice.due_date),
    bill_date: invoice.bill_date ? dateForApi(invoice.bill_date) : null,
  });

  const validate = () =>
    !invoice.supplier.trim()
      ? "Supplier wajib diisi"
      : !invoice.company.trim()
      ? "Company wajib diisi"
      : !invoice.due_date
      ? "Due Date wajib diisi"
      : invoice.items.some((item) => !item.item_code.trim() || item.accepted_qty <= 0 || !item.uom)
      ? "Lengkapi Item, Accepted Qty, dan UOM pada semua baris"
      : invoice.taxes.some((tax) => !tax.account_head.trim())
      ? "Account Head pajak wajib diisi"
      : "";

  const save = async () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const saved = isNew ? await buyingApi.invoiceCreate(payload()) : await buyingApi.invoiceUpdate(id!, payload());
      toast.success(isNew ? "Purchase Invoice berhasil dibuat" : "Purchase Invoice berhasil disimpan");
      navigate(`/desk/purchase-invoice/${saved.id}`, { replace: true });
      setInvoice(
        calculate({
          ...saved,
          posting_date: dateForInput(saved.posting_date),
          due_date: dateForInput(saved.due_date),
          bill_date: saved.bill_date ? dateForInput(saved.bill_date) : null,
        })
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Purchase Invoice");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!id || !window.confirm("Submit Purchase Invoice ini? Dokumen tidak dapat diedit setelah submit.")) return;
    setSaving(true);
    try {
      await buyingApi.invoiceSubmit(id);
      update("status", "submitted");
      toast.success("Purchase Invoice berhasil disubmit");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal submit Purchase Invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-sm text-slate-500">Memuat Purchase Invoice...</div>;

  const editable = isNew || invoice.status === "draft";
  const tabs: Array<[Tab, string]> = [
    ["details", "Details"],
    ["payments", "Payments"],
    ["address", "Address & Contact"],
    ["terms", "Terms"],
    ["more", "More Info"],
  ];

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
      <header className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/purchase-invoice">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">Buying / Purchase Invoice</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold">{isNew ? "New Purchase Invoice" : invoice.number}</h1>
              <Badge
                variant={isNew ? "secondary" : invoice.status === "submitted" ? "default" : "outline"}
                className={invoice.status === "submitted" ? "bg-emerald-600" : ""}
              >
                {isNew ? "Not Saved" : invoice.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && invoice.status === "draft" && (
            <Button variant="outline" onClick={submit} disabled={saving}>
              <Send className="size-4" /> Submit
            </Button>
          )}
          {editable && (
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
            {tabs.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-8 p-5 lg:p-7">
          <fieldset disabled={!editable} className="space-y-8">
            {tab === "details" && (
              <>
                <Section title="Series">
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="Series" name="naming_series" required>
                      <Input
                        value={invoice.naming_series}
                        onChange={(e) => update("naming_series", e.target.value)}
                      />
                    </Field>
                    <Field label="Supplier" name="supplier" required>
                      <Combo
                        value={invoice.supplier}
                        values={options.suppliers}
                        onChange={(v) => update("supplier", v)}
                      />
                    </Field>
                    <Field label="Company" name="company" required>
                      <CompanySelect
                        value={invoice.company}
                        onChange={(v) => update("company", v)}
                      />
                    </Field>
                    <Field label="Posting Date" name="posting_date">
                      <Input
                        type="date"
                        value={invoice.posting_date}
                        onChange={(e) => update("posting_date", e.target.value)}
                      />
                    </Field>
                    <Field label="Posting Time" name="posting_time">
                      <Input
                        type="time"
                        step="1"
                        value={invoice.posting_time}
                        onChange={(e) => update("posting_time", e.target.value)}
                      />
                    </Field>
                    <Field label="Due Date" name="due_date">
                      <Input
                        type="date"
                        value={invoice.due_date}
                        onChange={(e) => update("due_date", e.target.value)}
                      />
                    </Field>
                    <Check
                      checked={invoice.set_posting_time}
                      onChange={(v) => update("set_posting_time", v)}
                      label="Edit Posting Date and Time"
                      name="set_posting_time"
                    />
                    <Check
                      checked={invoice.is_paid}
                      onChange={(v) => update("is_paid", v)}
                      label="Is Paid"
                      name="is_paid"
                    />
                    <Check
                      checked={invoice.is_return}
                      onChange={(v) => update("is_return", v)}
                      label="Is Return (Debit Note)"
                      name="is_return"
                    />
                    <Check
                      checked={invoice.apply_tds}
                      onChange={(v) => update("apply_tds", v)}
                      label="Consider for Tax Withholding"
                      name="apply_tds"
                    />
                  </div>
                </Section>

                <Section title="Supplier Invoice">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Supplier Invoice No" name="bill_no">
                      <Input value={invoice.bill_no} onChange={(e) => update("bill_no", e.target.value)} />
                    </Field>
                    <Field label="Supplier Invoice Date" name="bill_date">
                      <Input
                        type="date"
                        value={invoice.bill_date || ""}
                        onChange={(e) => update("bill_date", e.target.value || null)}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Accounting Dimensions">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Cost Center" name="cost_center">
                      <Combo
                        value={invoice.cost_center}
                        values={options.cost_centers}
                        onChange={(v) => update("cost_center", v)}
                      />
                    </Field>
                    <Field label="Project" name="project">
                      <Combo
                        value={invoice.project}
                        values={options.projects}
                        onChange={(v) => update("project", v)}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Currency and Price List">
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="Currency" name="currency">
                      <Combo
                        value={invoice.currency}
                        values={options.currencies}
                        onChange={(v) => update("currency", v)}
                      />
                    </Field>
                    <Field label="Price List" name="buying_price_list">
                      <Combo
                        value={invoice.buying_price_list}
                        values={options.price_lists}
                        onChange={(v) => update("buying_price_list", v)}
                      />
                    </Field>
                    <Check
                      checked={invoice.use_transaction_date_exchange_rate}
                      onChange={(v) => update("use_transaction_date_exchange_rate", v)}
                      label="Use Transaction Date Exchange Rate"
                      name="use_transaction_date_exchange_rate"
                    />
                    <Check
                      checked={invoice.ignore_pricing_rule}
                      onChange={(v) => update("ignore_pricing_rule", v)}
                      label="Ignore Pricing Rule"
                      name="ignore_pricing_rule"
                    />
                  </div>
                </Section>

                <Section title="Items">
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="Scan Barcode" name="scan_barcode">
                      <div className="flex gap-2">
                        <Input
                          value={scan}
                          onChange={(e) => setScan(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addScannedItem();
                            }
                          }}
                        />
                        <Button type="button" variant="outline" onClick={addScannedItem}>
                          <Barcode className="size-4" />
                        </Button>
                      </div>
                    </Field>
                    <Check
                      checked={invoice.update_stock}
                      onChange={(v) => update("update_stock", v)}
                      label="Update Stock"
                      name="update_stock"
                    />
                    <Check
                      checked={invoice.is_subcontracted}
                      onChange={(v) => update("is_subcontracted", v)}
                      label="Is Subcontracted"
                      name="is_subcontracted"
                    />
                  </div>

                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                        <tr>
                          <th className="w-12 p-3">No.</th>
                          <th className="p-3 text-left">Item</th>
                          <th className="p-3 text-left">Accepted Qty</th>
                          <th className="p-3 text-left">UOM</th>
                          <th className="p-3 text-left">Rate ({invoice.currency})</th>
                          <th className="p-3 text-right">Amount ({invoice.currency})</th>
                          <th className="w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-3 text-center">{index + 1}</td>
                            <td className="p-2">
                              <Combo
                                value={item.item_code}
                                values={options.items}
                                onChange={(v) => updateItem(index, { item_code: v })}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0.000001"
                                step="any"
                                value={item.accepted_qty}
                                onChange={(e) =>
                                  updateItem(index, { accepted_qty: Number(e.target.value) })
                                }
                              />
                            </td>
                            <td className="p-2">
                              <Combo
                                value={item.uom}
                                values={options.uoms}
                                onChange={(v) => updateItem(index, { uom: v })}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.rate}
                                onChange={(e) => updateItem(index, { rate: Number(e.target.value) })}
                              />
                            </td>
                            <td className="p-3 text-right font-medium">
                              {money(item.amount, invoice.currency)}
                            </td>
                            <td className="p-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={invoice.items.length === 1}
                                onClick={() =>
                                  setInvoice((current) =>
                                    calculate({
                                      ...current,
                                      items: current.items.filter((_, i) => i !== index),
                                    })
                                  )
                                }
                              >
                                <Trash2 className="size-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setInvoice((current) =>
                        calculate({ ...current, items: [...current.items, blankItem()] })
                      )
                    }
                  >
                    <Plus className="size-4" /> Add Row
                  </Button>
                  <div className="ml-auto max-w-md">
                    <div className="flex justify-between border-b py-2 text-sm">
                      <span className="text-slate-500">Total Quantity</span>
                      <strong>{invoice.total_qty}</strong>
                    </div>
                    <Summary label={`Total (${invoice.currency})`} value={invoice.total} currency={invoice.currency} />
                  </div>
                </Section>

                <Section title="Taxes and Charges">
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                    <Field label="Tax Category" name="tax_category">
                      <Input
                        value={invoice.tax_category}
                        onChange={(e) => update("tax_category", e.target.value)}
                      />
                    </Field>
                    <Field label="Purchase Taxes and Charges Template" name="taxes_and_charges">
                      <Input
                        value={invoice.taxes_and_charges}
                        onChange={(e) => update("taxes_and_charges", e.target.value)}
                      />
                    </Field>
                    <Field label="Shipping Rule" name="shipping_rule">
                      <Input
                        value={invoice.shipping_rule}
                        onChange={(e) => update("shipping_rule", e.target.value)}
                      />
                    </Field>
                    <Field label="Incoterm" name="incoterm">
                      <Input
                        value={invoice.incoterm}
                        onChange={(e) => update("incoterm", e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-[1000px] w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                        <tr>
                          <th className="p-3">No.</th>
                          <th className="p-3 text-left">Add / Deduct</th>
                          <th className="p-3 text-left">Type</th>
                          <th className="p-3 text-left">Account Head</th>
                          <th className="p-3">Tax Rate</th>
                          <th className="p-3 text-right">Net Amount</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-right">Total</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.taxes.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-500">
                              No rows
                            </td>
                          </tr>
                        ) : (
                          invoice.taxes.map((tax, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2 text-center">{index + 1}</td>
                              <td className="p-2">
                                <ERPSelect
                                  className="h-9 rounded-md border bg-transparent px-2"
                                  value={tax.add_deduct}
                                  onChange={(e) =>
                                    updateTax(index, {
                                      add_deduct: e.target.value as "add" | "deduct",
                                    })
                                  }
                                >
                                  <ERPSelectOption value="add">Add</ERPSelectOption>
                                  <ERPSelectOption value="deduct">Deduct</ERPSelectOption>
                                </ERPSelect>
                              </td>
                              <td className="p-2">
                                <ERPSelect
                                  className="h-9 rounded-md border bg-transparent px-2"
                                  value={tax.charge_type}
                                  onChange={(e) =>
                                    updateTax(index, {
                                      charge_type: e.target.value as PurchaseInvoiceTax["charge_type"],
                                    })
                                  }
                                >
                                  <ERPSelectOption value="actual">Actual</ERPSelectOption>
                                  <ERPSelectOption value="on_net_total">On Net Total</ERPSelectOption>
                                  <ERPSelectOption value="on_previous_row_total">On Previous Row Total</ERPSelectOption>
                                </ERPSelect>
                              </td>
                              <td className="p-2">
                                <Input
                                  value={tax.account_head}
                                  onChange={(e) => updateTax(index, { account_head: e.target.value })}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="any"
                                  value={tax.rate}
                                  onChange={(e) =>
                                    updateTax(index, { rate: Number(e.target.value) })
                                  }
                                />
                              </td>
                              <td className="p-2 text-right">
                                {money(tax.net_amount, invoice.currency)}
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="any"
                                  value={tax.tax_amount}
                                  disabled={tax.charge_type !== "actual"}
                                  onChange={(e) =>
                                    updateTax(index, { tax_amount: Number(e.target.value) })
                                  }
                                />
                              </td>
                              <td className="p-2 text-right">
                                {money(tax.total, invoice.currency)}
                              </td>
                              <td>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setInvoice((current) =>
                                      calculate({
                                        ...current,
                                        taxes: current.taxes.filter((_, i) => i !== index),
                                      })
                                    )
                                  }
                                >
                                  <Trash2 className="size-4 text-red-500" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setInvoice((current) =>
                        calculate({ ...current, taxes: [...current.taxes, blankTax()] })
                      )
                    }
                  >
                    <Plus className="size-4" /> Add Row
                  </Button>

                  <div className="ml-auto max-w-lg">
                    <Summary
                      label="Taxes and Charges Added (IDR)"
                      value={invoice.base_taxes_and_charges_added}
                      currency="IDR"
                    />
                    <Summary
                      label="Taxes and Charges Deducted (IDR)"
                      value={invoice.base_taxes_and_charges_deducted}
                      currency="IDR"
                    />
                    <Summary
                      label="Total Taxes and Charges (IDR)"
                      value={invoice.base_total_taxes_and_charges}
                      currency="IDR"
                    />
                    {invoice.currency !== "IDR" && (
                      <>
                        <Summary
                          label={`Taxes and Charges Added (${invoice.currency})`}
                          value={invoice.taxes_and_charges_added}
                          currency={invoice.currency}
                        />
                        <Summary
                          label={`Taxes and Charges Deducted (${invoice.currency})`}
                          value={invoice.taxes_and_charges_deducted}
                          currency={invoice.currency}
                        />
                        <Summary
                          label={`Total Taxes and Charges (${invoice.currency})`}
                          value={invoice.total_taxes_and_charges}
                          currency={invoice.currency}
                        />
                      </>
                    )}
                  </div>
                </Section>

                <Section title={`Totals (${invoice.currency})`}>
                  <Check
                    checked={invoice.use_company_roundoff_cost_center}
                    onChange={(v) => update("use_company_roundoff_cost_center", v)}
                    label="Use Company Default Round Off Cost Center"
                    name="use_company_roundoff_cost_center"
                  />
                  <div className="ml-auto max-w-lg">
                    <Summary label="Grand Total" value={invoice.grand_total} currency={invoice.currency} />
                    <Summary label="Rounding Adjustment" value={invoice.rounding_adjustment} currency={invoice.currency} />
                    <Summary label="Rounded Total" value={invoice.rounded_total} currency={invoice.currency} />
                    <Summary label={`Total Advance (${invoice.currency})`} value={invoice.total_advance} currency={invoice.currency} />
                  </div>
                  <h3 className="text-sm font-semibold">Additional Discount</h3>
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="Apply Additional Discount On" name="apply_discount_on">
                      <ERPSelect
                        className="h-9 w-full rounded-md border bg-transparent px-3"
                        value={invoice.apply_discount_on}
                        onChange={(e) =>
                          update(
                            "apply_discount_on",
                            e.target.value as PurchaseInvoice["apply_discount_on"]
                          )
                        }
                      >
                        <ERPSelectOption value="grand_total">Grand Total</ERPSelectOption>
                        <ERPSelectOption value="net_total">Net Total</ERPSelectOption>
                      </ERPSelect>
                    </Field>
                    <Field label="Additional Discount Percentage" name="additional_discount_percentage">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={invoice.additional_discount_percentage}
                        onChange={(e) => update("additional_discount_percentage", Number(e.target.value))}
                      />
                    </Field>
                    <Field label={`Additional Discount Amount (${invoice.currency})`} name="additional_discount_amount">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={invoice.additional_discount_amount}
                        disabled={invoice.additional_discount_percentage > 0}
                        onChange={(e) => update("additional_discount_amount", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {tab === "payments" && (
              <>
                <Section title="Payment">
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    <Check
                      checked={invoice.is_paid}
                      onChange={(v) => update("is_paid", v)}
                      label="Is Paid"
                      name="is_paid"
                    />
                    <Field label="Mode of Payment" name="mode_of_payment">
                      <Combo
                        value={invoice.mode_of_payment}
                        values={options.modes_of_payment}
                        onChange={(v) => update("mode_of_payment", v)}
                      />
                    </Field>
                    <Field label="Cash / Bank Account" name="cash_bank_account">
                      <Combo
                        value={invoice.cash_bank_account}
                        values={options.accounts}
                        onChange={(v) => update("cash_bank_account", v)}
                      />
                    </Field>
                    <Field label={`Paid Amount (${invoice.currency})`} name="paid_amount">
                      <Input
                        type="number"
                        min="0"
                        value={invoice.paid_amount}
                        onChange={(e) => update("paid_amount", Number(e.target.value))}
                        disabled={invoice.is_paid}
                      />
                    </Field>
                    <Field label={`Total Advance (${invoice.currency})`} name="total_advance">
                      <Input
                        type="number"
                        min="0"
                        value={invoice.total_advance}
                        onChange={(e) => update("total_advance", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Payment Terms Template" name="payment_terms_template">
                      <Input
                        value={invoice.payment_terms_template}
                        onChange={(e) => update("payment_terms_template", e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>
                <div className="ml-auto max-w-lg">
                  <Summary
                    label="Outstanding Amount"
                    value={Math.max(
                      0,
                      Math.abs(invoice.rounded_total) - invoice.paid_amount - invoice.total_advance
                    )}
                    currency={invoice.currency}
                  />
                </div>
              </>
            )}

            {tab === "address" && (
              <>
                <Section title="Address">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Supplier Address" name="supplier_address">
                      <Textarea
                        value={invoice.supplier_address}
                        onChange={(e) => update("supplier_address", e.target.value)}
                      />
                    </Field>
                    <Field label="Shipping Address" name="shipping_address">
                      <Textarea
                        value={invoice.shipping_address}
                        onChange={(e) => update("shipping_address", e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>
                <Section title="Contact">
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="Contact Person" name="contact_person">
                      <Input
                        value={invoice.contact_person}
                        onChange={(e) => update("contact_person", e.target.value)}
                      />
                    </Field>
                    <Field label="Contact Email" name="contact_email">
                      <Input
                        type="email"
                        value={invoice.contact_email}
                        onChange={(e) => update("contact_email", e.target.value)}
                      />
                    </Field>
                    <Field label="Contact Phone" name="contact_phone">
                      <Input
                        value={invoice.contact_phone}
                        onChange={(e) => update("contact_phone", e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {tab === "terms" && (
              <Section title="Terms">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Payment Terms Template" name="payment_terms_template">
                    <Input
                      value={invoice.payment_terms_template}
                      onChange={(e) => update("payment_terms_template", e.target.value)}
                    />
                  </Field>
                  <Field label="Terms" name="terms">
                    <Textarea
                      className="min-h-40"
                      value={invoice.terms}
                      onChange={(e) => update("terms", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>
            )}

            {tab === "more" && (
              <Section title="More Info">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Letter Head" name="letter_head">
                    <Input
                      value={invoice.letter_head}
                      onChange={(e) => update("letter_head", e.target.value)}
                    />
                  </Field>
                  <Field label="Status">
                    <Input value={isNew ? "Not Saved" : invoice.status} disabled />
                  </Field>
                  <Field label="Remarks" name="remarks">
                    <Textarea
                      className="min-h-32"
                      value={invoice.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>
            )}
          </fieldset>
        </div>
      </div>
    </div>
  );
}
