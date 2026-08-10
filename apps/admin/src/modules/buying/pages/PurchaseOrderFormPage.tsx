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
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import {
  buyingApi,
  dateForApi,
  dateForInput,
  type BuyingOptions,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderTax,
} from "../api";

type Tab = "details" | "address" | "terms" | "more";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const blankItem = (scheduleDate = today(), warehouse = ""): PurchaseOrderItem => ({
  item_code: "", item_name: "", description: "", schedule_date: scheduleDate,
  quantity: 1, uom: "Unit", rate: 0, amount: 0, target_warehouse: warehouse,
});

const blankTax = (): PurchaseOrderTax => ({
  charge_type: "on_net_total", account_head: "", description: "", rate: 0,
  net_amount: 0, tax_amount: 0, total: 0,
});

const emptyOrder = (): PurchaseOrder => ({
  naming_series: "PUR-ORD-.YYYY.-", status: "draft", supplier: "",
  transaction_date: today(), schedule_date: today(), company: "PT ZENIT TECHNOLOGY SOLUTION",
  is_subcontracted: false, cost_center: "", project: "", currency: "IDR",
  buying_price_list: "Standard Buying", ignore_pricing_rule: false, set_warehouse: "",
  tax_category: "", taxes_and_charges: "", shipping_rule: "", incoterm: "",
  total_qty: 0, total: 0, total_taxes_and_charges: 0, grand_total: 0,
  disable_rounded_total: false, rounding_adjustment: 0, rounded_total: 0, advance_paid: 0,
  apply_discount_on: "grand_total", additional_discount_percentage: 0,
  additional_discount_amount: 0, supplier_address: "", shipping_address: "",
  contact_person: "", contact_email: "", contact_phone: "", terms: "",
  payment_terms_template: "", letter_head: "", remarks: "", items: [blankItem()], taxes: [],
});

const initialOptions: BuyingOptions = {
  companies: ["PT ZENIT TECHNOLOGY SOLUTION"], suppliers: [], warehouses: [], items: [],
  cost_centers: [], projects: [], currencies: ["IDR", "USD", "SGD", "EUR"],
  price_lists: ["Standard Buying"], uoms: ["Unit", "Pcs", "Box", "Kg", "Meter", "Set"],
};

const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function calculate(order: PurchaseOrder): PurchaseOrder {
  const items = order.items.map((item) => ({ ...item, amount: round(item.quantity * item.rate) }));
  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const total = round(items.reduce((sum, item) => sum + item.amount, 0));
  let running = total;
  const taxes = order.taxes.map((tax) => {
    const taxAmount = tax.charge_type === "actual"
      ? round(tax.tax_amount)
      : round((tax.charge_type === "on_previous_row_total" ? running : total) * (Number(tax.rate) || 0) / 100);
    running = round(running + taxAmount);
    return { ...tax, net_amount: total, tax_amount: taxAmount, total: running };
  });
  const totalTaxes = round(taxes.reduce((sum, tax) => sum + tax.tax_amount, 0));
  const beforeDiscount = total + totalTaxes;
  const discountBase = order.apply_discount_on === "net_total" ? total : beforeDiscount;
  const discount = order.additional_discount_percentage > 0
    ? round(discountBase * order.additional_discount_percentage / 100)
    : round(order.additional_discount_amount);
  const grandTotal = round(Math.max(0, beforeDiscount - discount));
  const roundedTotal = order.disable_rounded_total ? grandTotal : Math.round(grandTotal);
  return {
    ...order, items, taxes, total_qty: totalQty, total, total_taxes_and_charges: totalTaxes,
    additional_discount_amount: discount, grand_total: grandTotal, rounded_total: roundedTotal,
    rounding_adjustment: round(roundedTotal - grandTotal),
  };
}

const money = (value: number, currency: string) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: currency || "IDR", maximumFractionDigits: currency === "IDR" ? 0 : 2,
}).format(value || 0);

