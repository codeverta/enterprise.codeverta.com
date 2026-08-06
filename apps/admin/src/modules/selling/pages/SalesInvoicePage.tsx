import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Banknote, CheckCircle2, Plus, RotateCcw, Save, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stockApi } from "@/modules/stock/api";
import { salesInvoiceApi, type SalesInvoice, type SalesInvoiceItem } from "../salesInvoiceApi";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const emptyInvoice = (): SalesInvoice => ({
  status: "Draft", customer: "", company: "PT ZENIT TECHNOLOGY SOLUTION", posting_date: today(),
  currency: "IDR", is_return: false, net_total: 0, tax_rate: 0, tax_amount: 0, grand_total: 0,
  outstanding_amount: 0, is_paid: false, refund_status: "Not Applicable",
  items: [{ item_code: "", item_name: "", quantity: 1, uom: "Nos", rate: 0, amount: 0 }],
});

const calculate = (invoice: SalesInvoice): SalesInvoice => {
  const sign = invoice.is_return ? -1 : 1;
  const items = invoice.items.map((item) => {
    const quantity = sign * Math.abs(Number(item.quantity) || 0);
    return { ...item, quantity, amount: quantity * Math.abs(Number(item.rate) || 0) };
  });
  const net = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = net * Math.abs(Number(invoice.tax_rate) || 0) / 100;
  return { ...invoice, items, net_total: net, tax_amount: tax, grand_total: net + tax };
};

export function SalesInvoiceListPage() {
  const [rows, setRows] = useState<SalesInvoice[]>([]);
  const [query, setQuery] = useState("");
  const load = () => salesInvoiceApi.list({ q: query }).then(setRows).catch(() => toast.error("Gagal memuat Sales Invoice"));
  useEffect(load, []);
  return <div className="mx-auto max-w-screen-2xl p-4 lg:p-7">
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Selling</p><h1 className="text-2xl font-bold">Sales Invoice & Credit Note</h1><p className="mt-1 text-sm text-slate-500">Invoice, refund sebagian, dan audit trail return customer.</p></div>
      <Button asChild className="bg-blue-600 hover:bg-blue-700"><Link to="/desk/sales-invoice/new"><Plus className="size-4" /> New Sales Invoice</Link></Button>
    </header>
    <div className="mb-4 flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Cari nomor atau customer..." /><Button variant="outline" onClick={load}>Search</Button></div>
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Document</th><th className="p-4">Customer</th><th className="p-4">Date</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4">Settlement</th></tr></thead>
      <tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="p-4"><Link className="font-semibold text-blue-600 hover:underline" to={`/desk/sales-invoice/${row.id}`}>{row.number}</Link>{row.is_return && <div className="mt-1 text-xs text-amber-600">Credit Note · against {row.return_against_id}</div>}</td><td className="p-4">{row.customer}</td><td className="p-4">{row.posting_date?.slice(0, 10)}</td><td className={`p-4 font-semibold ${row.is_return ? "text-red-600" : ""}`}>{money(row.grand_total)}</td><td className="p-4"><Badge variant={row.status === "Submitted" ? "default" : "secondary"}>{row.status}</Badge></td><td className="p-4">{row.is_return ? row.refund_status : row.is_paid ? "Paid" : "Outstanding"}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="p-14 text-center text-slate-500">Belum ada Sales Invoice.</td></tr>}</tbody>
    </table></div>
  </div>;
}

