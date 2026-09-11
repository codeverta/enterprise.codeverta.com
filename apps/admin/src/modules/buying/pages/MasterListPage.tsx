import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Boxes,
  Building2,
  FilePlus2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buyingApi, type Item, type Supplier } from "../api";

export default function MasterListPage(
  { type, workspace = "buying" }: {
    type: "supplier" | "item";
    workspace?: "buying" | "selling";
  },
) {
  const navigate = useNavigate();
  const supplier = type === "supplier";
  const [rows, setRows] = useState<Array<Supplier | Item>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = supplier
        ? await buyingApi.supplierList(query)
        : await buyingApi.itemList(query);
      setRows(result);
      if (!supplier) {
        sessionStorage.setItem("erp.items.cache", JSON.stringify(result));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  }, [query, supplier]);
  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  const removeItem = async () => {
    if (!deleteTarget?.id) return;
    const targetID = deleteTarget.id;
    setDeleting(true);
    try {
      await buyingApi.itemRemove(targetID);
      setDeleteTarget(null);
      toast.success("Item berhasil dihapus");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus Item");
    } finally {
      setDeleting(false);
    }
  };
  const title = supplier ? "Supplier" : "Item",
    base = supplier ? "/desk/supplier" : "/desk/item",
    Icon = supplier ? Building2 : Boxes;
  const moduleLabel = workspace === "selling" ? "Selling" : "Buying";
  const transactionLabel = workspace === "selling" ? "penjualan" : "pembelian";
  const workspaceQuery = supplier ? "" : `?workspace=${workspace}`;
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to={`/desk/${workspace}`} className="hover:text-blue-600">{moduleLabel}</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola master {title.toLowerCase()} untuk transaksi {transactionLabel}.
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to={`${base}/new${workspaceQuery}`} state={{ workspace }}>
            <FilePlus2 className="size-4 mr-2" /> New {title}
          </Link>
        </Button>
      </header>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="relative border-b p-4">
          <Search className="absolute left-7 top-6.5 size-4 text-slate-400" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Cari ${title.toLowerCase()}...`}
          />
        </div>
        {loading
          ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Memuat...
            </div>
          )
          : rows.length === 0
          ? (
            <div className="flex flex-col items-center p-16 text-center">
              <Icon className="mb-4 size-10 text-blue-600" />
              <h2 className="font-semibold">Belum ada {title}</h2>
            </div>
          )
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-5 py-3">
                      {supplier ? "Supplier Name" : "Item Code"}
                    </th>
                    <th className="px-5 py-3">
                      {supplier ? "Supplier Group" : "Item Name"}
                    </th>
                    <th className="px-5 py-3">
                      {supplier ? "Country" : "Item Group"}
                    </th>
                    <th className="px-5 py-3">Status</th>
                    {!supplier && (
                      <th className="px-5 py-3 text-right">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const s = row as Supplier, i = row as Item;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          navigate(`${base}/${row.id}${workspaceQuery}`, {
                            state: !supplier ? { workspace, item: i } : undefined,
                          });
                        }}
                        className="cursor-pointer hover:bg-slate-50 transition-colors dark:hover:bg-slate-900"
                      >
                        <td className="px-5 py-4 font-semibold text-blue-600">
                          <Link
                            to={`${base}/${row.id}${workspaceQuery}`}
                            state={!supplier
                              ? { workspace, item: i }
                              : undefined}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {supplier ? s.supplier_name : i.item_code}
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          {supplier ? s.supplier_group : i.item_name}
                        </td>
                        <td className="px-5 py-4">
                          {supplier ? s.country : i.item_group}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={row.disabled ? "destructive" : "secondary"}
                          >
                            {row.disabled ? "Disabled" : "Active"}
                          </Badge>
                        </td>
                        {!supplier && (
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" asChild>
                                <Link
                                  to={`${base}/${row.id}${workspaceQuery}`}
                                  state={{ workspace, item: i }}
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label={`Edit ${i.item_code}`}
                                >
                                  <Pencil className="size-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Hapus ${i.item_code}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTarget(i);
                                }}
                              >
                                <Trash2 className="size-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </section>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Item <strong>{deleteTarget?.item_code}</strong>{" "}
              akan dihapus dari daftar. Data tetap tersimpan sebagai arsip (soft
              delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void removeItem();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
