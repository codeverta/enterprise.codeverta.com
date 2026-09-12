import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { FilePlus2, Pencil, Trash2, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customerApi, type Customer } from "../customerApi";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

export default function CustomerListPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerApi.list();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengambil customer");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (r: Customer) => {
    if (!r.id || !confirm(`Hapus customer "${r.customer_name}"?`)) return;
    try {
      await customerApi.remove(r.id);
      toast.success("Customer berhasil dihapus");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus customer");
    }
  };

  const columns: ColumnDef<Customer>[] = [
    { id: "name", header: "Nama Customer", accessorKey: "customer_name", cell: ({ row }) => <div className="flex items-center gap-2 font-semibold text-blue-600"><span>{row.original.customer_type === "Company" ? <Building2 className="size-4 text-slate-400" /> : <User className="size-4 text-slate-400" />}</span><Link to={`/desk/customer/${row.original.id}`} className="hover:underline">{row.original.customer_name}</Link>{row.original.is_default_for_pos && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">POS Default</span>}</div> },
    { accessorKey: "customer_type", header: "Tipe", cell: ({ row }) => row.original.customer_type || "Company" },
    { accessorKey: "customer_group", header: "Customer Group", cell: ({ row }) => row.original.customer_group || "-" },
    { accessorKey: "territory", header: "Territory", cell: ({ row }) => row.original.territory || "-" },
    { id: "contact", header: "Kontak", accessorFn: (row) => `${row.email || ""} ${row.phone || ""}`, cell: ({ row }) => <div className="flex flex-col text-xs">{row.original.email && <span>{row.original.email}</span>}{row.original.phone && <span className="text-slate-400">{row.original.phone}</span>}{!row.original.email && !row.original.phone && <span className="text-slate-400">-</span>}</div> },
    { id: "status", header: "Status", accessorFn: (row) => row.disabled ? "Nonaktif" : "Aktif", cell: ({ row }) => <Badge variant={row.original.disabled ? "secondary" : "default"}>{row.original.disabled ? "Nonaktif" : "Aktif"}</Badge> },
    { id: "actions", header: "Aksi", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => <div className="flex justify-end" onClick={(event) => event.stopPropagation()}><Button size="icon" variant="ghost" asChild><Link to={`/desk/customer/${row.original.id}`}><Pencil className="size-4" /></Link></Button><Button size="icon" variant="ghost" onClick={() => remove(row.original)}><Trash2 className="size-4" /></Button></div> },
  ];

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/desk/selling" className="hover:underline">
              Selling
            </Link>
            <span>/</span>
            <span>Customer</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola data pelanggan, informasi kontak, group pelanggan, territory, dan konfigurasi penagihan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/desk/customer/new">
              <FilePlus2 className="mr-2 size-4" />
              Customer Baru
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Table Card */}
      <DataTable columns={columns} data={rows} getRowId={(row) => row.id} searchPlaceholder="Cari customer, email, telepon, group, territory..." emptyMessage={loading ? "Memuat customer..." : "Belum ada customer."} />
    </div>
  );
}
