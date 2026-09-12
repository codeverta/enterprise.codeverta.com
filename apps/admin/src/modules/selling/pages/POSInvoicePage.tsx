import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { posApi, type POSInvoice } from "../posApi";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function POSInvoicePage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await posApi.listInvoices());
    } catch {
      toast.error("Gagal memuat POS Invoice");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnDef<POSInvoice>[] = [
    { accessorKey: "invoice_number", header: "Invoice", cell: ({ row }) => <Link to={`/desk/pos-invoice/${row.original.id || row.original.invoice_number}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">{row.original.invoice_number}</Link> },
    { accessorKey: "customer", header: "Customer", cell: ({ row }) => row.original.customer || "Walk-in Customer" },
    { id: "items", header: "Items", accessorFn: (row) => row.items.reduce((sum, item) => sum + item.quantity, 0), cell: ({ row }) => row.original.items.reduce((sum, item) => sum + item.quantity, 0) },
    { accessorKey: "mode_of_payment", header: "Payment" },
    { accessorKey: "grand_total", header: "Total", cell: ({ row }) => <span className="font-semibold">{money(row.original.grand_total || 0)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{row.original.status || "Paid"}</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => <span className="text-xs text-slate-500">{row.original.created_at ? new Date(row.original.created_at).toLocaleString("id-ID") : "—"}</span> },
  ];

  return (
    <ERPPage>
        <ERPPageHeader
          title="POS Invoice"
          description="Transaksi penjualan kasir POS, faktur kasir, dan ringkasan penerimaan."
          breadcrumbs={[{ label: "Selling", href: "/desk/selling" }, { label: "POS Invoice" }]}
          actions={<>
            <Button variant="outline" onClick={load}>
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/desk/point-of-sale")}>
              POS Screen
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate("/desk/pos-invoice/new")}>
              <Plus className="mr-1.5 size-4" /> New POS Invoice
            </Button>
          </>}
        />

        <DataTable columns={columns} data={invoices} loading={loading} searchPlaceholder="Cari invoice, customer, payment..." emptyMessage="Belum ada transaksi POS." getRowId={(row, index) => row.id || row.invoice_number || `pos-invoice-${index}`} />
    </ERPPage>
  );
}