export default function SalesInvoiceFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const deliveryNoteID = params.get("delivery_note_id") || "";
  const returnAgainst = params.get("return_against") || "";
  const [row, setRow] = useState<SalesInvoice>(emptyInvoice());
  const [loading, setLoading] = useState(!isNew || Boolean(deliveryNoteID || returnAgainst));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      salesInvoiceApi.get(id).then(setRow).catch(() => { toast.error("Sales Invoice tidak ditemukan"); navigate("/desk/sales-invoice"); }).finally(() => setLoading(false));
      return;
    }
    if (returnAgainst) {
      salesInvoiceApi.get(returnAgainst).then((source) => setRow(calculate({ ...source, id: undefined, number: undefined, status: "Draft", is_return: true, return_against_id: source.id, return_reason: "", is_paid: false, refund_status: source.is_paid ? "Pending Refund" : "Credit Available", posting_date: today(), items: source.items.map((item) => ({ ...item, id: undefined, against_item_id: item.id, quantity: Math.min(1, Math.abs(item.quantity)) })) }))).catch(() => navigate("/desk/sales-invoice")).finally(() => setLoading(false));
      return;
    }
    if (deliveryNoteID) {
      stockApi.deliveryNoteGet(deliveryNoteID).then((delivery) => setRow(calculate({ ...emptyInvoice(), customer: delivery.customer, company: delivery.company, delivery_note_id: delivery.id, sales_order_id: delivery.sales_order_id, items: delivery.items.map((item) => ({ item_code: item.item_code, item_name: item.item_name, quantity: item.quantity, uom: item.uom, rate: item.rate, amount: item.amount })) }))).catch(() => toast.error("Delivery Note tidak ditemukan")).finally(() => setLoading(false));
    }
  }, [id, isNew, deliveryNoteID, returnAgainst, navigate]);

  const update = <K extends keyof SalesInvoice>(key: K, value: SalesInvoice[K]) => setRow((previous) => calculate({ ...previous, [key]: value }));
  const updateItem = (index: number, patch: Partial<SalesInvoiceItem>) => update("items", row.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const save = async () => {
    if (!row.customer.trim() || row.items.some((item) => !item.item_code.trim() || Math.abs(item.quantity) <= 0)) return toast.error("Customer, item, dan quantity wajib diisi");
    setSaving(true);
    try {
      const saved = isNew && returnAgainst
        ? await salesInvoiceApi.createReturn(returnAgainst, { reason: row.return_reason || "", items: row.items.map((item) => ({ against_item_id: item.against_item_id || "", quantity: Math.abs(item.quantity) })) })
        : isNew ? await salesInvoiceApi.create(row) : await salesInvoiceApi.update(id!, row);
      setRow(saved); toast.success(saved.is_return ? "Credit Note berhasil dibuat" : "Sales Invoice berhasil disimpan");
      if (isNew && saved.id) navigate(`/desk/sales-invoice/${saved.id}`, { replace: true });
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menyimpan Sales Invoice"); }
    finally { setSaving(false); }
  };
  const submit = async () => { if (!id) return; try { setRow(await salesInvoiceApi.submit(id)); toast.success("Dokumen Submitted"); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal submit dokumen"); } };
  const markPaid = async () => { if (!id) return; try { setRow(await salesInvoiceApi.markPaid(id)); toast.success("Payment Entry dicatat sebagai lunas"); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal mencatat pembayaran"); } };
  const refund = async () => { if (!id) return; const reference = window.prompt("Referensi refund bank/payment gateway:", row.refund_reference || ""); if (reference == null) return; try { setRow(await salesInvoiceApi.refund(id, reference)); toast.success("Refund berhasil dicatat"); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal mencatat refund"); } };
  const remove = async () => { if (!id || !window.confirm("Hapus draft ini?")) return; try { await salesInvoiceApi.remove(id); navigate("/desk/sales-invoice"); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menghapus draft"); } };
  if (loading) return <div className="p-12 text-center text-slate-500">Memuat Sales Invoice...</div>;
  return <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
    <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link to="/desk/sales-invoice"><ArrowLeft className="size-4" /></Link></Button><div><p className="text-sm text-slate-500">Selling / {row.is_return ? "Credit Note" : "Sales Invoice"}</p><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{isNew ? row.is_return ? "New Credit Note" : "New Sales Invoice" : row.number}</h1><Badge variant={row.status === "Submitted" ? "default" : "secondary"}>{isNew ? "Not Saved" : row.status}</Badge>{row.is_return && <Badge className="bg-amber-100 text-amber-700">{row.refund_status}</Badge>}</div></div></div>
      <div className="flex flex-wrap gap-2">{!isNew && row.status === "Submitted" && !row.is_return && <><Button variant="outline" onClick={() => navigate(`/desk/sales-invoice/new?return_against=${row.id}`)}><RotateCcw className="size-4" /> Create Return</Button>{row.delivery_note_id && <Button variant="outline" onClick={() => navigate(`/desk/delivery-note/new?return_against=${row.delivery_note_id}`)}><Warehouse className="size-4" /> Return Stock</Button>}{!row.is_paid && <Button variant="outline" onClick={markPaid}><Banknote className="size-4" /> Mark Paid</Button>}</>}{!isNew && row.status === "Submitted" && row.is_return && row.refund_status === "Pending Refund" && <Button variant="outline" onClick={refund}><Banknote className="size-4" /> Record Refund</Button>}{!isNew && row.status === "Draft" && <><Button variant="outline" onClick={submit}><CheckCircle2 className="size-4" /> Submit</Button><Button variant="outline" onClick={remove}><Trash2 className="size-4 text-red-500" /></Button></>}{(isNew || (row.status === "Draft" && !row.is_return)) && <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700"><Save className="size-4" /> {saving ? "Saving..." : "Save"}</Button>}</div>
    </header>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Customer<Input className="mt-1" value={row.customer} onChange={(event) => update("customer", event.target.value)} /></label><label className="text-sm font-medium">Posting Date<Input className="mt-1" type="date" value={row.posting_date?.slice(0, 10)} onChange={(event) => update("posting_date", event.target.value)} /></label><label className="text-sm font-medium">Tax Rate (%)<Input className="mt-1" type="number" value={row.tax_rate} onChange={(event) => update("tax_rate", Number(event.target.value))} /></label>{row.is_return && <label className="text-sm font-medium md:col-span-3">Return Against<Input className="mt-1" readOnly value={row.return_against_id || ""} /><span className="mt-3 block">Alasan Return</span><Input className="mt-1" value={row.return_reason || ""} onChange={(event) => update("return_reason", event.target.value)} placeholder="Rusak, bocor, salah item, refund tanpa barang kembali, dll." /></label>}</div></section>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Items</h2>{!row.is_return && (isNew || row.status === "Draft") && <Button variant="outline" size="sm" onClick={() => update("items", [...row.items, { item_code: "", item_name: "", quantity: 1, uom: "Nos", rate: 0, amount: 0 }])}><Plus className="size-4" /> Add Item</Button>}</div><div className="overflow-x-auto"><table className="w-full min-w-[750px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">UOM</th><th className="p-3">Rate</th><th className="p-3 text-right">Amount</th><th /></tr></thead><tbody>{row.items.map((item, index) => <tr key={item.id || index} className="border-t"><td className="p-3"><Input value={item.item_code} onChange={(event) => updateItem(index, { item_code: event.target.value })} /><Input className="mt-1" value={item.item_name || ""} onChange={(event) => updateItem(index, { item_name: event.target.value })} placeholder="Item name" /></td><td className="p-3"><Input type="number" min="0" value={Math.abs(item.quantity)} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></td><td className="p-3"><Input value={item.uom} onChange={(event) => updateItem(index, { uom: event.target.value })} /></td><td className="p-3"><Input type="number" min="0" value={item.rate} onChange={(event) => updateItem(index, { rate: Number(event.target.value) })} /></td><td className={`p-3 text-right font-semibold ${row.is_return ? "text-red-600" : ""}`}>{money(item.amount)}</td><td className="p-3">{!row.is_return && row.items.length > 1 && <Button variant="ghost" size="icon" onClick={() => update("items", row.items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4 text-red-500" /></Button>}</td></tr>)}</tbody></table></div></section>
    <section className="ml-auto grid max-w-md grid-cols-2 gap-2 rounded-2xl border bg-white p-5 text-sm shadow-sm"><span>Net Total</span><strong className="text-right">{money(row.net_total)}</strong><span>Tax</span><strong className="text-right">{money(row.tax_amount)}</strong><span className="border-t pt-2">Grand Total</span><strong className={`border-t pt-2 text-right text-lg ${row.is_return ? "text-red-600" : ""}`}>{money(row.grand_total)}</strong></section>
  </div>;
}
