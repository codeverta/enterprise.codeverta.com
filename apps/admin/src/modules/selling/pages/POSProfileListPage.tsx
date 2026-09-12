import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, RefreshCw, UserCheck, CheckCircle2, XCircle, Trash2, Edit3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { posProfileApi, type POSProfile } from "../posProfileApi";
import { toast } from "sonner";

export default function POSProfileListPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<POSProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await posProfileApi.list({
        disabled: statusFilter === "Disabled" ? true : statusFilter === "Active" ? false : undefined,
      });
      setProfiles(data || []);
    } catch {
      toast.error("Gagal mengambil daftar POS Profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [statusFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus POS Profile ${name}?`)) return;
    try {
      await posProfileApi.delete(id);
      toast.success("POS Profile berhasil dihapus");
      loadProfiles();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus POS Profile");
    }
  };

  const columns: ColumnDef<POSProfile>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-semibold text-blue-600">{row.original.name}</span> },
    { accessorKey: "company", header: "Company" },
    { accessorKey: "warehouse", header: "Warehouse", cell: ({ row }) => row.original.warehouse || "—" },
    { id: "users", header: "Cashiers / Users", accessorFn: (row) => row.applicable_for_users?.map((u) => u.user).join(", ") || "All Users", cell: ({ row }) => row.original.applicable_for_users?.map((u) => u.user).join(", ") || "All Users" },
    { id: "payments", header: "Payment Methods", accessorFn: (row) => row.payments?.map((p) => p.mode_of_payment).join(", ") || "Cash", cell: ({ row }) => row.original.payments?.map((p) => p.mode_of_payment).join(", ") || "Cash" },
    { accessorKey: "disabled", header: "Status", cell: ({ row }) => <Badge variant={row.original.disabled ? "destructive" : "default"}>{row.original.disabled ? <><XCircle className="mr-1 size-3 inline" /> Disabled</> : <><CheckCircle2 className="mr-1 size-3 inline" /> Active</>}</Badge> },
    { id: "actions", header: "Actions", enableSorting: false, enableColumnFilter: false, cell: ({ row }) => { const id = row.original.id || row.original.name; return <div className="flex justify-end gap-1"><Button aria-label={`Edit ${row.original.name}`} variant="ghost" size="icon" className="size-8" onClick={() => navigate(`/desk/pos-profile/${id}`)}><Edit3 className="size-4 text-slate-600" /></Button><Button aria-label={`Delete ${row.original.name}`} variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => handleDelete(id, row.original.name)}><Trash2 className="size-4" /></Button><Button aria-label={`Open ${row.original.name}`} variant="ghost" size="icon" className="size-8 text-blue-600" onClick={() => navigate(`/desk/pos-profile/${id}`)}><ArrowRight className="size-4" /></Button></div>; } },
  ];

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">POS Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">POS Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Konfigurasi profil kasir, metode pembayaran, batas pembulatan, dan gudang untuk Point of Sale.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link to="/desk/pos-profile/new">
            <Plus className="mr-2 size-4" /> New POS Profile
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {["All", "Active", "Disabled"].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={loadProfiles} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Table List */}
        <DataTable columns={columns} data={profiles} loading={loading} searchPlaceholder="Cari POS profile, company, warehouse..." emptyMessage="Belum ada POS Profile" getRowId={(row, index) => row.id || row.name || `pos-profile-${index}`} onRowClick={(row) => navigate(`/desk/pos-profile/${row.id || row.name}`)} />
        {/*
          The DataTable owns filtering, loading, empty state, pagination, and row rendering.
        */}
        {false && <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600 font-medium dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Cashiers / Users</th>
                <th className="py-3.5 px-4">Payment Methods</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto size-6 animate-spin mb-2" />
                    Memuat POS Profiles...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <UserCheck className="mx-auto size-12 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Belum ada POS Profile</p>
                    <p className="text-xs text-slate-400 mt-1">Buat POS Profile baru untuk mengaktifkan sesi kasir.</p>
                    <Button className="mt-4 bg-blue-600" asChild>
                      <Link to="/desk/pos-profile/new">
                        <Plus className="mr-2 size-4" /> Buat POS Profile
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                profiles.map((item) => (
                  <tr
                    key={item.id || item.name}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors dark:hover:bg-slate-900/50"
                    onClick={() => navigate(`/desk/pos-profile/${item.id || item.name}`)}
                  >
                    <td className="py-3.5 px-4 font-semibold text-blue-600 hover:underline">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {item.company}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {item.warehouse || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {item.applicable_for_users && item.applicable_for_users.length > 0
                        ? item.applicable_for_users.map((u) => u.user).join(", ")
                        : "All Users"}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {item.payments && item.payments.length > 0
                        ? item.payments.map((p) => p.mode_of_payment).join(", ")
                        : "Cash"}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={item.disabled ? "destructive" : "default"}>
                        {item.disabled ? (
                          <>
                            <XCircle className="mr-1 size-3 inline" /> Disabled
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 size-3 inline" /> Active
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/desk/pos-profile/${item.id || item.name}`)}
                          title="Edit"
                        >
                          <Edit3 className="size-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDelete(item.id || item.name, item.name)}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-blue-600"
                          onClick={() => navigate(`/desk/pos-profile/${item.id || item.name}`)}
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
