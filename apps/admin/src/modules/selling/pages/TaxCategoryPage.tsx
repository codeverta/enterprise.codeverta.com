import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { taxCategoryApi, type TaxCategory } from "../taxCategoryApi";

export function TaxCategoryListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await taxCategoryApi.list({ q });
      setItems(data);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat Tax Category");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [q]);

  const handleDelete = async (item: TaxCategory) => {
    if (!confirm(`Hapus Tax Category "${item.title}"?`)) return;
    try {
      await taxCategoryApi.delete(item.id);
      toast.success("Tax Category berhasil dihapus");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus Tax Category");
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/desk/selling" className="hover:underline">Selling</Link>
            <span>/</span>
            <span>Tax Category</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Tax Category
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/desk/tax-category/new")}>
            <Plus className="mr-1 size-4" /> Add Tax Category
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-xs dark:bg-slate-900">
        <Search className="size-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari Tax Category..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-xs dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700 dark:text-slate-300">
            {items.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                onClick={() => navigate(`/desk/tax-category/${row.id}`)}
              >
                <td className="p-4 font-medium text-slate-900 dark:text-white">
                  {row.title}
                </td>
                <td className="p-4">
                  <Badge variant={row.disabled ? "secondary" : "default"}>
                    {row.disabled ? "Disabled" : "Enabled"}
                  </Badge>
                </td>
                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-rose-600"
                    onClick={() => handleDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">
                  Belum ada Tax Category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TaxCategoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-tax-category");

  const [title, setTitle] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      taxCategoryApi
        .get(id)
        .then((data) => {
          if (data) {
            setTitle(data.title || "");
            setDisabled(Boolean(data.disabled));
          }
        })
        .catch((err: any) => {
          toast.error(err?.message || "Gagal memuat detail Tax Category");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await taxCategoryApi.create({ title: title.trim(), disabled });
        toast.success("Tax Category berhasil dibuat");
        navigate(`/desk/tax-category/${created.id}`, { replace: true });
      } else if (id) {
        await taxCategoryApi.update(id, { title: title.trim(), disabled });
        toast.success("Tax Category berhasil diperbarui");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan Tax Category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew || !confirm("Hapus Tax Category ini?")) return;
    try {
      await taxCategoryApi.delete(id);
      toast.success("Tax Category dihapus");
      navigate("/desk/tax-category");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus Tax Category");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Memuat Tax Category...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/desk/tax-category")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/selling" className="hover:underline">Selling</Link>
              <span>/</span>
              <Link to="/desk/tax-category" className="hover:underline">Tax Category</Link>
              <span>/</span>
              <span>{isNew ? "New Tax Category" : title || id}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isNew ? "New Tax Category" : title}
              </h1>
              <Badge variant={isNew ? "secondary" : "outline"}>
                {isNew ? "Not Saved" : disabled ? "Disabled" : "Saved"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="icon" onClick={handleDelete}>
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-6">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Title <span className="text-rose-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. In State, Out of State, Export"
            className="mt-1.5"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Nama kategori pajak yang akan ditampilkan pada transaksi penjualan/pembelian.
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-2 border-t">
          <Checkbox
            id="tax-category-disabled"
            checked={disabled}
            onCheckedChange={(v) => setDisabled(Boolean(v))}
          />
          <label
            htmlFor="tax-category-disabled"
            className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Disabled
          </label>
        </div>
      </div>
    </div>
  );
}

export default function TaxCategoryPage() {
  const location = useLocation();
  const { id } = useParams();
  const isForm = location.pathname.includes("/new") || Boolean(id);

  return isForm ? <TaxCategoryFormPage /> : <TaxCategoryListPage />;
}
