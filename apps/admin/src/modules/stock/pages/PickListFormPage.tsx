import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Plus,
  Trash2,
  ScanBarcode,
  Search,
  ExternalLink,
  Layers,
  ArrowRightLeft,
  Truck,
  Sparkles,
  Download,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect, SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { warehouseApi, type CompanyOption } from "../warehouseApi";
import {
  pickListApi,
  type PickList,
  type PickListItem,
  type PickListOptions,
  type PendingReference,
} from "../pickListApi";
import { toast } from "sonner";

const emptyItem = (): PickListItem => ({
  item_code: "",
  item_name: "",
  warehouse: "Stores - PT ZENIT",
  qty: 1,
  stock_qty: 1,
  picked_qty: 0,
  uom: "Nos",
  conversion_factor: 1,
});

const emptyPickList = (): PickList => ({
  naming_series: "STO-PICK-.YYYY.-",
  purpose: "Delivery",
  company: "PT ZENIT TECHNOLOGY SOLUTION",
  company_id: "",
  status: "Draft",
  parent_warehouse: "",
  consider_rejected_warehouses: false,
  pick_manually: false,
  ignore_pricing_rule: false,
  scan_barcode: "",
  scan_mode: false,
  prompt_qty: false,
  total_qty: 0,
  total_picked_qty: 0,
  remarks: "",
  locations: [emptyItem()],
});

