import React, { useEffect, useState } from "react";
import { Plus, Trash2, Tag, DollarSign, Save, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import api from "@/lib/api";
import { toast } from "sonner";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { currencyApi, type Currency } from "@/modules/accounting/currencyApi";

export type PriceList = {
  id?: string;
  price_list_name: string;
  currency: string;
  buying: boolean;
  selling: boolean;
  enabled: boolean;
};

export type ItemPrice = {
  id?: string;
  item_code: string;
  item_name: string;
  price_list: string;
  price_list_rate: number;
  currency: string;
  uom: string;
  note?: string;
  is_active: boolean;
};

export default function PriceListPage() {
  const [activeTab, setActiveTab] = useState<"price-list" | "item-price">("price-list");
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [itemPrices, setItemPrices] = useState<ItemPrice[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Dialog State for PriceList
  const [openPLDialog, setOpenPLDialog] = useState(false);
  const [plForm, setPlForm] = useState<PriceList>({
    price_list_name: "",
    currency: "IDR",
    buying: false,
    selling: true,
    enabled: true,
  });

  // Dialog State for ItemPrice
  const [openIPDialog, setOpenIPDialog] = useState(false);
  const [ipForm, setIpForm] = useState<ItemPrice>({
    item_code: "",
    item_name: "",
    price_list: "Standard Selling",
    price_list_rate: 0,
    currency: "IDR",
    uom: "Nos",
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [plRes, ipRes, curData] = await Promise.all([
        api.get<{ data: PriceList[] }>("/selling/price-lists"),
        api.get<{ data: ItemPrice[] }>("/selling/item-prices"),
        currencyApi.list({ enabled: true }).catch(() => []),
      ]);
      setPriceLists(plRes.data.data || []);
      setItemPrices(ipRes.data.data || []);
      setCurrencies(curData || []);
    } catch {
      toast.error("Gagal memuat data Price List & Item Price");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.post("/selling/price-lists/seed");
      toast.success("Standar Selling & Standar Buying berhasil di-seed!");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal seeding Price List");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePriceList = async () => {
    if (!plForm.price_list_name.trim()) {
      return toast.error("Nama Price List wajib diisi");
    }
    try {
      if (plForm.id) {
        await api.put(`/selling/price-lists/${plForm.id}`, plForm);
        toast.success("Price List berhasil diperbarui");
      } else {
        await api.post("/selling/price-lists", plForm);
        toast.success("Price List berhasil dibuat");
      }
      setOpenPLDialog(false);
      loadData();
    } catch {
      toast.error("Gagal menyimpan Price List");
    }
  };

  const handleDeletePriceList = async (id: string) => {
    if (!confirm("Hapus Price List ini?")) return;
    try {
      await api.delete(`/selling/price-lists/${id}`);
      toast.success("Price List terhapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus Price List");
    }
  };

  const handleSaveItemPrice = async () => {
    if (!ipForm.item_code.trim() || !ipForm.price_list.trim()) {
      return toast.error("Item Code dan Price List wajib diisi");
    }
    try {
      if (ipForm.id) {
        await api.put(`/selling/item-prices/${ipForm.id}`, ipForm);
        toast.success("Item Price berhasil diperbarui");
      } else {
        await api.post("/selling/item-prices", ipForm);
        toast.success("Item Price berhasil dibuat");
      }
      setOpenIPDialog(false);
      loadData();
    } catch {
      toast.error("Gagal menyimpan Item Price");
    }
  };

  const handleDeleteItemPrice = async (id: string) => {
    if (!confirm("Hapus Item Price ini?")) return;
    try {
      await api.delete(`/selling/item-prices/${id}`);
      toast.success("Item Price terhapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus Item Price");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <p className="text-sm font-semibold text-blue-600">Selling / Master</p>
          <h1 className="text-2xl font-bold tracking-tight">Price List & Item Price</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola daftar harga jual/beli dan tarif harga produk untuk setiap Price List.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-1.5 cursor-pointer"
          >
            <Database className={`size-4 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed Standar Price List"}</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            disabled={loading}
            title="Refresh Data"
            className="cursor-pointer"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {activeTab === "price-list" ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              onClick={() => {
                setPlForm({
                  price_list_name: "",
                  currency: currencies[0]?.id || "IDR",
                  buying: false,
                  selling: true,
                  enabled: true,
                });
                setOpenPLDialog(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Price List Baru
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              onClick={() => {
                const defaultPL = priceLists[0];
                setIpForm({
                  item_code: "",
                  item_name: "",
                  price_list: defaultPL?.price_list_name || "Standar Selling",
                  price_list_rate: 0,
                  currency: defaultPL?.currency || currencies[0]?.id || "IDR",
                  uom: "Nos",
                  is_active: true,
                });
                setOpenIPDialog(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Item Price Baru
            </Button>
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "price-list" | "item-price")}>
        <TabsList className="mb-4 border-b bg-transparent p-0">
          <TabsTrigger
            value="price-list"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-blue-600 data-[state=active]:font-semibold"
          >
            <Tag className="mr-2 size-4" /> Price Lists ({priceLists.length})
          </TabsTrigger>
          <TabsTrigger
            value="item-price"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-blue-600 data-[state=active]:font-semibold"
          >
            <DollarSign className="mr-2 size-4" /> Item Prices ({itemPrices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="price-list">
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="p-4">Price List Name</th>
                  <th className="p-4">Currency</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {priceLists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {loading ? "Memuat..." : "Belum ada Price List."}
                    </td>
                  </tr>
                ) : (
                  priceLists.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">
                        {row.price_list_name}
                      </td>
                      <td className="p-4">{row.currency}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {row.selling && <Badge variant="default">Selling</Badge>}
                          {row.buying && <Badge variant="secondary">Buying</Badge>}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={row.enabled ? "outline" : "destructive"}>
                          {row.enabled ? "Aktif" : "Non-aktif"}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPlForm(row);
                              setOpenPLDialog(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => row.id && handleDeletePriceList(row.id)}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="item-price">
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="p-4">Item Code</th>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Price List</th>
                  <th className="p-4 text-right">Rate</th>
                  <th className="p-4">UOM</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itemPrices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {loading ? "Memuat..." : "Belum ada Item Price."}
                    </td>
                  </tr>
                ) : (
                  itemPrices.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-4 font-mono font-medium">{row.item_code}</td>
                      <td className="p-4 font-medium">{row.item_name || row.item_code}</td>
                      <td className="p-4">
                        <Badge variant="secondary">{row.price_list}</Badge>
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {row.currency} {row.price_list_rate?.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4">{row.uom || "Nos"}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIpForm(row);
                              setOpenIPDialog(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => row.id && handleDeleteItemPrice(row.id)}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Price List */}
      <Dialog open={openPLDialog} onOpenChange={setOpenPLDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{plForm.id ? "Edit Price List" : "Tambah Price List Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Price List Name</label>
              <Input
                value={plForm.price_list_name}
                onChange={(e) => setPlForm({ ...plForm, price_list_name: e.target.value })}
                placeholder="Contoh: Standard Selling"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <ERPSelect
                className="w-full rounded-md border p-2 text-sm dark:bg-slate-900"
                value={plForm.currency || "IDR"}
                onChange={(e) => setPlForm({ ...plForm, currency: e.target.value })}
              >
                {currencies.length > 0 ? (
                  currencies.map((c) => (
                    <ERPSelectOption key={c.id} value={c.id}>
                      {c.id} - {c.currency_name || c.id} {c.symbol ? `(${c.symbol})` : ""}
                    </ERPSelectOption>
                  ))
                ) : (
                  <>
                    <ERPSelectOption value="IDR">IDR - Indonesian Rupiah (Rp)</ERPSelectOption>
                    <ERPSelectOption value="USD">USD - US Dollar ($)</ERPSelectOption>
                  </>
                )}
              </ERPSelect>
            </div>
            <div className="flex gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={plForm.selling}
                  onChange={(e) => setPlForm({ ...plForm, selling: e.target.checked })}
                />
                Selling
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={plForm.buying}
                  onChange={(e) => setPlForm({ ...plForm, buying: e.target.checked })}
                />
                Buying
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={plForm.enabled}
                  onChange={(e) => setPlForm({ ...plForm, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPLDialog(false)}>
              Batal
            </Button>
            <Button className="bg-blue-600" onClick={handleSavePriceList}>
              <Save className="mr-2 size-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Item Price */}
      <Dialog open={openIPDialog} onOpenChange={setOpenIPDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ipForm.id ? "Edit Item Price" : "Tambah Item Price Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Item Code</label>
              <Input
                value={ipForm.item_code}
                onChange={(e) => setIpForm({ ...ipForm, item_code: e.target.value })}
                placeholder="Contoh: ITEM-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Item Name</label>
              <Input
                value={ipForm.item_name}
                onChange={(e) => setIpForm({ ...ipForm, item_name: e.target.value })}
                placeholder="Nama produk"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price List</label>
              <ERPSelect
                className="w-full rounded-md border p-2 text-sm dark:bg-slate-900"
                value={ipForm.price_list}
                onChange={(e) => {
                  const selectedPL = priceLists.find((p) => p.price_list_name === e.target.value);
                  setIpForm({
                    ...ipForm,
                    price_list: e.target.value,
                    currency: selectedPL?.currency || ipForm.currency,
                  });
                }}
              >
                {priceLists.length > 0 ? (
                  priceLists.map((pl) => (
                    <ERPSelectOption key={pl.id || pl.price_list_name} value={pl.price_list_name}>
                      {pl.price_list_name}
                    </ERPSelectOption>
                  ))
                ) : (
                  <ERPSelectOption value="Standar Selling">Standar Selling</ERPSelectOption>
                )}
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <ERPSelect
                className="w-full rounded-md border p-2 text-sm dark:bg-slate-900"
                value={ipForm.currency || "IDR"}
                onChange={(e) => setIpForm({ ...ipForm, currency: e.target.value })}
              >
                {currencies.length > 0 ? (
                  currencies.map((c) => (
                    <ERPSelectOption key={c.id} value={c.id}>
                      {c.id} - {c.currency_name || c.id} {c.symbol ? `(${c.symbol})` : ""}
                    </ERPSelectOption>
                  ))
                ) : (
                  <>
                    <ERPSelectOption value="IDR">IDR - Indonesian Rupiah (Rp)</ERPSelectOption>
                    <ERPSelectOption value="USD">USD - US Dollar ($)</ERPSelectOption>
                  </>
                )}
              </ERPSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rate / Harga</label>
              <Input
                type="number"
                value={ipForm.price_list_rate}
                onChange={(e) =>
                  setIpForm({ ...ipForm, price_list_rate: parseFloat(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenIPDialog(false)}>
              Batal
            </Button>
            <Button className="bg-blue-600" onClick={handleSaveItemPrice}>
              <Save className="mr-2 size-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
