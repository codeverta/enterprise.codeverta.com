import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnDef } from "@/components/ui/data-table";
import { ReportView } from "./ReportView";

export type AnalyticsReportRow = {
  id: string;
  date: string;
  voucher: string;
  party: string;
  partyGroup?: string;
  company?: string;
  payment?: string;
  owner?: string;
  costCenter?: string;
  warehouse?: string;
  brand?: string;
  itemGroup?: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
  source?: string;
};

type Props = {
  moduleLabel: string;
  title: string;
  description: string;
  partyLabel: string;
  rows: AnalyticsReportRow[];
  loading?: boolean;
  onRefresh: () => void;
  initialCompany?: string;
  onCompanySelected?: (company: string) => void;
};

const relativeDate = (offset = 0) => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const valuesFor = (rows: AnalyticsReportRow[], key: keyof AnalyticsReportRow) => Array.from(new Set(rows.map((row) => String(row[key] || "")).filter(Boolean))).sort();

function ReportSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-slate-500">{label}</span><Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}><SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All {label}</SelectItem>{values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>;
}

export function TransactionalAnalyticsReport({ moduleLabel, title, description, partyLabel, rows, loading = false, onRefresh, initialCompany = "", onCompanySelected }: Props) {
  const companyApplied = useRef(false);
  const [ledger, setLedger] = useState(false);
  const [filters, setFilters] = useState({ from: relativeDate(-30), to: relativeDate(), party: "", partyGroup: "", company: "", payment: "", owner: "", costCenter: "", warehouse: "", brand: "", itemGroup: "", item: "" });
  useEffect(() => { if (!companyApplied.current && initialCompany) { companyApplied.current = true; setFilters((current) => ({ ...current, company: initialCompany })); } }, [initialCompany]);
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = useMemo(() => rows.filter((row) => row.date >= filters.from && row.date <= filters.to && (!filters.party || row.party === filters.party) && (!filters.partyGroup || row.partyGroup === filters.partyGroup) && (!filters.company || !row.company || row.company === filters.company) && (!filters.payment || row.payment === filters.payment) && (!filters.owner || row.owner === filters.owner) && (!filters.costCenter || row.costCenter === filters.costCenter) && (!filters.warehouse || row.warehouse === filters.warehouse) && (!filters.brand || row.brand === filters.brand) && (!filters.itemGroup || row.itemGroup === filters.itemGroup) && (!filters.item || `${row.itemCode} ${row.itemName}`.toLowerCase().includes(filters.item.toLowerCase()))), [rows, filters]);
  const grouped = useMemo(() => { const map = new Map<string, AnalyticsReportRow>(); filtered.forEach((row) => { const current = map.get(row.itemCode) || { ...row, id: row.itemCode, voucher: "", quantity: 0, amount: 0 }; current.quantity += row.quantity; current.amount += row.amount; map.set(row.itemCode, current); }); return Array.from(map.values()).map((row) => ({ ...row, rate: row.quantity ? row.amount / row.quantity : 0 })); }, [filtered]);
  const displayed = ledger ? filtered : grouped;
  const totalQty = displayed.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = displayed.reduce((sum, row) => sum + row.amount, 0);
  const columns = useMemo<ColumnDef<AnalyticsReportRow>[]>(() => [
    ...(ledger ? [{ accessorKey: "voucher", header: "Voucher", meta: { label: "Voucher", cellClassName: "font-medium text-blue-600" } } as ColumnDef<AnalyticsReportRow>, { accessorKey: "date", header: "Date", meta: { label: "Date" } } as ColumnDef<AnalyticsReportRow>] : []),
    { accessorKey: "itemCode", header: "Item Code", meta: { label: "Item Code", cellClassName: "font-semibold" } }, { accessorKey: "itemName", header: "Item Name", meta: { label: "Item Name" } }, { accessorKey: "party", header: partyLabel, meta: { label: partyLabel } }, { accessorKey: "itemGroup", header: "Item Group", meta: { label: "Item Group" } }, { accessorKey: "warehouse", header: "Warehouse", meta: { label: "Warehouse" } }, { accessorKey: "quantity", header: "Quantity", meta: { label: "Quantity", cellClassName: "text-right" } }, { accessorKey: "rate", header: "Rate (IDR)", cell: ({ row }) => money(row.original.rate), meta: { label: "Rate", cellClassName: "text-right" } }, { accessorKey: "amount", header: "Amount (IDR)", cell: ({ row }) => money(row.original.amount), meta: { label: "Amount", cellClassName: "text-right font-semibold" } },
  ], [ledger, partyLabel]);
  const filterPanel = <div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><label className="space-y-1"><span className="text-xs font-medium text-slate-500">From Date</span><Input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label><label className="space-y-1"><span className="text-xs font-medium text-slate-500">To Date</span><Input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label><ReportSelect label={partyLabel} value={filters.party} values={valuesFor(rows, "party")} onChange={(value) => setFilter("party", value)} /><ReportSelect label={`${partyLabel} Group`} value={filters.partyGroup} values={valuesFor(rows, "partyGroup")} onChange={(value) => setFilter("partyGroup", value)} /><ReportSelect label="Company" value={filters.company} values={valuesFor(rows, "company")} onChange={(value) => { setFilter("company", value); if (value) onCompanySelected?.(value); }} /><ReportSelect label="Mode of Payment" value={filters.payment} values={valuesFor(rows, "payment")} onChange={(value) => setFilter("payment", value)} /><ReportSelect label="Owner" value={filters.owner} values={valuesFor(rows, "owner")} onChange={(value) => setFilter("owner", value)} /><ReportSelect label="Cost Center" value={filters.costCenter} values={valuesFor(rows, "costCenter")} onChange={(value) => setFilter("costCenter", value)} /><ReportSelect label="Warehouse" value={filters.warehouse} values={valuesFor(rows, "warehouse")} onChange={(value) => setFilter("warehouse", value)} /><ReportSelect label="Brand" value={filters.brand} values={valuesFor(rows, "brand")} onChange={(value) => setFilter("brand", value)} /><ReportSelect label="Item Group" value={filters.itemGroup} values={valuesFor(rows, "itemGroup")} onChange={(value) => setFilter("itemGroup", value)} /><label className="space-y-1"><span className="text-xs font-medium text-slate-500">Search Item</span><Input placeholder="Item code / name" value={filters.item} onChange={(event) => setFilter("item", event.target.value)} /></label></div><label className="mt-4 flex items-center gap-2 text-sm"><Checkbox checked={ledger} onCheckedChange={(value) => setLedger(Boolean(value))} /> Show Ledger View <span className="text-xs text-slate-400">({filtered.length} transaksi)</span></label></div>;
  return <div className="min-h-full bg-slate-50/60 p-4 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-5"><div><p className="text-sm text-slate-500">{moduleLabel} / Reports</p><h1 className="mt-1 text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div><ReportView title={ledger ? `${title} Ledger` : `Item-wise ${title} Summary`} description={`${displayed.length} ${ledger ? "baris transaksi" : "item"} ditemukan · Total Qty ${totalQty}`} data={displayed} columns={columns} loading={loading} onRefresh={onRefresh} filters={filterPanel} actions={<><Badge variant="secondary">{money(totalAmount)}</Badge><Button variant="outline" size="sm"><SlidersHorizontal className="size-4" /> Actions</Button></>} getRowId={(row) => row.id} searchPlaceholder={`Cari ${title.toLowerCase()}...`} emptyMessage="Tidak ada transaksi pada filter tersebut." /></div></div>;
}
