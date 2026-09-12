import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { batchApi, Batch, BatchOptions } from "../api";
import api from "@/lib/api";
import { SearchableSelect, SearchableOption } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Trash2,
  Boxes,
  Calendar,
  Building,
  FileText,
  Clock,
} from "lucide-react";

export default function BatchFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [options, setOptions] = useState<BatchOptions>({
    items: [],
    suppliers: [],
  });

  const [formData, setFormData] = useState<Partial<Batch>>({
    batch_id: "",
    item_code: "",
    item_name: "",
    batch_qty: 0,
    manufacturing_date: "",
    expiry_date: "",
    shelf_life_in_days: 0,
    reference_doctype: "",
    reference_name: "",
    supplier: "",
    disabled: false,
    description: "",
  });

  // Load options from DB
  useEffect(() => {
    batchApi
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
      batchApi
        .get(id)
        .then((res) => {
          setFormData({
            ...res,
            manufacturing_date: res.manufacturing_date ? res.manufacturing_date.split("T")[0] : "",
            expiry_date: res.expiry_date ? res.expiry_date.split("T")[0] : "",
          });
        })
        .catch(() => {
          toast.error("Gagal memuat detail Batch");
          navigate("/desk/batch-no");
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
      }));
    } catch {
      return (options.suppliers || [])
        .filter((s) => s.supplier_name.toLowerCase().includes(query.toLowerCase()))
        .map((s) => ({ value: s.supplier_name, label: s.supplier_name }));
    }
  };

  const handleItemSelect = (val: string) => {
    const selected = options.items.find((i) => i.item_code === val);
    const shelfLife = selected?.shelf_life_in_days || formData.shelf_life_in_days || 0;

    let autoExpiry = formData.expiry_date;
    if (formData.manufacturing_date && shelfLife > 0 && !autoExpiry) {
      const mfg = new Date(formData.manufacturing_date);
      mfg.setDate(mfg.getDate() + shelfLife);
      autoExpiry = mfg.toISOString().split("T")[0];
    }

    setFormData((prev) => ({
      ...prev,
      item_code: val,
      item_name: selected?.item_name || prev.item_name || "",
      shelf_life_in_days: shelfLife,
      expiry_date: autoExpiry,
    }));
  };

  const handleMfgDateChange = (mfgDate: string) => {
    let autoExpiry = formData.expiry_date;
    const shelfLife = formData.shelf_life_in_days || 0;
    if (mfgDate && shelfLife > 0) {
      const d = new Date(mfgDate);
      d.setDate(d.getDate() + shelfLife);
      autoExpiry = d.toISOString().split("T")[0];
    }
    setFormData((prev) => ({
      ...prev,
      manufacturing_date: mfgDate,
      expiry_date: autoExpiry,
    }));
  };

  const handleShelfLifeChange = (days: number) => {
    let autoExpiry = formData.expiry_date;
    if (formData.manufacturing_date && days > 0) {
      const d = new Date(formData.manufacturing_date);
      d.setDate(d.getDate() + days);
      autoExpiry = d.toISOString().split("T")[0];
    }
    setFormData((prev) => ({
      ...prev,
      shelf_life_in_days: days,
      expiry_date: autoExpiry,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.batch_id?.trim()) {
      toast.error("Batch ID wajib diisi");
      return;
    }

    if (!formData.item_code?.trim()) {
      toast.error("Item Code wajib dipilih");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        batch_qty: Number(formData.batch_qty) || 0,
        shelf_life_in_days: Number(formData.shelf_life_in_days) || 0,
        manufacturing_date: formData.manufacturing_date
          ? new Date(formData.manufacturing_date).toISOString()
          : undefined,
        expiry_date: formData.expiry_date
          ? new Date(formData.expiry_date).toISOString()
          : undefined,
      };

      if (isNew) {
        await batchApi.create(payload);
        toast.success("Batch berhasil dibuat");
        navigate("/desk/batch-no");
      } else if (id) {
        await batchApi.update(id, payload);
        toast.success("Batch berhasil diperbarui");
        navigate("/desk/batch-no");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Batch");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm(`Hapus Batch ${formData.batch_id}?`)) return;
    try {
      await batchApi.remove(id);
      toast.success("Batch berhasil dihapus");
      navigate("/desk/batch-no");
    } catch {
      toast.error("Gagal menghapus Batch");
    }
  };

  const getStatusBadge = () => {
    if (formData.disabled) {
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Disabled</Badge>;
    }
    if (!formData.expiry_date) {
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>;
    }
    const exp = new Date(formData.expiry_date);
    const now = new Date();
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) {
      return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Expired</Badge>;
    }
    if (diff <= 30) {
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Exp &le; {diff}h</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>;
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Batch...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/desk/batch-no")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
              <span>/</span>
              <Link to="/desk/batch-no" className="hover:text-blue-600">Batch No</Link>
              <span>/</span>
              <span>{isNew ? "New Batch" : formData.batch_id}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? "New Batch" : formData.batch_id}
              </h1>
              {!isNew && getStatusBadge()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-4" /> Hapus
            </Button>
          )}
          <Button
            type="submit"
            form="batch-form"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-1.5 size-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      <form id="batch-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Batch Identification */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Boxes className="size-4 text-blue-600" />
            Detail Batch & Item
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Batch ID (Nomor Batch / Lot) *
              </label>
              <Input
                placeholder="Contoh: BATCH-2026-001"
                value={formData.batch_id}
                onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                className="mt-1"
                required
              />
            </div>

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
                Batch Quantity (Jumlah Kuantitas Stok)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.batch_qty}
                onChange={(e) => setFormData({ ...formData, batch_qty: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                id="batch-disabled"
                type="checkbox"
                checked={formData.disabled || false}
                onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="batch-disabled" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Disabled (Nonaktifkan batch ini dari pemilihan transaksi)
              </label>
            </div>
          </div>
        </div>

        {/* Card 2: Dates & Shelf Life */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Clock className="size-4 text-blue-600" />
            Masa Simpan & Tanggal Kedaluwarsa
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Manufaktur / Produksi
              </label>
              <Input
                type="date"
                value={formData.manufacturing_date}
                onChange={(e) => handleMfgDateChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Masa Simpan (Hari / Shelf Life)
              </label>
              <Input
                type="number"
                placeholder="Contoh: 180"
                value={formData.shelf_life_in_days}
                onChange={(e) => handleShelfLifeChange(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Kedaluwarsa (Expiry Date)
              </label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Reference & Supplier */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Building className="size-4 text-blue-600" />
            Referensi Dokumen & Supplier
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reference DocType
              </label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.reference_doctype}
                onChange={(e) => setFormData({ ...formData, reference_doctype: e.target.value })}
              >
                <option value="">-- Pilih Referensi --</option>
                <option value="Purchase Receipt">Purchase Receipt</option>
                <option value="Stock Entry">Stock Entry</option>
                <option value="Delivery Note">Delivery Note</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reference Name (Nomor Dokumen)
              </label>
              <Input
                placeholder="Contoh: MAT-PRE-2026-00001"
                value={formData.reference_name}
                onChange={(e) => setFormData({ ...formData, reference_name: e.target.value })}
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
                  onChange={(val) => setFormData({ ...formData, supplier: val })}
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
          </div>
        </div>

        {/* Card 4: Description */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            Deskripsi / Catatan Batch
          </h2>
          <div>
            <Textarea
              rows={3}
              placeholder="Catatan mengenai batch ini, hasil lab/uji mutu, dsb..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
