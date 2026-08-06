import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, Plus, Save, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/lib/api";

type Item = { item_code: string; item_name?: string; delivery_date?: string; quantity: number; rate: number; amount: number };
type Tax = { charge_type: string; account_head: string; rate: number; net_amount: number; amount: number };
type Order = { id?: string; order_number?: string; store_order_id?: string; status: string; payment_status?: string; payment_method?: string; payment_provider?: string; payment_reference?: string; shipping_address?: string; subtotal?: number; shipping_amount?: number; total_amount?: number; naming_series: string; company: string; customer: string; customer_email?: string; order_type: string; transaction_date: string; delivery_date: string; is_subcontracted: boolean; cost_center: string; project: string; currency: string; selling_price_list: string; ignore_pricing_rule: boolean; set_warehouse: string; tax_category: string; taxes_and_charges: string; shipping_rule: string; incoterm: string; total_qty: number; total: number; base_total_taxes_and_charges: number; total_taxes_and_charges: number; grand_total: number; rounding_adjustment: number; rounded_total: number; advance_paid: number; apply_discount_on: string; coupon_code: string; additional_discount_percentage: number; additional_discount_amount: number; items: Item[]; taxes: Tax[] };
type Tab = "details" | "terms" | "more";

const today = () => new Date().toISOString().slice(0, 10);
const key = "erp.sales-orders.details";
const blankItem = (): Item => ({ item_code: "", delivery_date: today(), quantity: 1, rate: 0, amount: 0 });
const empty = (): Order => ({ status: "draft", naming_series: "SAL-ORD-.YYYY.-", company: "PT ZENIT TECHNOLOGY SOLUTION", customer: "", order_type: "Sales", transaction_date: today(), delivery_date: "", is_subcontracted: false, cost_center: "", project: "", currency: "IDR", selling_price_list: "Standard Selling", ignore_pricing_rule: false, set_warehouse: "", tax_category: "", taxes_and_charges: "", shipping_rule: "", incoterm: "", total_qty: 0, total: 0, base_total_taxes_and_charges: 0, total_taxes_and_charges: 0, grand_total: 0, rounding_adjustment: 0, rounded_total: 0, advance_paid: 0, apply_discount_on: "grand_total", coupon_code: "", additional_discount_percentage: 0, additional_discount_amount: 0, items: [blankItem()], taxes: [] });
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const readCache = (): Record<string, Order> => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } };
const saveCache = (id: string, value: Order) => localStorage.setItem(key, JSON.stringify({ ...readCache(), [id]: value }));
const removeCache = (id: string) => { const cache = readCache(); delete cache[id]; localStorage.setItem(key, JSON.stringify(cache)); };
function calculate(o: Order): Order { const items = o.items.map(i => ({ ...i, amount: round(i.quantity * i.rate) })); const total = round(items.reduce((s, i) => s + i.amount, 0)); const taxes = o.taxes.map(t => ({ ...t, net_amount: total, amount: round(t.charge_type === "Actual" ? t.amount : total * t.rate / 100) })); const taxTotal = round(taxes.reduce((s, t) => s + t.amount, 0)); const discount = o.additional_discount_percentage ? round((total + taxTotal) * o.additional_discount_percentage / 100) : round(o.additional_discount_amount); const grand = round(Math.max(0, total + taxTotal - discount)); const rounded = Math.round(grand); return { ...o, items, taxes, total_qty: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0), total, base_total_taxes_and_charges: taxTotal, total_taxes_and_charges: taxTotal, additional_discount_amount: discount, grand_total: grand, rounded_total: rounded, rounding_adjustment: round(rounded - grand) }; }
function hydrate(o: Order): Order { const calculated = calculate(o); if (o.total_amount == null) return calculated; const total = Number(o.total_amount) || 0; return { ...calculated, total: o.subtotal ?? calculated.total, grand_total: total, rounded_total: Math.round(total), rounding_adjustment: round(Math.round(total) - total) }; }
function mergeServerOrder(server: Order, cached?: Order): Order { return hydrate({ ...empty(), ...(cached || {}), ...server, items: server.items?.length ? server.items : cached?.items || [], taxes: cached?.taxes || server.taxes || [] }); }
function Field({ label, name, children }: { label: string; name?: string; children: React.ReactNode }) { return <div className="space-y-1.5">
<Label>{label}</Label>{children}{name && <p className="text-[11px] text-slate-400">{name}</p>}</div>; }
function Combo({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) { const id = useMemo(() => `sales-${Math.random().toString(36).slice(2)}`, []); return <>
<Input list={id} value={value} onChange={e => onChange(e.target.value)} placeholder="Begin typing for results." />
<datalist id={id}>{options.map(v => <option key={v} value={v} />)}</datalist>
</>; }

export function SalesOrderListPage() { const nav = useNavigate(); const [rows, setRows] = useState<Order[]>([]); const [q, setQ] = useState(""); const load = async () => { try { const response = await api.get<{ data: Order[] }>("/crm/sales-orders", { params: { page_size: 100, q } }); setRows(response.data.data || []); } catch { setRows(Object.values(readCache())); } }; useEffect(() => { load(); }, []); const remove = async (id?: string) => { if (!id || !window.confirm("Hapus Sales Order ini?")) return; try { await api.delete(`/crm/sales-orders/${id}`); } catch { /* cache still makes local CRUD usable when API is unavailable */ } removeCache(id); toast.success("Sales Order dihapus"); load(); }; return <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
<header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
<div>
<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Selling</p>
<h1 className="text-2xl font-bold">Sales Order</h1>
<p className="mt-1 text-sm text-slate-500">Kelola pesanan penjualan dan detail item.</p>
</div>
<Button onClick={() => nav("/desk/sales-order/new")} className="bg-blue-600 hover:bg-blue-700">
<Plus className="size-4" /> New Sales Order</Button>
</header>
<div className="mb-4 flex gap-2">
<Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Cari nomor order atau customer..." />
<Button variant="outline" onClick={load}>Search</Button>
</div>
<div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
<div className="overflow-x-auto">
<table className="w-full text-left text-sm">
<thead className="bg-slate-50 text-xs uppercase text-slate-500">
<tr>
<th className="px-5 py-3">Sales Order</th>
<th className="px-5 py-3">Customer</th>
<th className="px-5 py-3">Date</th>
<th className="px-5 py-3">Total</th>
<th className="px-5 py-3">Status</th>
<th className="px-5 py-3 text-right">Action</th>
</tr>
</thead>
<tbody className="divide-y">{rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
<td className="px-5 py-4 font-semibold text-blue-600">
<Link to={`/desk/sales-order/${r.id}`}>{r.order_number || r.id}</Link>
</td>
<td className="px-5 py-4">{r.customer || "—"}</td>
<td className="px-5 py-4">{r.transaction_date?.slice(0, 10) || "—"}</td>
<td className="px-5 py-4 font-semibold">{money(r.total_amount ?? r.grand_total)}</td>
<td className="px-5 py-4">
<Badge variant="secondary">{r.status || "draft"}</Badge>
</td>
<td className="px-5 py-4 text-right">
<Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
<Trash2 className="size-4 text-red-500" />
</Button>
</td>
</tr>)}{rows.length === 0 && <tr>
<td colSpan={6} className="px-5 py-14 text-center text-slate-500">Belum ada Sales Order.</td>
</tr>}</tbody>
</table>
</div>
</div>
</div>; }