export default function PickListFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-pick-list");

  const [row, setRow] = useState<PickList>(emptyPickList());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [options, setOptions] = useState<PickListOptions>({
    naming_series: ["STO-PICK-.YYYY.-"],
    purposes: ["Delivery", "Material Transfer for Manufacture", "Material Transfer"],
    warehouses: [
      "Stores - PT ZENIT",
      "Finished Goods - PT ZENIT",
      "Work In Progress - PT ZENIT",
    ],
    companies: [],
    items: [],
  });

  // Modal "Get Items" state
  const [showGetItemsModal, setShowGetItemsModal] = useState(false);
  const [pendingRefs, setPendingRefs] = useState<PendingReference[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Barcode input state
  const [barcodeInput, setBarcodeInput] = useState("");

  const isReadonly = row.status !== "Draft";

  // Load initial options & companies
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [opts, compList] = await Promise.all([
          pickListApi.getOptions(),
          warehouseApi.listCompanies(),
        ]);
        if (opts) setOptions(opts);
        if (compList && compList.length > 0) {
          setCompanies(compList);
        } else if (opts?.companies) {
          setCompanies(opts.companies);
        }

        if (!isNew && id) {
          const data = await pickListApi.get(id);
          if (data) {
            if (!data.locations || data.locations.length === 0) {
              data.locations = [emptyItem()];
            }
            setRow(data);
          }
        }
      } catch {
        toast.error("Gagal memuat data Pick List");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isNew]);

  // Recalculate totals
  const recalculateTotals = (items: PickListItem[]) => {
    const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const totalPicked = items.reduce((acc, it) => acc + (Number(it.picked_qty) || 0), 0);
    return { totalQty, totalPicked };
  };

  const handleItemChange = (index: number, patch: Partial<PickListItem>) => {
    if (isReadonly) return;
    const newItems = [...row.locations];
    const updated = { ...newItems[index], ...patch };
    if (patch.qty !== undefined && !updated.stock_qty) {
      updated.stock_qty = updated.qty;
    }
    newItems[index] = updated;

    const { totalQty, totalPicked } = recalculateTotals(newItems);
    setRow({
      ...row,
      locations: newItems,
      total_qty: totalQty,
      total_picked_qty: totalPicked,
    });
  };

  const handleAddItem = () => {
    if (isReadonly) return;
    const newItems = [...row.locations, emptyItem()];
    const { totalQty, totalPicked } = recalculateTotals(newItems);
    setRow({
      ...row,
      locations: newItems,
      total_qty: totalQty,
      total_picked_qty: totalPicked,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (isReadonly) return;
    if (row.locations.length <= 1) {
      toast.error("Minimal harus ada 1 item lokasi");
      return;
    }
    const newItems = row.locations.filter((_, i) => i !== index);
    const { totalQty, totalPicked } = recalculateTotals(newItems);
    setRow({
      ...row,
      locations: newItems,
      total_qty: totalQty,
      total_picked_qty: totalPicked,
    });
  };

  const handleSelectCompany = (companyName: string) => {
    const matched = companies.find((c) => c.name === companyName);
    setRow((prev) => ({
      ...prev,
      company: companyName,
      company_id: matched?.id || prev.company_id || "",
    }));
  };

  // Barcode scan handler
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      // Find item in locations or item options
      const itemIndex = row.locations.findIndex(
        (it) => it.item_code.toLowerCase() === code.toLowerCase()
      );

      if (itemIndex >= 0) {
        const item = row.locations[itemIndex];
        const newPicked = (item.picked_qty || 0) + 1;
        handleItemChange(itemIndex, { picked_qty: newPicked });
        toast.success(`Picked: ${item.item_code} (+1) -> Total: ${newPicked}`);
      } else {
        // Find in options
        const matchOpt = (options.items || []).find(
          (o) =>
            o.item_code.toLowerCase() === code.toLowerCase() ||
            o.barcode?.toLowerCase() === code.toLowerCase()
        );
        if (matchOpt) {
          const newItem: PickListItem = {
            item_code: matchOpt.item_code,
            item_name: matchOpt.item_name,
            warehouse: row.parent_warehouse || "Finished Goods - PT ZENIT",
            qty: 1,
            stock_qty: 1,
            picked_qty: 1,
            uom: matchOpt.uom || "Nos",
          };
          const newLocations = [...row.locations, newItem];
          const { totalQty, totalPicked } = recalculateTotals(newLocations);
          setRow({
            ...row,
            locations: newLocations,
            total_qty: totalQty,
            total_picked_qty: totalPicked,
          });
          toast.success(`Ditambahkan dari scan: ${matchOpt.item_code}`);
        } else {
          toast.error(`Barcode/Item ${code} tidak ditemukan`);
        }
      }
      setBarcodeInput("");
    }
  };

  // Open "Get Items" Modal
  const openGetItemsModal = async () => {
    setShowGetItemsModal(true);
    setLoadingRefs(true);
    try {
      const data = await pickListApi.getPendingReferences(row.purpose);
      setPendingRefs(data || []);
      setSelectedRefs([]);
    } catch {
      toast.error("Gagal mengambil data referensi pending");
    } finally {
      setLoadingRefs(false);
    }
  };

  const handleConfirmGetItems = () => {
    const selectedOrders = pendingRefs.filter((p) =>
      selectedRefs.includes(p.document_no)
    );
    if (selectedOrders.length === 0) {
      toast.error("Pilih minimal 1 dokumen pesanan/referensi");
      return;
    }

    const newItems: PickListItem[] = [];
    selectedOrders.forEach((so) => {
      so.items.forEach((it) => {
        newItems.push({
          ...it,
          picked_qty: 0,
        });
      });
    });

    const { totalQty, totalPicked } = recalculateTotals(newItems);
    setRow((prev) => ({
      ...prev,
      locations: newItems,
      total_qty: totalQty,
      total_picked_qty: totalPicked,
    }));
    setShowGetItemsModal(false);
    toast.success(`Berhasil menarik ${newItems.length} item dari referensi`);
  };

  // "Get Item Locations" Action
  const handleGetItemLocations = async () => {
    if (row.locations.length === 0 || !row.locations[0].item_code) {
      toast.error("Wajib masukkan minimal 1 item terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const res = await pickListApi.getItemLocations({
        purpose: row.purpose,
        parent_warehouse: row.parent_warehouse,
        consider_rejected_warehouses: row.consider_rejected_warehouses,
        items: row.locations.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name,
          qty: it.qty,
          uom: it.uom,
          warehouse: it.warehouse,
          sales_order: it.sales_order,
          sales_order_item: it.sales_order_item,
          work_order: it.work_order,
          material_request: it.material_request,
        })),
      });

      if (res && res.locations && res.locations.length > 0) {
        const { totalQty, totalPicked } = recalculateTotals(res.locations);
        setRow((prev) => ({
          ...prev,
          locations: res.locations,
          total_qty: totalQty,
          total_picked_qty: totalPicked,
        }));
        toast.success("Item Locations berhasil dialokasikan (FIFO/Expiry)");
      } else {
        toast.info("Tidak ada perubahan lokasi");
      }
    } catch {
      toast.error("Gagal mendapatkan alokasi Item Locations");
    } finally {
      setLoading(false);
    }
  };

  // Save / Update
  const handleSave = async () => {
    if (!row.company) {
      toast.error("Company wajib dipilih");
      return;
    }
    if (!row.locations || row.locations.length === 0 || !row.locations[0].item_code) {
      toast.error("Item locations wajib memiliki minimal 1 baris item");
      return;
    }

    setSaving(true);
    try {
      const { totalQty, totalPicked } = recalculateTotals(row.locations);
      const payload: Partial<PickList> = {
        ...row,
        total_qty: totalQty,
        total_picked_qty: totalPicked,
      };

      if (isNew) {
        const created = await pickListApi.create(payload);
        toast.success("Pick List berhasil dibuat");
        navigate(`/desk/pick-list/${created.id}`);
      } else {
        const updated = await pickListApi.update(id!, payload);
        toast.success("Pick List berhasil diperbarui");
        setRow(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Pick List");
    } finally {
      setSaving(false);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!confirm("Submit Pick List? Status akan berubah menjadi Submitted.")) return;
    setSaving(true);
    try {
      const submitted = await pickListApi.submit(id!);
      toast.success("Pick List berhasil di-submit");
      setRow(submitted);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal men-submit Pick List");
    } finally {
      setSaving(false);
    }
  };

  // Cancel
  const handleCancel = async () => {
    if (!confirm("Batalkan Pick List ini?")) return;
    setSaving(true);
    try {
      const cancelled = await pickListApi.cancel(id!);
      toast.success("Pick List berhasil dibatalkan");
      setRow(cancelled);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal membatalkan Pick List");
    } finally {
      setSaving(false);
    }
  };

  // Navigation actions when submitted
  const handleCreateDeliveryNote = () => {
    // Navigate to Delivery Note form with prepopulated query params
    const itemParam = encodeURIComponent(
      JSON.stringify(
        row.locations.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name,
          warehouse: it.warehouse,
          qty: it.picked_qty || it.qty,
          uom: it.uom,
          batch_no: it.batch_no,
          serial_no: it.serial_no,
        }))
      )
    );
    navigate(
      `/desk/delivery-note/new?company=${encodeURIComponent(row.company)}&items=${itemParam}`
    );
  };

  const handleCreateStockEntry = () => {
    navigate(`/desk/stock-entry/new?company=${encodeURIComponent(row.company)}`);
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Action Bar */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
            <span>/</span>
            <Link to="/desk/pick-list" className="hover:text-blue-600">Pick List</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Pick List" : row.pick_list_number || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Pick List" : row.pick_list_number || "Pick List"}
            </h1>
            <Badge
              variant={
                row.status === "Submitted"
                  ? "default"
                  : row.status === "Cancelled"
                  ? "destructive"
                  : "secondary"
              }
            >
              {row.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/pick-list">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          {!isReadonly && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="mr-2 size-4" />
              {saving ? "Menyimpan..." : "Save"}
            </Button>
          )}

          {!isNew && row.status === "Draft" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmit}
              disabled={saving}
            >
              <CheckCircle2 className="mr-2 size-4" />
              Submit
            </Button>
          )}

          {!isNew && row.status === "Submitted" && (
            <>
              {row.purpose === "Delivery" ? (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCreateDeliveryNote}
                >
                  <Truck className="mr-2 size-4" />
                  Create Delivery Note
                </Button>
              ) : (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCreateStockEntry}
                >
                  <ArrowRightLeft className="mr-2 size-4" />
                  Create Stock Entry
                </Button>
              )}

              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={saving}
              >
                <RotateCcw className="mr-2 size-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Details & Picking Configuration Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Form Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
              Informasi Utama
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.company}
                    disabled={isReadonly}
                    options={(companies.length > 0
                      ? companies
                      : (options.companies || []).map((name) => ({ name }))
                    ).map((c) => ({
                      value: c.name,
                      label: c.name,
                      badge: c.abbreviation || undefined,
                      sublabel: c.id ? `ID: ${c.id}` : undefined,
                    }))}
                    onChange={(val) => handleSelectCompany(val)}
                    placeholder="Pilih Company..."
                    searchPlaceholder="Cari nama company..."
                  />
                </div>
                {row.company_id && (
                  <p className="mt-1 text-[10px] text-slate-400 font-mono truncate">
                    ID: {row.company_id}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    value={row.purpose}
                    disabled={isReadonly}
                    onChange={(e) =>
                      setRow({ ...row, purpose: e.target.value as any })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="Delivery">Delivery</option>
                    <option value="Material Transfer for Manufacture">
                      Material Transfer for Manufacture
                    </option>
                    <option value="Material Transfer">Material Transfer</option>
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {row.purpose === "Delivery"
                    ? "Mengambil barang untuk pemenuhan Delivery Note / Sales Order"
                    : row.purpose === "Material Transfer for Manufacture"
                    ? "Mengambil bahan baku untuk pengerjaan Work Order"
                    : "Transfer stok barang antar gudang internal"}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Series
                </label>
                <Input
                  value={row.naming_series}
                  disabled
                  className="mt-1 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Parent Warehouse
                </label>
                <div className="mt-1">
                  <SearchableWarehouseSelect
                    value={row.parent_warehouse || ""}
                    disabled={isReadonly}
                    warehouses={options.warehouses || []}
                    placeholder="Semua gudang (atau pilih parent)..."
                    onChange={(wh) => setRow({ ...row, parent_warehouse: wh })}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Jika diset, pencarian stok FIFO dibatasi pada grup gudang ini.
                </p>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid gap-3 pt-2 sm:grid-cols-3 border-t">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.consider_rejected_warehouses}
                  disabled={isReadonly}
                  onCheckedChange={(c) =>
                    setRow({ ...row, consider_rejected_warehouses: !!c })
                  }
                />
                Consider Rejected Warehouses
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.pick_manually}
                  disabled={isReadonly}
                  onCheckedChange={(c) =>
                    setRow({ ...row, pick_manually: !!c })
                  }
                />
                Pick Manually
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.ignore_pricing_rule}
                  disabled={isReadonly}
                  onCheckedChange={(c) =>
                    setRow({ ...row, ignore_pricing_rule: !!c })
                  }
                />
                Ignore Pricing Rule
              </label>
            </div>
          </div>

          {/* Barcode Scanner & Quick Pick Strip */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanBarcode className="size-5 text-blue-600" />
                <span className="font-semibold text-sm">Scan Barcode / Serial / Batch</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={row.scan_mode}
                    disabled={isReadonly}
                    onCheckedChange={(c) => setRow({ ...row, scan_mode: !!c })}
                  />
                  Scan Mode
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={row.prompt_qty}
                    disabled={isReadonly}
                    onCheckedChange={(c) => setRow({ ...row, prompt_qty: !!c })}
                  />
                  Prompt Qty
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Arahkan barcode scanner atau ketik item code / barcode lalu Enter..."
                value={barcodeInput}
                disabled={isReadonly}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              * Scan kode item atau barcode untuk menambah picked quantity secara instan.
            </p>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
              Action & Pengambilan
            </h2>

            {!isReadonly && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={openGetItemsModal}
                >
                  <Download className="mr-2 size-4" />
                  Get Items ({row.purpose})
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={handleGetItemLocations}
                  disabled={loading}
                >
                  <Sparkles className="mr-2 size-4" />
                  Get Item Locations (FIFO)
                </Button>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-4 space-y-3 dark:bg-slate-900 border">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Total Items To Pick:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {row.locations.length} baris
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Total Target Qty:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {row.total_qty}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 border-t pt-2">
                <span>Total Picked Qty:</span>
                <span
                  className={`font-bold text-sm ${
                    row.total_picked_qty >= row.total_qty && row.total_qty > 0
                      ? "text-emerald-600"
                      : "text-blue-600"
                  }`}
                >
                  {row.total_picked_qty} / {row.total_qty}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      row.total_qty > 0
                        ? Math.min(100, (row.total_picked_qty / row.total_qty) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Catatan / Remarks
              </label>
              <textarea
                value={row.remarks || ""}
                disabled={isReadonly}
                onChange={(e) => setRow({ ...row, remarks: e.target.value })}
                rows={3}
                placeholder="Instruksi packing, nomor bay gudang, catatan kurir..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Item Locations Table */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">
              Item Locations (Lokasi Pengambilan Barang)
            </h2>
            <p className="text-xs text-slate-500">
              Gudang, Batch No, dan Serial No yang dialokasikan berdasarkan First-In-First-Out (FIFO) atau Batch Expired terdekat.
            </p>
          </div>
          {!isReadonly && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetItemLocations}
                className="text-emerald-600 border-emerald-200"
              >
                <Sparkles className="mr-1.5 size-3.5" /> Auto-Allocate Locations
              </Button>
              <Button
                size="sm"
                onClick={handleAddItem}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-1.5 size-3.5" /> Tambah Baris
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Item Code & Name</th>
                <th className="py-2.5 px-3 min-w-[200px]">Warehouse</th>
                <th className="py-2.5 px-3 w-24 text-right">Qty</th>
                <th className="py-2.5 px-3 w-28 text-right">Picked Qty</th>
                <th className="py-2.5 px-3 w-20">UOM</th>
                <th className="py-2.5 px-3 min-w-[130px]">Batch No</th>
                <th className="py-2.5 px-3 min-w-[130px]">Serial No</th>
                <th className="py-2.5 px-3 min-w-[150px]">Reference</th>
                {!isReadonly && <th className="py-2.5 px-3 w-12 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {row.locations.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <Input
                        value={item.item_code}
                        disabled={isReadonly}
                        placeholder="Kode Item (cth: FG-001)"
                        onChange={(e) =>
                          handleItemChange(idx, { item_code: e.target.value })
                        }
                        className="h-8 text-xs font-semibold"
                      />
                      <Input
                        value={item.item_name || ""}
                        disabled={isReadonly}
                        placeholder="Deskripsi item..."
                        onChange={(e) =>
                          handleItemChange(idx, { item_name: e.target.value })
                        }
                        className="h-7 text-[11px] text-slate-500"
                      />
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <SearchableWarehouseSelect
                      value={item.warehouse}
                      disabled={isReadonly}
                      warehouses={options.warehouses || []}
                      placeholder="Pilih gudang..."
                      onChange={(wh) => handleItemChange(idx, { warehouse: wh })}
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <Input
                      type="number"
                      value={item.qty}
                      disabled={isReadonly}
                      min={0}
                      step="any"
                      onChange={(e) =>
                        handleItemChange(idx, { qty: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs text-right font-medium"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <Input
                      type="number"
                      value={item.picked_qty}
                      disabled={isReadonly}
                      min={0}
                      step="any"
                      onChange={(e) =>
                        handleItemChange(idx, {
                          picked_qty: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={`h-8 text-xs text-right font-bold ${
                        item.picked_qty >= item.qty && item.qty > 0
                          ? "border-emerald-500 bg-emerald-50/40 text-emerald-700"
                          : ""
                      }`}
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <Input
                      value={item.uom || "Nos"}
                      disabled={isReadonly}
                      onChange={(e) => handleItemChange(idx, { uom: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <Input
                      value={item.batch_no || ""}
                      disabled={isReadonly}
                      placeholder="Batch No (FIFO)"
                      onChange={(e) =>
                        handleItemChange(idx, { batch_no: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <Input
                      value={item.serial_no || ""}
                      disabled={isReadonly}
                      placeholder="Serial No..."
                      onChange={(e) =>
                        handleItemChange(idx, { serial_no: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      {item.sales_order && <div>SO: {item.sales_order}</div>}
                      {item.work_order && <div>WO: {item.work_order}</div>}
                      {item.material_request && <div>MR: {item.material_request}</div>}
                      {!item.sales_order && !item.work_order && !item.material_request && (
                        <span className="text-slate-400 italic">Manual</span>
                      )}
                    </div>
                  </td>

                  {!isReadonly && (
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Get Items from Pending References */}
      {showGetItemsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-2xl dark:bg-slate-950 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg">
                  Get Items from Pending {row.purpose}
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih dokumen pesanan yang belum terpenuhi untuk ditarik ke dalam Pick List.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGetItemsModal(false)}
              >
                ✕
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {loadingRefs ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Memuat dokumen pesanan pending...
                </div>
              ) : pendingRefs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Tidak ada pesanan pending yang ditemukan.
                </div>
              ) : (
                pendingRefs.map((ref) => {
                  const isChecked = selectedRefs.includes(ref.document_no);
                  return (
                    <div
                      key={ref.document_no}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedRefs(selectedRefs.filter((n) => n !== ref.document_no));
                        } else {
                          setSelectedRefs([...selectedRefs, ref.document_no]);
                        }
                      }}
                      className={`cursor-pointer rounded-xl border p-3 text-xs transition-all ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={isChecked} />
                          <span className="text-blue-600">{ref.document_no}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {ref.document_type}
                          </Badge>
                        </div>
                        <span className="text-slate-500 font-normal">{ref.date}</span>
                      </div>
                      {ref.customer && (
                        <div className="mt-1 text-slate-600 dark:text-slate-400 pl-6">
                          Customer: {ref.customer}
                        </div>
                      )}
                      <div className="mt-1.5 pl-6 text-[11px] text-slate-500">
                        {ref.items.length} item ({ref.items.map((i) => `${i.item_code} (${i.qty})`).join(", ")})
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGetItemsModal(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleConfirmGetItems}
                disabled={selectedRefs.length === 0}
              >
                Tarik {selectedRefs.length} Dokumen ke Pick List
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
