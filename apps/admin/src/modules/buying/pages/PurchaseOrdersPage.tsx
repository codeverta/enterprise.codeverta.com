import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { FilePlus2, Search, ShoppingCart, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buyingApi, dateForInput, type PurchaseOrder } from "../api";

const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency,
  maximumFractionDigits: currency === "IDR" ? 0 : 2,
}).format(value || 0);

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    try {
      setSelectedOrder(await buyingApi.get(order.id!));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mengambil detail Purchase Order");
    } finally {
      setDetailLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await buyingApi.list({ q: query || undefined, status: status || undefined, page_size: 100 });
      setOrders(response.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mengambil Purchase Order");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-5 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Buying</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Purchase Order</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola pesanan pembelian supplier dalam satu workflow.</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/purchase-order/new"><FilePlus2 className="size-4" /> New Purchase Order</Link>
        </Button>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor, supplier, atau company..." className="pl-9" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Memuat Purchase Order...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShoppingCart className="size-7" /></span>
            <h2 className="font-semibold text-slate-900 dark:text-white">Belum ada Purchase Order</h2>
            <p className="mt-1 text-sm text-slate-500">Buat dokumen pertama untuk memulai proses pembelian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr><th className="px-5 py-3">Purchase Order</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Required By</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Grand Total</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} onClick={() => openDetail(order)} className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="px-5 py-4 font-semibold text-blue-600"><Link onClick={(event) => event.stopPropagation()} to={`/desk/purchase-order/${order.id}`}>{order.number}</Link></td>
                    <td className="px-5 py-4"><div className="font-medium">{order.supplier}</div><div className="text-xs text-slate-500">{order.company}</div></td>
                    <td className="px-5 py-4 text-slate-600">{dateForInput(order.transaction_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{dateForInput(order.schedule_date)}</td>
                    <td className="px-5 py-4"><Badge variant={order.status === "submitted" ? "default" : "secondary"} className={order.status === "submitted" ? "bg-emerald-600" : ""}>{order.status}</Badge></td>
                    <td className="px-5 py-4 text-right font-semibold">{money(order.rounded_total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          {selectedOrder && <>
            <DialogHeader>
              <div className="flex items-center gap-3 pr-8">
                <DialogTitle className="text-2xl">{selectedOrder.number || "Purchase Order"}</DialogTitle>
                <Badge variant={selectedOrder.status === "submitted" ? "default" : "secondary"} className={selectedOrder.status === "submitted" ? "bg-emerald-600" : ""}>{selectedOrder.status}</Badge>
              </div>
              <DialogDescription>Buying / Purchase Order · Detail lengkap dokumen pembelian</DialogDescription>
            </DialogHeader>
            {detailLoading ? <div className="p-12 text-center text-sm text-slate-500">Memuat detail Purchase Order...</div> : <div className="space-y-6 text-sm">
              <div className="grid gap-4 rounded-xl border bg-slate-50/70 p-4 dark:bg-slate-900/50 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Series", selectedOrder.naming_series], ["Supplier", selectedOrder.supplier], ["Company", selectedOrder.company],
                  ["Transaction Date", dateForInput(selectedOrder.transaction_date)], ["Required By", dateForInput(selectedOrder.schedule_date)],
                  ["Currency", selectedOrder.currency], ["Price List", selectedOrder.buying_price_list], ["Cost Center", selectedOrder.cost_center],
                  ["Project", selectedOrder.project], ["Target Warehouse", selectedOrder.set_warehouse], ["Tax Category", selectedOrder.tax_category],
                  ["Taxes & Charges", selectedOrder.taxes_and_charges], ["Shipping Rule", selectedOrder.shipping_rule], ["Incoterm", selectedOrder.incoterm],
                  ["Subcontracted", selectedOrder.is_subcontracted ? "Yes" : "No"], ["Ignore Pricing Rule", selectedOrder.ignore_pricing_rule ? "Yes" : "No"],
                ].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-medium">{value || "—"}</p></div>)}
              </div>

              <section><h3 className="mb-3 font-semibold">Items</h3><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">No.</th><th className="p-3 text-left">Item Code</th><th className="p-3 text-left">Required By</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-left">UOM</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th><th className="p-3 text-left">Target Warehouse</th></tr></thead><tbody>{(selectedOrder.items || []).length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-slate-500">No rows</td></tr> : selectedOrder.items.map((item, index) => <tr className="border-t" key={item.id || index}><td className="p-3 text-center">{index + 1}</td><td className="p-3"><div className="font-medium">{item.item_code}</div><div className="text-xs text-slate-500">{item.item_name || item.description || ""}</div></td><td className="p-3">{dateForInput(item.schedule_date)}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3">{item.uom}</td><td className="p-3 text-right">{money(item.rate, selectedOrder.currency)}</td><td className="p-3 text-right font-medium">{money(item.amount, selectedOrder.currency)}</td><td className="p-3">{item.target_warehouse || "—"}</td></tr>)}</tbody></table></div></section>

              <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-3 font-semibold">Taxes and Charges</h3><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">No.</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Account Head</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{(selectedOrder.taxes || []).length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No rows</td></tr> : selectedOrder.taxes.map((tax, index) => <tr className="border-t" key={tax.id || index}><td className="p-3 text-center">{index + 1}</td><td className="p-3">{tax.charge_type === "actual" ? "Actual" : tax.charge_type === "on_previous_row_total" ? "On Previous Row Total" : "On Net Total"}</td><td className="p-3">{tax.account_head}</td><td className="p-3 text-right">{tax.rate}%</td><td className="p-3 text-right">{money(tax.tax_amount, selectedOrder.currency)}</td></tr>)}</tbody></table></div></section><section><h3 className="mb-3 font-semibold">Totals ({selectedOrder.currency})</h3><div className="rounded-xl border p-4"><div className="flex justify-between border-b py-2"><span>Total Quantity</span><strong>{selectedOrder.total_qty}</strong></div><div className="flex justify-between border-b py-2"><span>Total</span><strong>{money(selectedOrder.total, selectedOrder.currency)}</strong></div><div className="flex justify-between border-b py-2"><span>Total Taxes</span><strong>{money(selectedOrder.total_taxes_and_charges, selectedOrder.currency)}</strong></div><div className="flex justify-between border-b py-2"><span>Additional Discount</span><strong>{money(selectedOrder.additional_discount_amount, selectedOrder.currency)}</strong></div><div className="flex justify-between border-b py-2 text-base"><span>Grand Total</span><strong>{money(selectedOrder.grand_total, selectedOrder.currency)}</strong></div><div className="flex justify-between pt-2 text-base font-bold"><span>Rounded Total</span><strong>{money(selectedOrder.rounded_total, selectedOrder.currency)}</strong></div></div></section></div>

              <div className="grid gap-6 border-t pt-5 md:grid-cols-2"><section><h3 className="mb-2 font-semibold">Address & Contact</h3><p className="whitespace-pre-wrap text-slate-600">{selectedOrder.supplier_address || "Supplier address —"}</p><p className="mt-3 whitespace-pre-wrap text-slate-600">{selectedOrder.shipping_address || "Shipping address —"}</p><p className="mt-3 text-slate-600">{selectedOrder.contact_person || "—"} · {selectedOrder.contact_email || "—"} · {selectedOrder.contact_phone || "—"}</p></section><section><h3 className="mb-2 font-semibold">Terms & More Info</h3><p className="whitespace-pre-wrap text-slate-600">{selectedOrder.terms || "Terms —"}</p><p className="mt-3 text-slate-600">Payment Terms: {selectedOrder.payment_terms_template || "—"}</p><p className="mt-2 text-slate-600">Letter Head: {selectedOrder.letter_head || "—"}</p><p className="mt-2 whitespace-pre-wrap text-slate-600">{selectedOrder.remarks || "Remarks —"}</p></section></div>
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setSelectedOrder(null)}>Tutup</Button>{selectedOrder.id && <Button asChild className="bg-blue-600 hover:bg-blue-700"><Link to={`/desk/purchase-order/${selectedOrder.id}`}><ExternalLink className="size-4" /> Buka / Edit Dokumen</Link></Button>}</DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
