import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { ReportView } from "@/components/reports/ReportView";
import { buyingApi, dateForInput, type PurchaseOrder } from "../api";

const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value || 0);

export default function PurchaseAnalyticsPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await buyingApi.list({ page_size: 100 }); setOrders(response.data || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => [
    { accessorKey: "number", header: "Purchase Order", cell: ({ row }: any) => <Link className="font-semibold text-blue-600 hover:underline" to={`/desk/purchase-order/${row.original.id}`}>{row.original.number || row.original.id}</Link>, meta: { label: "Purchase Order" } },
    { accessorKey: "supplier", header: "Supplier", meta: { label: "Supplier", cellClassName: "font-medium" } },
    { accessorKey: "company", header: "Company", meta: { label: "Company" } },
    { accessorKey: "transaction_date", header: "Date", cell: ({ row }: any) => dateForInput(row.original.transaction_date), meta: { label: "Date" } },
    { accessorKey: "status", header: "Status", cell: ({ row }: any) => <Badge variant={row.original.status === "submitted" ? "default" : "secondary"}>{row.original.status}</Badge>, meta: { label: "Status" } },
    { accessorKey: "rounded_total", header: "Total", cell: ({ row }: any) => money(row.original.rounded_total, row.original.currency), meta: { label: "Total", cellClassName: "text-right font-semibold" } },
  ], []);

  return <div className="min-h-full bg-slate-50/60 p-4 lg:p-7"><div className="mx-auto max-w-screen-2xl"><div className="mb-5"><p className="text-sm font-semibold text-blue-600">Buying / Reports</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Purchase Analytics</h1><p className="mt-1 text-sm text-slate-500">Analisis pesanan pembelian berdasarkan supplier, company, status, dan total.</p></div><ReportView title="Purchase Analytics" description={`${orders.length} purchase order tersedia`} data={orders} columns={columns} loading={loading} onRefresh={load} getRowId={(row) => row.id || row.number} searchPlaceholder="Cari purchase order, supplier, company..." emptyMessage="Belum ada data Purchase Analytics." /></div></div>;
}