function Field({ label, name, children, required = false }: { label: string; name?: string; children: React.ReactNode; required?: boolean }) {
  return <div className="space-y-1.5"><Label>{label}{required && <span className="text-red-500"> *</span>}</Label>{children}{name && <p className="text-[11px] text-slate-400">{name}</p>}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-t pt-6 first:border-0 first:pt-0"><h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>{children}</section>;
}

function Combo({ value, onChange, values, placeholder = "Begin typing for results." }: { value: string; onChange: (value: string) => void; values: string[]; placeholder?: string }) {
  const listId = useMemo(() => `list-${Math.random().toString(36).slice(2)}`, []);
  return <><Input list={listId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><datalist id={listId}>{values.map((option) => <ERPSelectOption key={option} value={option} />)}</datalist></>;
}

export default function PurchaseOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [tab, setTab] = useState<Tab>("details");
  const [order, setOrder] = useState<PurchaseOrder>(emptyOrder);
  const [options, setOptions] = useState<BuyingOptions>(initialOptions);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [scanBarcode, setScanBarcode] = useState("");

  useEffect(() => {
    buyingApi.options().then((data) => setOptions({ ...initialOptions, ...data })).catch(() => undefined);
    if (!isNew && id) {
      setLoading(true);
      buyingApi.get(id).then((data) => setOrder(calculate({
        ...emptyOrder(), ...data,
        transaction_date: dateForInput(data.transaction_date), schedule_date: dateForInput(data.schedule_date),
        items: (data.items || []).map((item) => ({ ...item, schedule_date: dateForInput(item.schedule_date) })),
        taxes: data.taxes || [],
      }))).catch((error: any) => {
        toast.error(error?.response?.data?.error || "Purchase Order tidak ditemukan");
        navigate("/desk/purchase-order");
      }).finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const update = <K extends keyof PurchaseOrder>(key: K, value: PurchaseOrder[K]) =>
    setOrder((current) => calculate({ ...current, [key]: value }));
  const updateItem = (index: number, patch: Partial<PurchaseOrderItem>) => setOrder((current) => calculate({
    ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const updateTax = (index: number, patch: Partial<PurchaseOrderTax>) => setOrder((current) => calculate({
    ...current, taxes: current.taxes.map((tax, taxIndex) => taxIndex === index ? { ...tax, ...patch } : tax),
  }));

  const payload = (): PurchaseOrder => ({
    ...calculate(order), transaction_date: dateForApi(order.transaction_date), schedule_date: dateForApi(order.schedule_date),
    items: order.items.map((item) => ({ ...item, schedule_date: dateForApi(item.schedule_date || order.schedule_date) })),
  });

  const validate = () => {
    if (!order.supplier.trim()) return "Supplier wajib diisi";
    if (!order.company.trim()) return "Company wajib diisi";
    if (!order.items.length || order.items.some((item) => !item.item_code.trim() || item.quantity <= 0 || !item.uom)) return "Lengkapi Item Code, Quantity, dan UOM pada semua baris";
    if (order.taxes.some((tax) => !tax.account_head.trim())) return "Account Head pajak wajib diisi";
    return "";
  };

  const save = async () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const saved = isNew ? await buyingApi.create(payload()) : await buyingApi.update(id!, payload());
      toast.success(isNew ? "Purchase Order berhasil dibuat" : "Purchase Order berhasil disimpan");
      navigate(`/desk/purchase-order/${saved.id}`, { replace: true });
      setOrder(calculate({ ...saved, transaction_date: dateForInput(saved.transaction_date), schedule_date: dateForInput(saved.schedule_date), items: saved.items.map((item) => ({ ...item, schedule_date: dateForInput(item.schedule_date) })) }));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan Purchase Order");
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!id || !window.confirm("Submit Purchase Order ini? Dokumen tidak dapat diedit setelah submit.")) return;
    setSaving(true);
    try { await buyingApi.submit(id); update("status", "submitted"); toast.success("Purchase Order berhasil disubmit"); }
    catch (error: any) { toast.error(error?.response?.data?.error || "Gagal submit Purchase Order"); }
    finally { setSaving(false); }
  };

  const addScannedItem = () => {
    if (!scanBarcode.trim()) return;
    setOrder((current) => calculate({ ...current, items: [...current.items, { ...blankItem(current.schedule_date, current.set_warehouse), item_code: scanBarcode.trim() }] }));
    setScanBarcode("");
  };

  if (loading) return <div className="p-12 text-center text-sm text-slate-500">Memuat Purchase Order...</div>;
  const editable = isNew || order.status === "draft";
  const tabs: Array<[Tab, string]> = [["details", "Details"], ["address", "Address & Contact"], ["terms", "Terms"], ["more", "More Info"]];

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
      <header className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/purchase-order">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-slate-500">Buying / Purchase Order</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {isNew ? "New Purchase Order" : order.number}
              </h1>
              <Badge
                variant={
                  isNew
                    ? "secondary"
                    : order.status === "submitted"
                    ? "default"
                    : "outline"
                }
                className={order.status === "submitted" ? "bg-emerald-600" : ""}
              >
                {isNew ? "Not Saved" : order.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && order.status === "draft" && (
            <Button variant="outline" onClick={submit} disabled={saving}>
              <Send className="size-4" /> Submit
            </Button>
          )}
          {editable && (
            <Button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            {tabs.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="space-y-8 p-5 lg:p-7">
          {tab === "details" && (
            <fieldset disabled={!editable} className="space-y-8">
              <Section title="Series">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Series" name="naming_series" required>
                    <Input
                      value={order.naming_series}
                      onChange={(e) => update("naming_series", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Supplier" name="supplier" required>
                    <Combo
                      value={order.supplier}
                      onChange={(value) => update("supplier", value)}
                      values={options.suppliers}
                    />
                  </Field>
                  <Field label="Date" name="transaction_date" required>
                    <Input
                      type="date"
                      value={order.transaction_date}
                      onChange={(e) =>
                        update("transaction_date", e.target.value)
                      }
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Required By" name="schedule_date" required>
                    <Input
                      type="date"
                      value={order.schedule_date}
                      onChange={(e) => {
                        const old = order.schedule_date;
                        setOrder((current) =>
                          calculate({
                            ...current,
                            schedule_date: e.target.value,
                            items: current.items.map((item) => ({
                              ...item,
                              schedule_date:
                                !item.schedule_date ||
                                item.schedule_date === old
                                  ? e.target.value
                                  : item.schedule_date,
                            })),
                          })
                        );
                      }}
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Company" name="company" required>
                    <Combo
                      value={order.company}
                      onChange={(value) => update("company", value)}
                      values={options.companies}
                    />
                  </Field>
                  <label className="flex items-center gap-2 self-center pt-5 text-sm">
                    <Checkbox
                      checked={order.is_subcontracted}
                      onCheckedChange={(checked) =>
                        update("is_subcontracted", checked === true)
                      }
                      disabled={!editable}
                    />{" "}
                    Is Subcontracted{" "}
                    <span className="text-xs text-slate-400">
                      is_subcontracted
                    </span>
                  </label>
                </div>
              </Section>

              <Section title="Accounting Dimensions">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Cost Center" name="cost_center">
                    <Combo
                      value={order.cost_center}
                      onChange={(value) => update("cost_center", value)}
                      values={options.cost_centers}
                    />
                  </Field>
                  <Field label="Project" name="project">
                    <Combo
                      value={order.project}
                      onChange={(value) => update("project", value)}
                      values={options.projects}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Currency and Price List">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Currency" name="currency">
                    <Combo
                      value={order.currency}
                      onChange={(value) => update("currency", value)}
                      values={options.currencies}
                    />
                  </Field>
                  <Field label="Price List" name="buying_price_list">
                    <Combo
                      value={order.buying_price_list}
                      onChange={(value) => update("buying_price_list", value)}
                      values={options.price_lists}
                    />
                  </Field>
                  <label className="flex items-center gap-2 self-center pt-5 text-sm">
                    <Checkbox
                      checked={order.ignore_pricing_rule}
                      onCheckedChange={(checked) =>
                        update("ignore_pricing_rule", checked === true)
                      }
                      disabled={!editable}
                    />{" "}
                    Ignore Pricing Rule
                  </label>
                  <Field label="Scan Barcode" name="scan_barcode">
                    <div className="flex gap-2">
                      <Input
                        value={scanBarcode}
                        onChange={(e) => setScanBarcode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addScannedItem();
                          }
                        }}
                        disabled={!editable}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addScannedItem}
                      >
                        <Barcode className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Set Target Warehouse" name="set_warehouse">
                    <Combo
                      value={order.set_warehouse}
                      onChange={(value) => {
                        setOrder((current) =>
                          calculate({
                            ...current,
                            set_warehouse: value,
                            items: current.items.map((item) => ({
                              ...item,
                              target_warehouse: value,
                            })),
                          })
                        );
                      }}
                      values={options.warehouses}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Items">
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-[1050px] w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="p-3 text-left">No.</th>
                        <th className="p-3 text-left">Item Code</th>
                        <th className="p-3 text-left">Required By</th>
                        <th className="p-3 text-left">Quantity</th>
                        <th className="p-3 text-left">UOM</th>
                        <th className="p-3 text-left">
                          Rate ({order.currency})
                        </th>
                        <th className="p-3 text-right">
                          Amount ({order.currency})
                        </th>
                        <th className="p-3 text-left">Target Warehouse</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {order.items.map((item, index) => (
                        <tr key={item.id || index} className="align-top">
                          <td className="p-3 text-slate-500">{index + 1}</td>
                          <td className="p-2">
                            <Combo
                              value={item.item_code}
                              onChange={(value) =>
                                updateItem(index, { item_code: value })
                              }
                              values={options.items}
                              placeholder="Item Code"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={item.schedule_date}
                              onChange={(e) =>
                                updateItem(index, {
                                  schedule_date: e.target.value,
                                })
                              }
                              disabled={!editable}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0.000001"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, {
                                  quantity: Number(e.target.value),
                                })
                              }
                              disabled={!editable}
                            />
                          </td>
                          <td className="p-2">
                            <Combo
                              value={item.uom}
                              onChange={(value) =>
                                updateItem(index, { uom: value })
                              }
                              values={options.uoms}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.rate}
                              onChange={(e) =>
                                updateItem(index, {
                                  rate: Number(e.target.value),
                                })
                              }
                              disabled={!editable}
                            />
                          </td>
                          <td className="p-3 text-right font-medium">
                            {money(item.amount, order.currency)}
                          </td>
                          <td className="p-2">
                            <Combo
                              value={item.target_warehouse}
                              onChange={(value) =>
                                updateItem(index, { target_warehouse: value })
                              }
                              values={options.warehouses}
                            />
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!editable || order.items.length === 1}
                              onClick={() =>
                                update(
                                  "items",
                                  order.items.filter((_, i) => i !== index)
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
                  disabled={!editable}
                  onClick={() =>
                    update("items", [
                      ...order.items,
                      blankItem(order.schedule_date, order.set_warehouse),
                    ])
                  }
                >
                  <Plus className="size-4" /> Add Row
                </Button>
                <div className="ml-auto grid max-w-md grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <span className="text-slate-500">Total Quantity</span>
                  <strong className="text-right">{order.total_qty}</strong>
                  <span className="text-slate-500">
                    Total ({order.currency})
                  </span>
                  <strong className="text-right">
                    {money(order.total, order.currency)}
                  </strong>
                </div>
              </Section>

              <Section title="Taxes and Charges">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Tax Category" name="tax_category">
                    <Input
                      value={order.tax_category}
                      onChange={(e) => update("tax_category", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                  <Field
                    label="Purchase Taxes and Charges Template"
                    name="taxes_and_charges"
                  >
                    <Input
                      value={order.taxes_and_charges}
                      onChange={(e) =>
                        update("taxes_and_charges", e.target.value)
                      }
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Shipping Rule" name="shipping_rule">
                    <Input
                      value={order.shipping_rule}
                      onChange={(e) => update("shipping_rule", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Incoterm" name="incoterm">
                    <Input
                      value={order.incoterm}
                      onChange={(e) => update("incoterm", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                </div>
                <h3 className="pt-2 text-sm font-semibold">
                  Purchase Taxes and Charges
                </h3>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="p-3 text-left">No.</th>
                        <th className="p-3 text-left">Type</th>
                        <th className="p-3 text-left">Account Head</th>
                        <th className="p-3 text-left">Tax Rate</th>
                        <th className="p-3 text-right">Net Amount</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {order.taxes.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-8 text-center text-slate-400"
                          >
                            No rows
                          </td>
                        </tr>
                      )}
                      {order.taxes.map((tax, index) => (
                        <tr key={tax.id || index}>
                          <td className="p-3">{index + 1}</td>
                          <td className="p-2">
                            <ERPSelect
                              value={tax.charge_type}
                              onChange={(e) =>
                                updateTax(index, {
                                  charge_type: e.target
                                    .value as PurchaseOrderTax["charge_type"],
                                })
                              }
                              className="h-9 rounded-md border bg-transparent px-2"
                              disabled={!editable}
                            >
                              <ERPSelectOption value="on_net_total">On Net Total</ERPSelectOption>
                              <ERPSelectOption value="on_previous_row_total">
                                On Previous Row Total
                              </ERPSelectOption>
                              <ERPSelectOption value="actual">Actual</ERPSelectOption>
                            </ERPSelect>
                          </td>
                          <td className="p-2">
                            <Input
                              value={tax.account_head}
                              onChange={(e) =>
                                updateTax(index, {
                                  account_head: e.target.value,
                                })
                              }
                              disabled={!editable}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="any"
                              value={tax.rate}
                              onChange={(e) =>
                                updateTax(index, {
                                  rate: Number(e.target.value),
                                })
                              }
                              disabled={
                                !editable || tax.charge_type === "actual"
                              }
                            />
                          </td>
                          <td className="p-3 text-right">
                            {money(tax.net_amount, order.currency)}
                          </td>
                          <td className="p-2">
                            {tax.charge_type === "actual" ? (
                              <Input
                                type="number"
                                value={tax.tax_amount}
                                onChange={(e) =>
                                  updateTax(index, {
                                    tax_amount: Number(e.target.value),
                                  })
                                }
                                disabled={!editable}
                              />
                            ) : (
                              <div className="text-right">
                                {money(tax.tax_amount, order.currency)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {money(tax.total, order.currency)}
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!editable}
                              onClick={() =>
                                update(
                                  "taxes",
                                  order.taxes.filter((_, i) => i !== index)
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
                  disabled={!editable}
                  onClick={() => update("taxes", [...order.taxes, blankTax()])}
                >
                  <Plus className="size-4" /> Add Tax
                </Button>
                <div className="ml-auto grid max-w-md grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <span className="text-slate-500">
                    Total Taxes and Charges ({order.currency})
                  </span>
                  <strong className="text-right">
                    {money(order.total_taxes_and_charges, order.currency)}
                  </strong>
                </div>
              </Section>

              <Section title={`Totals (${order.currency})`}>
                <div className="ml-auto grid max-w-xl grid-cols-2 gap-x-5 gap-y-4 text-sm">
                  <span className="font-semibold">Grand Total</span>
                  <strong className="text-right text-lg">
                    {money(order.grand_total, order.currency)}
                  </strong>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={order.disable_rounded_total}
                      onCheckedChange={(checked) =>
                        update("disable_rounded_total", checked === true)
                      }
                      disabled={!editable}
                    />{" "}
                    Disable Rounded Total
                  </label>
                  <span />
                  <span className="text-slate-500">Rounding Adjustment</span>
                  <span className="text-right">
                    {money(order.rounding_adjustment, order.currency)}
                  </span>
                  <span className="text-slate-500">Rounded Total</span>
                  <strong className="text-right">
                    {money(order.rounded_total, order.currency)}
                  </strong>
                  <span className="text-slate-500">
                    Advance Paid ({order.currency})
                  </span>
                  <Input
                    type="number"
                    min="0"
                    value={order.advance_paid}
                    onChange={(e) =>
                      update("advance_paid", Number(e.target.value))
                    }
                    disabled={!editable}
                  />
                </div>
              </Section>

              <Section title="Additional Discount">
                <div className="grid gap-5 md:grid-cols-3">
                  <Field
                    label="Apply Additional Discount On"
                    name="apply_discount_on"
                  >
                    <ERPSelect
                      value={order.apply_discount_on}
                      onChange={(e) =>
                        update(
                          "apply_discount_on",
                          e.target.value as PurchaseOrder["apply_discount_on"]
                        )
                      }
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      disabled={!editable}
                    >
                      <ERPSelectOption value="grand_total">Grand Total</ERPSelectOption>
                      <ERPSelectOption value="net_total">Net Total</ERPSelectOption>
                    </ERPSelect>
                  </Field>
                  <Field
                    label="Additional Discount Percentage"
                    name="additional_discount_percentage"
                  >
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={order.additional_discount_percentage}
                      onChange={(e) =>
                        update(
                          "additional_discount_percentage",
                          Number(e.target.value)
                        )
                      }
                      disabled={!editable}
                    />
                  </Field>
                  <Field
                    label={`Additional Discount Amount (${order.currency})`}
                    name="additional_discount_amount"
                  >
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={order.additional_discount_amount}
                      onChange={(e) =>
                        setOrder((current) =>
                          calculate({
                            ...current,
                            additional_discount_percentage: 0,
                            additional_discount_amount: Number(e.target.value),
                          })
                        )
                      }
                      disabled={
                        !editable || order.additional_discount_percentage > 0
                      }
                    />
                  </Field>
                </div>
              </Section>
            </fieldset>
          )}

          {tab === "address" && (
            <>
              <Section title="Supplier Address">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Supplier Address" name="supplier_address">
                    <Textarea
                      rows={7}
                      value={order.supplier_address}
                      onChange={(e) =>
                        update("supplier_address", e.target.value)
                      }
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Shipping Address" name="shipping_address">
                    <Textarea
                      rows={7}
                      value={order.shipping_address}
                      onChange={(e) =>
                        update("shipping_address", e.target.value)
                      }
                      disabled={!editable}
                    />
                  </Field>
                </div>
              </Section>
              <Section title="Contact">
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Contact Person" name="contact_person">
                    <Input
                      value={order.contact_person}
                      onChange={(e) => update("contact_person", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Contact Email" name="contact_email">
                    <Input
                      type="email"
                      value={order.contact_email}
                      onChange={(e) => update("contact_email", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                  <Field label="Contact Phone" name="contact_phone">
                    <Input
                      value={order.contact_phone}
                      onChange={(e) => update("contact_phone", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                </div>
              </Section>
            </>
          )}
          {tab === "terms" && (
            <>
              <Section title="Terms and Conditions">
                <Field label="Terms" name="terms">
                  <Textarea
                    rows={14}
                    value={order.terms}
                    onChange={(e) => update("terms", e.target.value)}
                    disabled={!editable}
                    placeholder="Masukkan syarat pembayaran, pengiriman, garansi, dan ketentuan lainnya..."
                  />
                </Field>
              </Section>
              <Section title="Payment">
                <Field
                  label="Payment Terms Template"
                  name="payment_terms_template"
                >
                  <Input
                    value={order.payment_terms_template}
                    onChange={(e) =>
                      update("payment_terms_template", e.target.value)
                    }
                    disabled={!editable}
                  />
                </Field>
              </Section>
            </>
          )}
          {tab === "more" && (
            <Section title="More Information">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Letter Head" name="letter_head">
                  <Input
                    value={order.letter_head}
                    onChange={(e) => update("letter_head", e.target.value)}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Status" name="status">
                  <Input value={isNew ? "Not Saved" : order.status} disabled />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Remarks" name="remarks">
                    <Textarea
                      rows={7}
                      value={order.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      disabled={!editable}
                    />
                  </Field>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
