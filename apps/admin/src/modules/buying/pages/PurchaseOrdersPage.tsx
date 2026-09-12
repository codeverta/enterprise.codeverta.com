import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FilePlus2, Eye, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { buyingApi, dateForInput, type PurchaseOrder } from "../api";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";

const money = (value: number, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value || 0);

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await buyingApi.list({ page_size: 200 });
      setOrders(response.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal mengambil Purchase Order");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: "number",
        header: "Purchase Order",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div>
              <Link
                to={`/desk/purchase-order/${order.id}`}
                className="font-semibold text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {order.number || order.id}
              </Link>
              {order.naming_series && (
                <p className="text-[11px] text-slate-400">{order.naming_series}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "supplier",
        header: "Supplier",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div>
              <div className="font-medium text-slate-900 dark:text-white">{order.supplier}</div>
              {order.company && <div className="text-xs text-slate-500">{order.company}</div>}
            </div>
          );
        },
      },
      {
        accessorKey: "transaction_date",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-slate-600 dark:text-slate-300">
            {dateForInput(row.original.transaction_date) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "schedule_date",
        header: "Required By",
        cell: ({ row }) => (
          <span className="text-slate-600 dark:text-slate-300">
            {dateForInput(row.original.schedule_date) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={status === "submitted" ? "default" : "secondary"}
              className={status === "submitted" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "rounded_total",
        header: "Grand Total",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900 dark:text-white">
            {money(row.original.rounded_total || row.original.grand_total, row.original.currency)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        meta: { headerClassName: "text-center w-24", cellClassName: "text-center" },
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const order = row.original;
          return (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Link to={`/desk/purchase-order/${order.id}`}>
                <Eye className="size-3.5" /> Detail
              </Link>
            </Button>
          );
        },
      },
    ],
    []
  );

  return (
    <ERPPage>
      <ERPPageHeader title="Purchase Order" description="Kelola pesanan pembelian supplier dalam satu workflow." breadcrumbs={[{ label: "Buying", href: "/desk/buying" }, { label: "Purchase Order" }]} actions={<Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/purchase-order/new">
            <FilePlus2 className="size-4" /> New Purchase Order
          </Link>
        </Button>}/>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={statusFilter === "" ? "default" : "outline"}
          onClick={() => setStatusFilter("")}
          className={statusFilter === "" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Semua ({orders.length})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "draft" ? "default" : "outline"}
          onClick={() => setStatusFilter("draft")}
          className={statusFilter === "draft" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Draft ({orders.filter((o) => o.status === "draft").length})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "submitted" ? "default" : "outline"}
          onClick={() => setStatusFilter("submitted")}
          className={statusFilter === "submitted" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
        >
          Submitted ({orders.filter((o) => o.status === "submitted").length})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "cancelled" ? "default" : "outline"}
          onClick={() => setStatusFilter("cancelled")}
          className={statusFilter === "cancelled" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Cancelled ({orders.filter((o) => o.status === "cancelled").length})
        </Button>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
        <DataTable
          columns={columns}
          data={filteredOrders}
          loading={loading}
          getRowId={(row) => row.id || row.number || "po"}
          onRowClick={(order) => {
            if (order.id) {
              navigate(`/desk/purchase-order/${order.id}`);
            }
          }}
          searchPlaceholder="Cari purchase order, supplier, company, status..."
          emptyMessage={
            loading ? (
              "Memuat Purchase Order..."
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <ShoppingCart className="size-6" />
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Belum ada Purchase Order
                </p>
                <p className="text-xs text-slate-500">
                  Buat dokumen baru untuk memulai proses pembelian.
                </p>
              </div>
            )
          }
        />
      </section>
    </ERPPage>
  );
}
