import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { ResourcePanel } from "@/components/lms/GenericResourcePanel";
import { lmsConfigs, resources } from "@/lib/lms-resource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tags,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import api from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import { CHECKOUT_TYPE_OPTIONS, PricingCategory, PricingPlan } from "./types";
import StatusBadge from "./StatusBadge";

const fmt = (amount: number, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const fmtDate = (d?: string) =>
  d ? dayjs(d).format("DD MMM YYYY HH:mm") : "-";

// ─── Category Drawer ──────────────────────────────────────────────────────────

function PricingCategoryDrawer({
  open,
  onOpenChange,
  onCategoriesChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCategoriesChange: (cats: { id: string; name: string }[]) => void;
}) {
  const [rows, setRows] = useState<PricingCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PricingCategory | null>(null);
  const [form, setForm] = useState<Partial<PricingCategory>>({
    name: "",
    slug: "",
    description: "",
    sort_order: 0,
    is_active: true,
    checkout_type: "student",
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        "/subscriptions/admin/resources/pricing-categories?limit=100"
      );
      const data = res.data?.data || [];
      setRows(data);
      onCategoriesChange(
        data.map((c: PricingCategory) => ({ id: c.id, name: c.name }))
      );
    } catch {
      toast.error("Gagal memuat kategori harga");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      sort_order: 0,
      is_active: true,
      checkout_type: "student",
    });
  };

  const openEdit = (row: PricingCategory) => {
    setEditing(row);
    setForm({ ...row });
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleNameChange = (name: string) => {
    setForm((p) => ({ ...p, name, slug: slugify(name) }));
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
      };
      if (editing?.id) {
        await api.put(
          `/subscriptions/admin/resources/pricing-categories/${editing.id}`,
          payload
        );
        toast.success("Kategori diperbarui");
      } else {
        await api.post("/subscriptions/admin/resources/pricing-categories", payload);
        toast.success("Kategori dibuat");
      }
      setEditing(null);
      setForm({
        name: "",
        slug: "",
        description: "",
        sort_order: 0,
        is_active: true,
        checkout_type: "student",
      });
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: PricingCategory) => {
    if (!confirm(`Hapus kategori "${row.name}"?`)) return;
    try {
      await api.delete(`/subscriptions/admin/resources/pricing-categories/${row.id}`);
      toast.success("Kategori dihapus");
      fetch();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="inset-y-0 right-0 w-full border-l sm:max-w-lg bg-white overflow-auto">
        <DrawerHeader className="border-b px-6 py-4">
          <DrawerTitle>Kategori Harga</DrawerTitle>
          <DrawerDescription>
            Kelola kategori untuk mengelompokkan paket langganan.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 p-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={fetch}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              Tambah Kategori
            </Button>
          </div>

          {/* List */}
          {loading ? (
            <p className="py-8 text-center text-slate-400">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              Belum ada kategori.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-400">
                      slug: {row.slug} · checkout:{" "}
                      {row.checkout_type || "student"}
                    </p>
                    {row.description && (
                      <p className="text-xs text-slate-500">
                        {row.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!row.is_active && (
                      <Badge variant="outline" className="text-xs">
                        Nonaktif
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => remove(row)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          {(editing !== null || !editing) && (
            <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-slate-700">
                {editing ? "Edit Kategori" : "Tambah Kategori Baru"}
              </h3>

              <div className="space-y-1.5">
                <Label>Nama Kategori</Label>
                <Input
                  value={form.name || ""}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Contoh: Paket Anak"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value }))
                  }
                  placeholder="paket-anak"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Deskripsi</Label>
                <Input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Deskripsi singkat kategori"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Checkout Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.checkout_type || "student"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, checkout_type: e.target.value }))
                  }
                >
                  {CHECKOUT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Urutan</Label>
                  <Input
                    type="number"
                    value={form.sort_order ?? 0}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, sort_order: +e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label className="text-sm">Aktif</Label>
                  <Switch
                    checked={!!form.is_active}
                    onCheckedChange={(v) =>
                      setForm((p) => ({ ...p, is_active: v }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setForm({
                      name: "",
                      slug: "",
                      description: "",
                      sort_order: 0,
                      is_active: true,
                      checkout_type: "student",
                    });
                  }}
                >
                  Reset
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "Menyimpan..." : editing ? "Update" : "Simpan"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default PricingCategoryDrawer;
