import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const supplier = type === "supplier";
  const [rows, setRows] = useState<Array<Supplier | Item>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
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
  const openItem = async (item: Item) => {
    setSelectedItem(item);
    if (!item.id) return;
    try {
      setSelectedItem(await buyingApi.itemGet(item.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal mengambil detail Item");
    }
  };
  const removeItem = async () => {
    if (!deleteTarget?.id) return;
    const targetID = deleteTarget.id;
    setDeleting(true);
    try {
      await buyingApi.itemRemove(targetID);
      if (selectedItem?.id === targetID) setSelectedItem(null);
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
    <div className="mx-auto max-w-screen-2xl space-y-6 p-5 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">{moduleLabel}</p>
          <h1 className="mt-1 text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Kelola master {title.toLowerCase()} untuk transaksi {transactionLabel}.
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to={`${base}/new${workspaceQuery}`} state={{ workspace }}>
            <FilePlus2 className="size-4" /> New {title}
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
                        onClick={() => !supplier && openItem(i)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-900 ${
                          !supplier ? "cursor-pointer" : ""
                        }`}
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
      {!supplier && (
        <Dialog
          open={Boolean(selectedItem)}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        >
          <DialogContent className="max-h-[90vh] max-w-8xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedItem?.item_code || "Item"}</DialogTitle>
              <DialogDescription>
                {selectedItem?.item_name || "Detail lengkap Item"}
              </DialogDescription>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-6 text-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Item Code</p>
                    <p className="font-semibold">
                      {selectedItem.item_code || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Item Name</p>
                    <p className="font-semibold">
                      {selectedItem.item_name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Item Group</p>
                    <p>{selectedItem.item_group || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Stock UOM</p>
                    <p>{selectedItem.stock_uom || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <Badge
                      variant={selectedItem.disabled
                        ? "destructive"
                        : "secondary"}
                    >
                      {selectedItem.disabled ? "Disabled" : "Active"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Brand</p>
                    <p>{selectedItem.brand || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Standard Rate</p>
                    <p>{selectedItem.standard_rate || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Description</p>
                    <p>{selectedItem.description || "—"}</p>
                  </div>
                </div>
                <section>
                  <h3 className="mb-3 border-b pb-2 font-semibold">
                    Inventory & Settings
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <p>
                      Maintain Stock:{" "}
                      <b>{selectedItem.is_stock_item ? "Yes" : "No"}</b>
                    </p>
                    <p>
                      Opening Stock: <b>{selectedItem.opening_stock}</b>
                    </p>
                    <p>
                      Valuation Method:{" "}
                      <b>{selectedItem.valuation_method || "—"}</b>
                    </p>
                    <p>
                      Valuation Rate: <b>{selectedItem.valuation_rate}</b>
                    </p>
                    <p>
                      Allow Negative Stock:{" "}
                      <b>{selectedItem.allow_negative_stock ? "Yes" : "No"}</b>
                    </p>
                    <p>
                      Has Batch No:{" "}
                      <b>{selectedItem.has_batch_no ? "Yes" : "No"}</b>
                    </p>
                    <p>
                      Shelf Life: <b>{selectedItem.shelf_life_in_days} days</b>
                    </p>
                    <p>
                      End of Life: <b>{selectedItem.end_of_life || "—"}</b>
                    </p>
                    <p>
                      Weight:{" "}
                      <b>
                        {selectedItem.weight_per_unit} {selectedItem.weight_uom}
                      </b>
                    </p>
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 border-b pb-2 font-semibold">
                    Purchasing & Sales
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <p>
                      Purchase Item:{" "}
                      <b>{selectedItem.is_purchase_item ? "Yes" : "No"}</b>
                    </p>
                    <p>
                      Purchase UOM: <b>{selectedItem.purchase_uom || "—"}</b>
                    </p>
                    <p>
                      Minimum Order Qty: <b>{selectedItem.min_order_qty}</b>
                    </p>
                    <p>
                      Safety Stock: <b>{selectedItem.safety_stock}</b>
                    </p>
                    <p>
                      Lead Time: <b>{selectedItem.lead_time_days} days</b>
                    </p>
                    <p>
                      Customer Provided:{" "}
                      <b>
                        {selectedItem.is_customer_provided_item ? "Yes" : "No"}
                      </b>
                    </p>
                    <p>
                      Delivered by Supplier:{" "}
                      <b>{selectedItem.delivered_by_supplier ? "Yes" : "No"}</b>
                    </p>
                    <p>
                      Income Account:{" "}
                      <b>{selectedItem.income_account || "—"}</b>
                    </p>
                    <p>
                      Expense Account:{" "}
                      <b>{selectedItem.expense_account || "—"}</b>
                    </p>
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 border-b pb-2 font-semibold">
                    Units of Measure
                  </h3>
                  {selectedItem.uoms?.length
                    ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="p-2">UOM</th>
                              <th className="p-2">Conversion Factor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.uoms.map((u, index) => (
                              <tr className="border-t" key={u.id || index}>
                                <td className="p-2">{u.uom || "—"}</td>
                                <td className="p-2">{u.conversion_factor}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                    : <p className="text-slate-500">No rows</p>}
                </section>
                <section>
                  <h3 className="mb-3 border-b pb-2 font-semibold">
                    Barcodes, Reorder & Suppliers
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <p>
                      Barcodes: <b>{selectedItem.barcodes?.length || 0}</b>
                    </p>
                    <p>
                      Reorder Levels:{" "}
                      <b>{selectedItem.reorder_levels?.length || 0}</b>
                    </p>
                    <p>
                      Suppliers:{" "}
                      <b>{selectedItem.supplier_items?.length || 0}</b>
                    </p>
                  </div>
                  {selectedItem.barcodes?.length
                    ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedItem.barcodes.map((b, index) => (
                          <Badge variant="outline" key={b.id || index}>
                            {b.barcode} {b.uom ? `· ${b.uom}` : ""}
                          </Badge>
                        ))}
                      </div>
                    )
                    : null}
                </section>
              </div>
            )}
            <DialogFooter className="sm:justify-between">
              {selectedItem && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(selectedItem)}
                >
                  <Trash2 className="size-4" /> Hapus Item
                </Button>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>
                  Close
                </Button>
                {selectedItem && (
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link
                      to={`/desk/item/${selectedItem.id}${workspaceQuery}`}
                      state={{ workspace, item: selectedItem }}
                    >
                      <Pencil className="size-4" /> Edit Item
                    </Link>
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
