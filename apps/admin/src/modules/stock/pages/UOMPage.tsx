import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Database,
  Hash,
  Info,
  Package,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uomApi, type UOM } from "../uomApi";

const emptyUOM: UOM = {
  uom_name: "",
  symbol: "",
  common_code: "",
  description: "",
  enabled: true,
  must_be_whole_number: false,
};

export default function UOMPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Route check
  const pathParts = location.pathname.split("/").filter(Boolean);
  // pathParts: ["desk", "uom", ":id?"]
  const rawId = pathParts[2];
  const isForm = Boolean(rawId);
  const isNew = isForm && (rawId === "new" || rawId.startsWith("new-uom"));

  // List States
  const [rows, setRows] = useState<UOM[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Form States
  const [formData, setFormData] = useState<UOM>(emptyUOM);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load List
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await uomApi.list({ q: searchQuery });
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal memuat daftar UOM");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!isForm) {
      const timer = setTimeout(loadList, 200);
      return () => clearTimeout(timer);
    }
  }, [isForm, loadList]);

  // Load Form Data
  useEffect(() => {
    if (isForm) {
      if (!isNew && rawId) {
        setLoading(true);
        uomApi
          .get(rawId)
          .then((res) => {
            setFormData(res);
            setIsDirty(false);
          })
          .catch(() => {
            toast.error("Gagal mengambil data UOM");
            navigate("/desk/uom");
          })
          .finally(() => setLoading(false));
      } else {
        setFormData(emptyUOM);
        setIsDirty(false);
      }
    }
  }, [isForm, isNew, rawId, navigate]);

  // Field Updater
  const updateField = <K extends keyof UOM>(key: K, value: UOM[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Save UOM
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.uom_name.trim()) {
      return toast.error("UOM Name wajib diisi");
    }

    setSaving(true);
    try {
      if (!isNew && rawId) {
        await uomApi.update(rawId, formData);
        toast.success("UOM berhasil diperbarui");
      } else {
        await uomApi.create(formData);
        toast.success("UOM berhasil dibuat");
      }
      setIsDirty(false);
      navigate("/desk/uom");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan UOM");
    } finally {
      setSaving(false);
    }
  };

  // Delete UOM
  const handleDelete = async (id: string, name?: string) => {
    if (!confirm(`Hapus satuan ${name || "UOM ini"}?`)) return;
    try {
      await uomApi.remove(id);
      toast.success("UOM berhasil dihapus");
      if (isForm) {
        navigate("/desk/uom");
      } else {
        loadList();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus UOM");
    }
  };

  // Seed standard UOMs
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await uomApi.seed();
      toast.success("UOM default berhasil di-seed");
      loadList();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal seeding UOM");
    } finally {
      setSeeding(false);
    }
  };

  // ==========================================
  // FORM VIEW
  // ==========================================
  if (isForm) {
    return (
      <div className="min-h-screen bg-slate-50/50 pb-20 dark:bg-slate-950">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            {/* Breadcrumb & Title */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Link
                  to="/desk/stock"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Stock
                </Link>
                <ChevronRight className="size-3 text-slate-400" />
                <Link
                  to="/desk/uom"
                  className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  UOM
                </Link>
                <ChevronRight className="size-3 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {isNew ? "New UOM" : formData.uom_name || rawId}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {isNew ? "New UOM" : formData.uom_name || "UOM"}
                </h1>
                {isNew || isDirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Not Saved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Saved
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/desk/uom")}
                className="gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                <span>Batal</span>
              </Button>

              {!isNew && rawId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(rawId, formData.uom_name)}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer dark:hover:bg-red-950"
                >
                  <Trash2 className="size-4" />
                  <span>Hapus</span>
                </Button>
              )}

              <Button
                type="submit"
                form="uom-form"
                disabled={saving}
                size="sm"
                className="gap-1.5 bg-blue-600 font-semibold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
              >
                {saving && <RefreshCw className="size-3.5 animate-spin" />}
                <span>{saving ? "Menyimpan..." : "Save"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Form Body */}
        <main className="mx-auto mt-6 max-w-4xl px-6">
          <form id="uom-form" onSubmit={handleSave} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
              <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                <Ruler className="size-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Unit of Measure (UOM)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Definisikan nama satuan, simbol, kode standar internasional, dan aturan pembulatan.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* UOM Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    UOM Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    placeholder="contoh: Nos, Unit, Box, Kg..."
                    value={formData.uom_name}
                    onChange={(e) => updateField("uom_name", e.target.value)}
                    className="rounded-lg bg-slate-50/70 font-semibold dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    uom_name
                  </p>
                </div>

                {/* Symbol */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Symbol
                  </Label>
                  <Input
                    placeholder="contoh: Nos, U, bx, kg..."
                    value={formData.symbol}
                    onChange={(e) => updateField("symbol", e.target.value)}
                    className="rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] font-mono text-slate-400">symbol</p>
                </div>

                {/* Common Code */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Common Code
                  </Label>
                  <Input
                    placeholder="contoh: C62, H87, BX, KGM, MTR..."
                    value={formData.common_code}
                    onChange={(e) => updateField("common_code", e.target.value)}
                    className="rounded-lg bg-slate-50/70 font-mono dark:bg-slate-800/60"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    According to CEFACT/ICG/2010/IC013 or CEFACT/ICG/2010/IC010
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    common_code
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Keterangan mengenai satuan ukuran ini..."
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    description
                  </p>
                </div>

                {/* Enabled */}
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <Checkbox
                      checked={formData.enabled}
                      onCheckedChange={(c) => updateField("enabled", Boolean(c))}
                    />
                    <div>
                      <span>Enabled</span>
                      <p className="text-[10px] font-mono text-slate-400">
                        enabled
                      </p>
                    </div>
                  </label>
                </div>

                {/* Must be Whole Number */}
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <Checkbox
                      checked={formData.must_be_whole_number}
                      onCheckedChange={(c) =>
                        updateField("must_be_whole_number", Boolean(c))
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <span>Must be Whole Number</span>
                      <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        Check this to disallow fractions. (for Nos)
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // ==========================================
  // LIST VIEW
  // ==========================================
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/desk/stock"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Stock
            </Link>
            <ChevronRight className="size-3 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Unit of Measure (UOM)
            </span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Unit of Measure (UOM)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pengaturan satuan ukuran inventaris, pembelian, penjualan, dan penentuan harga.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-1.5 cursor-pointer"
          >
            <Database className={`size-3.5 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed Default UOMs"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadList}
            disabled={loading}
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="gap-1.5 bg-blue-600 font-semibold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Link to="/desk/uom/new">
              <Plus className="size-4" />
              <span>Add UOM</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari UOM Name, Symbol, atau Common Code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Total: {rows.length} satuan</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">UOM Name</th>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Common Code</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Whole Number</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-blue-600" />
                    <p>Memuat data UOM...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Ruler className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Belum ada UOM terdaftar
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Klik "Seed Default UOMs" untuk mengisi otomatis satuan standar internasional.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSeed}
                        className="bg-blue-600 text-white cursor-pointer"
                      >
                        <Database className="mr-1.5 size-4" />
                        Seed Default UOMs
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* Name */}
                    <td className="px-6 py-4 font-bold">
                      <Link
                        to={`/desk/uom/${row.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.uom_name}
                      </Link>
                    </td>

                    {/* Symbol */}
                    <td className="px-6 py-4 font-mono text-xs">
                      {row.symbol ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {row.symbol}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Common Code */}
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {row.common_code || "-"}
                    </td>

                    {/* Description */}
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                      {row.description || "-"}
                    </td>

                    {/* Whole Number */}
                    <td className="px-6 py-4 text-xs">
                      {row.must_be_whole_number ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300">
                          <Hash className="size-3" /> Whole Number
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Allows Fractions
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {row.enabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Disabled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer dark:hover:bg-blue-950"
                        >
                          <Link to={`/desk/uom/${row.id}`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.id!, row.uom_name)}
                          className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-950"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
