import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ReportView } from "@/components/reports/ReportView";
import { buyingApi, dateForInput, type PurchaseInvoice, type PurchaseOrder } from "../api";

type PurchaseRow = { id: string; date: string; voucher: string; supplier: string; company: string; warehouse: string; itemCode: string; itemName: string; quantity: number; rate: number; amount: number; source: "Purchase Order" | "Purchase Invoice" };
type Filters = { from: string; to: string; supplier: string; company: string; itemCode: string };
const date = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value || 0);
const optionValues = (rows: PurchaseRow[], key: keyof PurchaseRow) => Array.from(new Set(rows.map((row) => String(row[key] || "")).filter(Boolean))).sort();

export default function PurchaseAnalyticsPage() {
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState(false);
  const [filters, setFilters] = useState<Filters>({ from: date(-30), to: date(), supplier: "", company: "", itemCode: "" });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, invoices] = await Promise.all([buyingApi.list({ page_size: 100 }), buyingApi.invoiceList({ page_size: 100 })]);
      const orderRows = (orders.data || []).flatMap((order: PurchaseOrder) => (order.items || []).map((item, index) => ({ id: `po-${order.id}-${index}`, date: dateForInput(order.transaction_date), voucher: order.number || order.id || "Purchase Order", supplier: order.supplier, company: order.company, warehouse: item.target_warehouse || order.set_warehouse, itemCode: item.item_code, itemName: item.item_name || item.item_code, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount) || 0, source: "Purchase Order" as const })));
      const invoiceRows = (invoices.data || []).flatMap((invoice: PurchaseInvoice) => (invoice.items || []).map((item, index) => ({ id: `pi-${invoice.id}-${index}`, date: dateForInput(invoice.posting_date), voucher: invoice.number || invoice.id || "Purchase Invoice", supplier: invoice.supplier, company: invoice.company, warehouse: item.warehouse, itemCode: item.item_code, itemName: item.item_name || item.item_code, quantity: Number(item.accepted_qty) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount) || 0, source: "Purchase Invoice" as const })));
      setRows([...orderRows, ...invoiceRows]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = useMemo(() => rows.filter((row) => row.date >= filters.from && row.date <= filters.to && (!filters.supplier || row.supplier === filters.supplier) && (!filters.company || row.company === filters.company) && (!filters.itemCode || `${row.itemCode} ${row.itemName}`.toLowerCase().includes(filters.itemCode.toLowerCase()))), [rows, filters]);
  const grouped = useMemo(() => { const map = new Map<string, PurchaseRow>(); filtered.forEach((row) => { const current = map.get(row.itemCode) || { ...row, id: row.itemCode, voucher: "", quantity: 0, amount: 0 }; current.quantity += row.quantity; current.amount += row.amount; map.set(row.itemCode, current); }); return Array.from(map.values()).map((row) => ({ ...row, rate: row.quantity ? row.amount / row.quantity : 0 })); }, [filtered]);
  const displayRows = ledger ? filtered : grouped;
  const totalQty = displayRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = displayRows.reduce((sum, row) => sum + row.amount, 0);
  const columns = useMemo(() => [
    ...(ledger ? [{ accessorKey: "voucher", header: "Voucher", meta: { label: "Voucher", cellClassName: "font-medium text-blue-600" } }, { accessorKey: "date", header: "Date", meta: { label: "Date" } }] : []),
    { accessorKey: "itemCode", header: "Item Code", meta: { label: "Item Code", cellClassName: "font-semibold" } }, { accessorKey: "itemName", header: "Item Name", meta: { label: "Item Name" } }, { accessorKey: "supplier", header: "Supplier", meta: { label: "Supplier" } }, { accessorKey: "warehouse", header: "Warehouse", meta: { label: "Warehouse" } }, { accessorKey: "quantity", header: "Quantity", meta: { label: "Quantity", cellClassName: "text-right" } }, { accessorKey: "rate", header: "Rate", cell: ({ row }: any) => money(row.original.rate), meta: { label: "Rate", cellClassName: "text-right" } }, { accessorKey: "amount", header: "Amount", cell: ({ row }: any) => money(row.original.amount), meta: { label: "Amount", cellClassName: "text-right font-semibold" } },
  ], [ledger]);
  const filtersView = <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><label className="space-y-1"><span className="text-xs font-medium text-slate-500">From Date</span><Input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} /></label><label className="space-y-1"><span className="text-xs font-medium text-slate-500">To Date</span><Input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} /></label><label className="space-y-1"><span className="text-xs font-medium text-slate-500">Supplier</span><select value={filters.supplier} onChange={(e) => setFilter("supplier", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">All Supplier</option>{optionValues(rows, "supplier").map((value) => <option key={value}>{value}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-medium text-slate-500">Company</span><select value={filters.company} onChange={(e) => setFilter("company", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">All Company</option>{optionValues(rows, "company").map((value) => <option key={value}>{value}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-medium text-slate-500">Search Item</span><Input placeholder="Item code / name" value={filters.itemCode} onChange={(e) => setFilter("itemCode", e.target.value)} /></label><label className="flex items-center gap-2 text-sm md:col-span-2 lg:col-span-5"><Checkbox checked={ledger} onCheckedChange={(value) => setLedger(Boolean(value))} /> Show Ledger View <span className="text-xs text-slate-400">({filtered.length} transaksi)</span></label></div>;
  return <div className="min-h-full bg-slate-50/60 p-4 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-5"><div><p className="text-sm text-slate-500">Buying / Reports</p><h1 className="mt-1 text-2xl font-bold">Purchase Analytics</h1><p className="mt-1 text-sm text-slate-500">Telusuri pembelian per item dan cocokkan dengan dokumen sumber.</p></div><ReportView title={ledger ? "Purchase Ledger" : "Item-wise Purchase Summary"} description={`${displayRows.length} ${ledger ? "baris transaksi" : "item"} ditemukan · Total ${money(totalAmount)}`} data={displayRows} columns={columns} filters={filtersView} loading={loading} onRefresh={load} searchPlaceholder="Cari item, supplier, voucher..." emptyMessage="Tidak ada transaksi pada filter tersebut." getRowId={(row) => row.id} /></div></div>;
}