export default function SalesOrderFormPage() { const { id } = useParams(); const nav = useNavigate(); const isNew = !id || id === "new"; const [tab, setTab] = useState<Tab>("details"); const [order, setOrder] = useState<Order>(empty); const [saving, setSaving] = useState(false); const update = <K extends keyof Order>(k: K, v: Order[K]) => setOrder(o => calculate({ ...o, [k]: v })); const updateItem = (i: number, p: Partial<Item>) => setOrder(o => calculate({ ...o, items: o.items.map((x, n) => n === i ? { ...x, ...p } : x) })); const updateTax = (i: number, p: Partial<Tax>) => setOrder(o => calculate({ ...o, taxes: o.taxes.map((x, n) => n === i ? { ...x, ...p } : x) }));
 useEffect(() => { if (!isNew && id) { const cached = readCache()[id]; api.get<Order>(`/crm/sales-orders/${id}`).then(r => setOrder(mergeServerOrder(r.data, cached))).catch(() => { if (cached) setOrder(calculate(cached)); else { toast.error("Sales Order tidak ditemukan"); nav("/desk/sales-order"); } }); } }, [id, isNew, nav]);
 const save = async () => { if (!order.company.trim() || !order.customer.trim()) return toast.error("Company dan Customer wajib diisi"); if (order.items.some(i => !i.item_code.trim() || i.quantity <= 0)) return toast.error("Lengkapi Item Code dan Quantity"); setSaving(true); const payload = calculate(order); try { const res = isNew ? await api.post<Order>("/crm/sales-orders", { order_number: `${order.naming_series.replace(".YYYY.", new Date().getFullYear().toString())}${Date.now().toString().slice(-5)}`, total_amount: payload.grand_total, status: "processing" }) : await api.patch<Order>(`/crm/sales-orders/${id}`, { total_amount: payload.grand_total, status: payload.status }); const savedId = id || res.data.id || crypto.randomUUID(); const full = { ...payload, id: savedId, order_number: res.data.order_number || payload.order_number || `SAL-ORD-${savedId.slice(0, 8)}` }; saveCache(savedId, full); setOrder(full); toast.success("Sales Order berhasil disimpan"); nav(`/desk/sales-order/${savedId}`, { replace: true }); } catch (e: any) { const savedId = id || crypto.randomUUID(); const full = { ...payload, id: savedId, order_number: payload.order_number || `SAL-ORD-${savedId.slice(0, 8)}` }; saveCache(savedId, full); setOrder(full); toast.success("Sales Order disimpan di browser"); nav(`/desk/sales-order/${savedId}`, { replace: true }); } finally { setSaving(false); } };
 const remove = async () => { if (!id || !window.confirm("Hapus Sales Order ini?")) return; try { await api.delete(`/crm/sales-orders/${id}`); } catch {} removeCache(id); toast.success("Sales Order dihapus"); nav("/desk/sales-order"); }; const options = ["PT ZENIT TECHNOLOGY SOLUTION", "Standard Selling", "Main Warehouse", "Jakarta Warehouse", "Customer A", "Customer B"]; const editable = isNew || order.status === "draft" || order.status === "processing"; if (!isNew && !order.id && !order.customer) return <div className="p-12 text-center text-slate-500">Memuat Sales Order...</div>;
 return <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
<header className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
<div className="flex items-start gap-3">
<Button variant="ghost" size="icon" asChild>
<Link to="/desk/sales-order">
<ArrowLeft className="size-4" />
</Link>
</Button>
<div>
<p className="text-sm text-slate-500">Selling / Sales Order</p>
<div className="mt-1 flex items-center gap-3">
<h1 className="text-2xl font-bold">{isNew ? "New Sales Order" : order.order_number}</h1>
<Badge variant="secondary">{isNew ? "Not Saved" : order.status}</Badge>
{!isNew && order.payment_status && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{order.payment_status}</Badge>}
</div>
</div>
</div>
<div className="flex flex-wrap gap-2">
  {!isNew && (
    <Button
      variant="outline"
      onClick={() => nav(`/desk/delivery-note/new?sales_order_id=${encodeURIComponent(order.id || "")}`)}
      className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-900"
    >
      <Truck className="mr-1 size-4" /> Create Delivery Note
    </Button>
  )}
  {!isNew && <Button variant="outline" onClick={remove}><Trash2 className="size-4" /> Delete</Button>}
  {editable && <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700"><Save className="size-4" /> {saving ? "Saving..." : "Save"}</Button>}
</div>
</header>
<div className="rounded-2xl border bg-white shadow-sm">
<Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
<TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
<TabsTrigger value="details" className="rounded-none px-5 py-3">Details</TabsTrigger>
<TabsTrigger value="terms" className="rounded-none px-5 py-3">Terms</TabsTrigger>
<TabsTrigger value="more" className="rounded-none px-5 py-3">More Info</TabsTrigger>
</TabsList>
</Tabs>
<div className="space-y-8 p-5 lg:p-7">{tab === "details" && <>
<section className="space-y-4">
<h2 className="text-sm font-bold">Details</h2>
<div className="grid gap-4 md:grid-cols-3">
<Field label="Company" name="company">
<Combo value={order.company} onChange={v => update("company", v)} options={options} />
</Field>
<Field label="Series" name="naming_series">
<Input value={order.naming_series} onChange={e => update("naming_series", e.target.value)} />
</Field>
<Field label="Customer" name="customer">
<Combo value={order.customer} onChange={v => update("customer", v)} options={options} />
</Field>
<Field label="Order Type" name="order_type">
<select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={order.order_type} onChange={e => update("order_type", e.target.value)}>
<option>Sales</option>
<option>Shopping</option>
</select>
</Field>
<Field label="Date" name="transaction_date">
<Input type="date" value={order.transaction_date} onChange={e => update("transaction_date", e.target.value)} />
</Field>
<Field label="Delivery Date" name="delivery_date">
<Input type="date" value={order.delivery_date} onChange={e => update("delivery_date", e.target.value)} />
</Field>
</div>
{order.store_order_id && <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:grid-cols-4">
<Field label="Payment Method"><Input readOnly value={order.payment_method || "—"} /></Field>
<Field label="Payment Provider"><Input readOnly value={order.payment_provider || "—"} /></Field>
<Field label="Payment Status"><Input readOnly value={order.payment_status || "—"} /></Field>
<Field label="Payment Reference"><Input readOnly value={order.payment_reference || "—"} /></Field>
{order.shipping_address && <div className="md:col-span-4"><Field label="Shipping Address"><Input readOnly value={order.shipping_address} /></Field></div>}
</div>}
<label className="flex items-center gap-2 text-sm">
<Checkbox checked={order.is_subcontracted} onCheckedChange={v => update("is_subcontracted", Boolean(v))} /> Is Subcontracted</label>
</section>
<details className="group border-t pt-6">
<summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
<span>Accounting Dimensions</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" />
</summary>
<div className="mt-4 grid gap-4 md:grid-cols-2">
<Field label="Cost Center" name="cost_center"><Combo value={order.cost_center} onChange={v => update("cost_center", v)} options={options} /></Field>
<Field label="Project" name="project"><Combo value={order.project} onChange={v => update("project", v)} options={options} /></Field>
</div>
</details>
<details className="group border-t pt-6">
<summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
<span>Currency and Price List</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" />
</summary>
<div className="mt-4 space-y-4">
<div className="grid gap-4 md:grid-cols-3">
<Field label="Currency">
<Input value={order.currency} onChange={e => update("currency", e.target.value)} />
</Field>
<Field label="Price List" name="selling_price_list"><Combo value={order.selling_price_list} onChange={v => update("selling_price_list", v)} options={["Standard Selling", ...options]} /></Field>
<Field label="Set Source Warehouse" name="set_warehouse">
<Combo value={order.set_warehouse} onChange={v => update("set_warehouse", v)} options={options} />
</Field>
</div>
<label className="flex items-center gap-2 text-sm"><Checkbox checked={order.ignore_pricing_rule} onCheckedChange={v => update("ignore_pricing_rule", Boolean(v))} /> Ignore Pricing Rule</label>
</div>
</details>
<section className="space-y-4 border-t pt-6">
<div className="flex items-center justify-between">
<h2 className="text-sm font-bold">Items</h2>
<Button variant="outline" size="sm" onClick={() => update("items", [...order.items, blankItem()])}>
<Plus className="size-4" /> Add Row</Button>
</div>
<div className="overflow-x-auto rounded-lg border">
<table className="w-full min-w-[850px] text-sm">
<thead className="bg-slate-50 text-left text-xs text-slate-500">
<tr>
<th className="p-3">No.</th>
<th className="p-3">Item Code</th>
<th className="p-3">Delivery Date</th>
<th className="p-3">Quantity</th>
<th className="p-3">Rate (IDR)</th>
<th className="p-3">Amount (IDR)</th>
<th />
</tr>
</thead>
<tbody>{order.items.map((item, i) => <tr key={i} className="border-t">
<td className="p-3">{i + 1}</td>
<td className="p-3">
<Input value={item.item_code} onChange={e => updateItem(i, { item_code: e.target.value })} placeholder="Item code" />
{item.item_name && <p className="mt-1 text-xs text-slate-500">{item.item_name}</p>}
</td>
<td className="p-3">
<Input type="date" value={item.delivery_date || ""} onChange={e => updateItem(i, { delivery_date: e.target.value })} />
</td>
<td className="p-3">
<Input type="number" min="0" value={item.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) })} />
</td>
<td className="p-3">
<Input type="number" min="0" value={item.rate} onChange={e => updateItem(i, { rate: Number(e.target.value) })} />
</td>
<td className="p-3 font-medium">{money(item.amount)}</td>
<td className="p-3">
<Button variant="ghost" size="icon" disabled={order.items.length === 1} onClick={() => update("items", order.items.filter((_, n) => n !== i))}>
<Trash2 className="size-4 text-red-500" />
</Button>
</td>
</tr>)}{order.items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Item Sales Order belum tersedia.</td></tr>}</tbody>
</table>
</div>
<div className="grid gap-3 text-sm sm:grid-cols-2">
<div>Total Quantity <strong>{order.total_qty}</strong>
</div>
<div className="text-right">Total <strong>{money(order.total)}</strong>
</div>
</div>
</section>
<section className="space-y-4 border-t pt-6">
<h2 className="text-sm font-bold">Taxes and Charges</h2>
<div className="grid gap-4 md:grid-cols-3">
<Field label="Tax Category" name="tax_category">
<Input value={order.tax_category} onChange={e => update("tax_category", e.target.value)} />
</Field>
<Field label="Sales Taxes and Charges Template" name="taxes_and_charges">
<Input value={order.taxes_and_charges} onChange={e => update("taxes_and_charges", e.target.value)} />
</Field>
<Field label="Shipping Rule" name="shipping_rule">
<Input value={order.shipping_rule} onChange={e => update("shipping_rule", e.target.value)} />
</Field>
<Field label="Incoterm" name="incoterm">
<Input value={order.incoterm} onChange={e => update("incoterm", e.target.value)} />
</Field>
</div>
<div className="flex items-center justify-between">
<h3 className="text-sm font-semibold">Sales Taxes and Charges</h3>
<Button variant="outline" size="sm" onClick={() => update("taxes", [...order.taxes, { charge_type: "On Net Total", account_head: "", rate: 0, net_amount: 0, amount: 0 }])}>
<Plus className="size-4" /> Add Tax</Button>
</div>{order.taxes.map((tax, i) => <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" key={i}>
<Input value={tax.charge_type} onChange={e => updateTax(i, { charge_type: e.target.value })} />
<Input placeholder="Account Head" value={tax.account_head} onChange={e => updateTax(i, { account_head: e.target.value })} />
<Input type="number" placeholder="Tax Rate %" value={tax.rate} onChange={e => updateTax(i, { rate: Number(e.target.value) })} />
<Input readOnly value={money(tax.amount)} />
<Button variant="ghost" onClick={() => update("taxes", order.taxes.filter((_, n) => n !== i))}>
<Trash2 className="size-4 text-red-500" />
</Button>
</div>)}<div className="grid gap-2 text-right text-sm">
<div>Total Taxes and Charges <strong>{money(order.total_taxes_and_charges)}</strong>
</div>
<div className="text-base">Grand Total <strong>{money(order.grand_total)}</strong>
</div>
<div>Rounding Adjustment <strong>{money(order.rounding_adjustment)}</strong>
</div>
<div>Rounded Total <strong>{money(order.rounded_total)}</strong>
</div>
</div>
</section>
 </>}{tab === "terms" && <details className="group">
<summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
<span>Additional Discount</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" />
</summary>
<div className="mt-4 space-y-4">
<div className="grid gap-4 md:grid-cols-3">
<Field label="Apply Additional Discount On">
<select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={order.apply_discount_on} onChange={e => update("apply_discount_on", e.target.value)}>
<option value="grand_total">Grand Total</option>
<option value="net_total">Net Total</option>
</select>
</Field>
<Field label="Coupon Code" name="coupon_code">
<Input value={order.coupon_code} onChange={e => update("coupon_code", e.target.value)} />
</Field>
<Field label="Additional Discount Percentage" name="additional_discount_percentage">
<Input type="number" min="0" value={order.additional_discount_percentage} onChange={e => update("additional_discount_percentage", Number(e.target.value))} />
</Field>
</div>
<Field label="Additional Discount Amount (IDR)">
<Input type="number" min="0" value={order.additional_discount_amount} onChange={e => update("additional_discount_amount", Number(e.target.value))} />
</Field>
</div>
</details>}{tab === "more" && <section className="space-y-4">
<h2 className="text-sm font-bold">More Info</h2>
<p className="text-sm text-slate-500">Sales Order dibuat pada {order.transaction_date || today()} dengan mata uang {order.currency}.</p>
<Field label="Advance Paid (IDR)">
<Input type="number" value={order.advance_paid} onChange={e => update("advance_paid", Number(e.target.value))} />
</Field>
</section>}</div>
</div>
</div>; }
