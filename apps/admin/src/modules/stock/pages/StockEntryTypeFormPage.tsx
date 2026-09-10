import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { stockEntryTypeApi, StockEntryType, STANDARD_STOCK_ENTRY_PURPOSES } from "../api";
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
  FileText,
  Info,
} from "lucide-react";

export default function StockEntryTypeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<StockEntryType>>({
    name: "",
    purpose: "Material Issue",
    disabled: false,
    description: "",
  });

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      stockEntryTypeApi
        .get(id)
        .then((res) => {
          setFormData(res);
        })
        .catch(() => {
          toast.error("Gagal memuat detail Stock Entry Type");
          navigate("/desk/stock-entry-type");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error("Name wajib diisi");
      return;
    }

    if (!formData.purpose?.trim()) {
      toast.error("Purpose wajib dipilih");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await stockEntryTypeApi.create(formData);
        toast.success("Stock Entry Type berhasil dibuat");
        navigate("/desk/stock-entry-type");
      } else if (id) {
        await stockEntryTypeApi.update(id, formData);
        toast.success("Stock Entry Type berhasil diperbarui");
        navigate("/desk/stock-entry-type");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm(`Hapus Stock Entry Type "${formData.name}"?`)) return;
    try {
      await stockEntryTypeApi.remove(id);
      toast.success("Stock Entry Type berhasil dihapus");
      navigate("/desk/stock-entry-type");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat detail Stock Entry Type...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/desk/stock-entry-type")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/stock" className="hover:text-blue-600">Stock</Link>
              <span>/</span>
              <Link to="/desk/stock-entry-type" className="hover:text-blue-600">Stock Entry Type</Link>
              <span>/</span>
              <span>{isNew ? "New Stock Entry Type" : formData.name}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? "New Stock Entry Type" : formData.name}
              </h1>
              {!isNew && (
                formData.disabled ? (
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Disabled</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>
                )
              )}
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
            form="stock-entry-type-form"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-1.5 size-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      <form id="stock-entry-type-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 space-y-4">
          <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
            <Boxes className="size-4 text-blue-600" />
            Informasi Stock Entry Type
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Name *
              </label>
              <Input
                placeholder="Contoh: Material Issue, Material Receipt, Transfer Antar Cabang..."
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 font-medium"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purpose *
              </label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={formData.purpose || "Material Issue"}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                required
              >
                {STANDARD_STOCK_ENTRY_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Purpose menentukan perilaku pergerakan stok: apakah mengeluarkan stok (Issue), menerima stok (Receipt), memindahkan stok (Transfer), atau memproses BOM (Manufacture/Repack).
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <Textarea
                rows={3}
                placeholder="Keterangan mengenai jenis stock entry ini..."
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                id="type-disabled"
                type="checkbox"
                checked={formData.disabled || false}
                onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="type-disabled" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Disabled (Nonaktifkan tipe ini dari pilihan pada formulir Stock Entry)
              </label>
            </div>
          </div>
        </div>

        {formData.is_standard && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-800 flex items-start gap-2.5 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Standard System Type:</span> Ini adalah tipe standar bawaan sistem ERPNext. Anda tetap dapat menyesuaikan deskripsi atau menonaktifkannya jika tidak digunakan.
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
