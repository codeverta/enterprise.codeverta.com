import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { serialNoApi, SerialNo, SerialNoOptions } from "../api";
import api from "@/lib/api";
import { warehouseApi } from "../warehouseApi";
import { SearchableSelect, SearchableOption } from "@/components/ui/searchable-select";
import { SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Trash2,
  Barcode,
  Package,
  Calendar,
  Building,
  Truck,
  ShieldCheck,
  FileText,
} from "lucide-react";

export default function SerialNoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkSerialNos, setBulkSerialNos] = useState("");

  const [options, setOptions] = useState<SerialNoOptions>({
    items: [],
    warehouses: [],
    companies: [],
    batches: [],
    suppliers: [],
    customers: [],
  });

  const [formData, setFormData] = useState<Partial<SerialNo>>({
    serial_no: "",
    item_code: "",
    item_name: "",
    description: "",
    warehouse: "",
    company: "",
    status: "Available",
    batch_no: "",
    purchase_document_type: "",
    purchase_document_no: "",
    purchase_date: "",
    purchase_rate: 0,
    supplier: "",
    supplier_name: "",
    delivery_document_type: "",
    delivery_document_no: "",
    delivery_date: "",
    customer: "",
    customer_name: "",
    warranty_period: 0,
    warranty_expiry_date: "",
    amc_expiry_date: "",
    maintenance_status: "",
    notes: "",
  });

  // Load options from DB
  useEffect(() => {
    serialNoApi
      .options()
      .then((res) => {
        if (res) setOptions(res);
      })
      .catch(() => {});
  }, []);

  // Load existing record if editing
  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      serialNoApi
        .get(id)
        .then((res) => {
          setFormData({
            ...res,
            purchase_date: res.purchase_date ? res.purchase_date.split("T")[0] : "",
            delivery_date: res.delivery_date ? res.delivery_date.split("T")[0] : "",
            warranty_expiry_date: res.warranty_expiry_date ? res.warranty_expiry_date.split("T")[0] : "",
            amc_expiry_date: res.amc_expiry_date ? res.amc_expiry_date.split("T")[0] : "",
          });
        })
        .catch(() => {
          toast.error("Gagal memuat detail Serial No");
          navigate("/desk/serial-no");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  // Search items from DB with debounce
  const searchItemsFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/buying/items", {
        params: { q: query, limit: 30 },
      });
      const rows = res.data?.data || [];
      return rows.map((item) => ({
        value: item.item_code,
        label: `${item.item_code} - ${item.item_name || ""}`,
        sublabel: item.stock_uom ? `Unit: ${item.stock_uom}` : undefined,
      }));
    } catch {
      return (options.items || [])
        .filter(
          (it) =>
            it.item_code.toLowerCase().includes(query.toLowerCase()) ||
            it.item_name.toLowerCase().includes(query.toLowerCase())
        )
        .map((it) => ({
          value: it.item_code,
          label: `${it.item_code} - ${it.item_name}`,
          sublabel: it.stock_uom ? `Unit: ${it.stock_uom}` : undefined,
        }));
    }
  };

  // Search companies from DB
  const searchCompaniesFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const companies = await warehouseApi.listCompanies();
      return companies
        .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        .map((c) => ({ value: c.name, label: c.name }));
    } catch {
      return (options.companies || [])
        .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        .map((c) => ({ value: c.name, label: c.name }));
    }
  };

  // Search suppliers from DB
  const searchSuppliersFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/buying/suppliers", {
        params: { q: query, limit: 30 },
      });
      const rows = res.data?.data || [];
      return rows.map((s) => ({
        value: s.supplier_name,
        label: s.supplier_name,
        sublabel: s.supplier_group,
      }));
    } catch {
      return (options.suppliers || [])
        .filter((s) => s.supplier_name.toLowerCase().includes(query.toLowerCase()))
        .map((s) => ({ value: s.supplier_name, label: s.supplier_name }));
    }
  };

  // Search customers from DB
  const searchCustomersFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/selling/customers", {
        params: { q: query, limit: 30 },
      });
      const rows = res.data?.data || [];
      return rows.map((c) => ({
        value: c.customer_name,
        label: c.customer_name,
        sublabel: c.customer_type,
      }));
    } catch {
      return (options.customers || [])
        .filter((c) => c.customer_name.toLowerCase().includes(query.toLowerCase()))
        .map((c) => ({ value: c.customer_name, label: c.customer_name }));
    }
  };

  // Search batches from DB
  const searchBatchesFromDB = async (query: string): Promise<SearchableOption[]> => {
    try {
      const res = await api.get<{ data: any[] }>("/stock/batches", {
        params: { q: query, item_code: formData.item_code || undefined },
      });
      const rows = res.data?.data || [];
      return rows.map((b) => ({
        value: b.batch_id,
        label: b.batch_id,
        sublabel: b.item_name ? `${b.item_name} (Qty: ${b.batch_qty})` : `Qty: ${b.batch_qty}`,
      }));
    } catch {
      return (options.batches || [])
        .filter((b) => b.batch_id.toLowerCase().includes(query.toLowerCase()))
        .map((b) => ({
          value: b.batch_id,
          label: b.batch_id,
          sublabel: `Qty: ${b.batch_qty}`,
        }));
    }
  };

  const handleItemSelect = (val: string) => {
    const selected = options.items.find((i) => i.item_code === val);
    setFormData((prev) => ({
      ...prev,
      item_code: val,
      item_name: selected?.item_name || prev.item_name || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_code?.trim()) {
      toast.error("Item Code wajib dipilih");
      return;
    }

    if (isNew && isBulk) {
      if (!bulkSerialNos.trim()) {
        toast.error("Serial Numbers wajib diisi untuk pembuatan massal");
        return;
      }
    } else if (!formData.serial_no?.trim()) {
      toast.error("Serial No wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        purchase_rate: Number(formData.purchase_rate) || 0,
        warranty_period: Number(formData.warranty_period) || 0,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : undefined,
        delivery_date: formData.delivery_date ? new Date(formData.delivery_date).toISOString() : undefined,
        warranty_expiry_date: formData.warranty_expiry_date ? new Date(formData.warranty_expiry_date).toISOString() : undefined,
        amc_expiry_date: formData.amc_expiry_date ? new Date(formData.amc_expiry_date).toISOString() : undefined,
      };

      if (isNew && isBulk) {
        payload.serial_no = bulkSerialNos;
      }

      if (isNew) {
        const created = await serialNoApi.create(payload);
        toast.success(created?.message || "Serial No berhasil dibuat");
        navigate("/desk/serial-no");
      } else if (id) {
        await serialNoApi.update(id, payload);
        toast.success("Serial No berhasil diperbarui");
        navigate("/desk/serial-no");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Serial No");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm(`Hapus Serial No ${formData.serial_no}?`)) return;
    try {
      await serialNoApi.remove(id);
      toast.success("Serial No berhasil dihapus");
      navigate("/desk/serial-no");
    } catch {
      toast.error("Gagal menghapus Serial No");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Serial No...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/desk/serial-no")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
              <span>/</span>
              <Link to="/desk/serial-no" className="hover:text-blue-600">Serial No</Link>
              <span>/</span>
              <span>{isNew ? "New Serial No" : formData.serial_no}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? "New Serial No" : formData.serial_no}
              </h1>
              {!isNew && (
                <Badge
                  className={
                    formData.status === "Available"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : formData.status === "Delivered"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : formData.status === "Expired"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-slate-100 text-slate-700"
                  }
                >
                  {formData.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={handleDelete}>
              <Trash2 className="mr-1.5 size-4" /> Hapus
            </Button>
          )}
          <Button
            type="submit"
            form="serial-no-form"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-1.5 size-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      <form id="serial-no-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Item & Identification */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Barcode className="size-4 text-blue-600" />
              Detail Serial No & Item
            </h2>
            {isNew && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Mode Input:</span>
                <Button
                  type="button"
                  variant={!isBulk ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsBulk(false)}
                >
                  Tunggal
                </Button>
                <Button
                  type="button"
                  variant={isBulk ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsBulk(true)}
                >
                  Massal (Multiple)
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isNew && isBulk ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Daftar Serial No (Pisahkan dengan baris baru atau koma) *
                </label>
                <Textarea
                  rows={4}
                  placeholder={"SN-001\nSN-002\nSN-003"}
                  value={bulkSerialNos}
                  onChange={(e) => setBulkSerialNos(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Setiap baris akan otomatis dibuat sebagai 1 record Serial No dengan atribut yang sama.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Serial No *
                </label>
                <Input
                  placeholder="Contoh: SN-2026-00001"
                  value={formData.serial_no}
                  onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Item Code *
              </label>
              <div className="mt-1">
                <SearchableSelect
                  placeholder="Pilih atau cari Item Code..."
                  value={formData.item_code || ""}
                  onChange={handleItemSelect}
                  onSearch={searchItemsFromDB}
                  options={(options.items || []).map((it) => ({
                    value: it.item_code,
                    label: `${it.item_code} - ${it.item_name}`,
                    sublabel: it.stock_uom ? `Unit: ${it.stock_uom}` : undefined,
                  }))}
                  actionLabel="+ Tambah Item Baru"
                  actionHref="/desk/item/new"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Item Name
              </label>
              <Input
                placeholder="Nama item"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Status *
              </label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="Available">Available (Tersedia di Gudang)</option>
                <option value="Delivered">Delivered (Terkirim ke Customer)</option>
                <option value="Expired">Expired (Kedaluwarsa)</option>
                <option value="Inactive">Inactive (Non-aktif / Rusak)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Warehouse (Lokasi Gudang)
              </label>
              <div className="mt-1">
                <SearchableWarehouseSelect
                  value={formData.warehouse || ""}
                  onChange={(val) => setFormData({ ...formData, warehouse: val })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company (Perusahaan)
              </label>
              <div className="mt-1">
                <CompanySelect
                  placeholder="Pilih Perusahaan..."
                  value={formData.company || ""}
                  onChange={(company) => setFormData((current) => ({ ...current, company }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Batch No (Opsional)
              </label>
              <div className="mt-1">
                <SearchableSelect
                  placeholder="Pilih Batch No..."
                  value={formData.batch_no || ""}
                  onChange={(val) => setFormData({ ...formData, batch_no: val })}
                  onSearch={searchBatchesFromDB}
                  options={(options.batches || []).map((b) => ({
                    value: b.batch_id,
                    label: b.batch_id,
                    sublabel: `Item: ${b.item_code}`,
                  }))}
                  actionLabel="+ Tambah Batch Baru"
                  actionHref="/desk/batch-no/new"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Purchase / Manufacture Details */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Building className="size-4 text-blue-600" />
            Detail Pembelian / Penerimaan (Purchase & Manufacture)
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchase Document Type
              </label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.purchase_document_type}
                onChange={(e) => setFormData({ ...formData, purchase_document_type: e.target.value })}
              >
                <option value="">-- Pilih Tipe Dokumen --</option>
                <option value="Purchase Receipt">Purchase Receipt</option>
                <option value="Stock Entry">Stock Entry</option>
                <option value="Purchase Invoice">Purchase Invoice</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchase Document No
              </label>
              <Input
                placeholder="Contoh: MAT-PRE-2026-00001"
                value={formData.purchase_document_no}
                onChange={(e) => setFormData({ ...formData, purchase_document_no: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Supplier
              </label>
              <div className="mt-1">
                <SearchableSelect
                  placeholder="Cari Supplier..."
                  value={formData.supplier || ""}
                  onChange={(val) => {
                    const found = options.suppliers.find((s) => s.supplier_name === val);
                    setFormData({ ...formData, supplier: val, supplier_name: found?.supplier_name || val });
                  }}
                  onSearch={searchSuppliersFromDB}
                  options={(options.suppliers || []).map((s) => ({
                    value: s.supplier_name,
                    label: s.supplier_name,
                  }))}
                  actionLabel="+ Tambah Supplier Baru"
                  actionHref="/desk/supplier/new"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Pembelian / Penerimaan
              </label>
              <Input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchase Rate (Harga Beli Satuan)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.purchase_rate}
                onChange={(e) => setFormData({ ...formData, purchase_rate: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Delivery Details */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Truck className="size-4 text-blue-600" />
            Detail Pengiriman / Penjualan (Delivery Details)
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delivery Document Type
              </label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.delivery_document_type}
                onChange={(e) => setFormData({ ...formData, delivery_document_type: e.target.value })}
              >
                <option value="">-- Pilih Tipe Dokumen --</option>
                <option value="Delivery Note">Delivery Note (Surat Jalan)</option>
                <option value="Sales Invoice">Sales Invoice</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delivery Document No
              </label>
              <Input
                placeholder="Contoh: MAT-DN-2026-00001"
                value={formData.delivery_document_no}
                onChange={(e) => setFormData({ ...formData, delivery_document_no: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer (Pelanggan)
              </label>
              <div className="mt-1">
                <SearchableSelect
                  placeholder="Cari Customer..."
                  value={formData.customer || ""}
                  onChange={(val) => {
                    const found = options.customers.find((c) => c.customer_name === val);
                    setFormData({ ...formData, customer: val, customer_name: found?.customer_name || val });
                  }}
                  onSearch={searchCustomersFromDB}
                  options={(options.customers || []).map((c) => ({
                    value: c.customer_name,
                    label: c.customer_name,
                  }))}
                  actionLabel="+ Tambah Customer Baru"
                  actionHref="/desk/customer/new"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Pengiriman
              </label>
              <Input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Warranty & AMC */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-blue-600" />
            Garansi & Pemeliharaan (Warranty / AMC Details)
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Masa Garansi (Hari)
              </label>
              <Input
                type="number"
                placeholder="Contoh: 365"
                value={formData.warranty_period}
                onChange={(e) => setFormData({ ...formData, warranty_period: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Berakhir Garansi
              </label>
              <Input
                type="date"
                value={formData.warranty_expiry_date}
                onChange={(e) => setFormData({ ...formData, warranty_expiry_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Berakhir AMC
              </label>
              <Input
                type="date"
                value={formData.amc_expiry_date}
                onChange={(e) => setFormData({ ...formData, amc_expiry_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Notes */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            Catatan Tambahan
          </h2>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Catatan / Keterangan Unit
            </label>
            <Textarea
              rows={3}
              placeholder="Tambahkan catatan khusus untuk serial no ini..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
