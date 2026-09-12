import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FilePlus2, Search, Pencil, Trash2, Users, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { customerApi, type Customer } from "../customerApi";

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerApi.list(q);
      setRows(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengambil customer");
    } finally {
      setLoading(false);
    }
  }, [q]);

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
      <section className="overflow-hidden rounded-2xl border bg-white shadow-xs dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b p-4">
          <Search className="size-4 text-slate-400" />
          <Input
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="Cari customer berdasarkan nama, email, telepon, group, territory..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Memuat customer...</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center p-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 mb-3">
              <Users className="size-7" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Belum ada customer</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              Mulai tambahkan customer untuk membuat penawaran harga, sales order, dan invoice penjualan.
            </p>
            <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
              <Link to="/desk/customer/new">
                <FilePlus2 className="mr-2 size-4" />
                Tambah Customer Sekarang
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Nama Customer</th>
                  <th className="px-5 py-3">Tipe</th>
                  <th className="px-5 py-3">Customer Group</th>
                  <th className="px-5 py-3">Territory</th>
                  <th className="px-5 py-3">Kontak</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => navigate(`/desk/customer/${r.id}`)}
                  >
                    <td className="px-5 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        {r.customer_type === "Company" ? (
                          <Building2 className="size-4 text-slate-400" />
                        ) : (
                          <User className="size-4 text-slate-400" />
                        )}
                        <span className="text-blue-600 hover:underline">{r.customer_name}</span>
                        {r.is_default_for_pos && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            POS Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {r.customer_type || "Company"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {r.customer_group || "-"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {r.territory || "-"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col text-xs">
                        {r.email && <span>{r.email}</span>}
                        {r.phone && <span className="text-slate-400">{r.phone}</span>}
                        {!r.email && !r.phone && <span className="text-slate-400">-</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={r.disabled ? "secondary" : "default"}>
                        {r.disabled ? "Nonaktif" : "Aktif"}
                      </Badge>
                    </td>
                    <td
                      className="px-5 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-400 hover:text-blue-600"
                        asChild
                      >
                        <Link to={`/desk/customer/${r.id}`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => remove(r)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
