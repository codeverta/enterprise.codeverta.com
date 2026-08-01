import React, { useState } from 'react'
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import api from '@/lib/api';
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  BookOpen,
  Bold,
  Eye,
  FileAudio,
  FileImage,
  FileText,
  Heading2,
  Italic,
  Link,
  List,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  Video,
  X,
  ChevronDown,
  Layers,
  LayoutGrid,
  Tag,
  GripVertical,
} from "lucide-react";
import { Link as RouterLink } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CourseFormDialog from "@/pages/dashboard/courses/CourseFormDialog";
import { Checkbox } from "@/components/ui/checkbox";


/** Slide-over panel for category management */
function CategoryPanel({ open, onClose, categories, onRefresh }) {
  const [form, setForm] = useState({
    id: "", name: "", slug: "", description: "", sort_order: 0, is_active: true,
    target_roles: ["student", "mentor", "parent"],
  });

  const [draggedIdx, setDraggedIdx] = useState(null);

  const reset = () =>
    setForm({ id: "", name: "", slug: "", description: "", sort_order: 0, is_active: true, target_roles: ["student", "mentor", "parent"] });

  const handleNameChange = (name) =>
    setForm((prev) => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
    }));

  const toggleTargetRole = (role) => {
    setForm((prev) => {
      const current = prev.target_roles || [];
      const exists = current.includes(role);
      const next = exists ? current.filter((r) => r !== role) : [...current, role];
      return { ...prev, target_roles: next };
    });
  };

  const save = async () => {};

  const del = async (cat) => {
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    try {
      await api.delete(`/subscriptions/admin/resources/course-categories/${cat.id}`);
      toast.success("Kategori dihapus");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menghapus kategori");
    }
  };

  const handleDrop = async (droppedIdx) => {
    if (draggedIdx === null || draggedIdx === droppedIdx) return;
    const items = Array.from(categories);
    const [draggedItem] = items.splice(draggedIdx, 1);
    items.splice(droppedIdx, 0, draggedItem);
    setDraggedIdx(null);

    const reorderPayload = items.map((cat, idx) => ({
      id: cat.id,
      sort_order: idx + 1,
    }));

    const toastId = toast.loading("Memperbarui urutan kategori...");
    try {
      await api.put("/lms/admin/course-categories/reorder", {
        categories: reorderPayload,
      });
      toast.success("Urutan kategori berhasil diperbarui", { id: toastId });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal memperbarui urutan kategori", { id: toastId });
    }
  };

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Kelola Kategori</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* form */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {form.id ? "Edit Kategori" : "Kategori Baru"}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama Kategori *</Label>
                <Input
                  placeholder="Contoh: Programming"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deskripsi</Label>
                <Textarea
                  rows={2}
                  placeholder="Opsional..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Target Roles Checkboxes */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">Target Roles *</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="target_role_student"
                    checked={(form.target_roles || []).includes("student")}
                    onCheckedChange={() => toggleTargetRole("student")}
                  />
                  <Label
                    htmlFor="target_role_student"
                    className="text-xs font-medium cursor-pointer"
                  >
                    Student
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="target_role_mentor"
                    checked={(form.target_roles || []).includes("mentor")}
                    onCheckedChange={() => toggleTargetRole("mentor")}
                  />
                  <Label
                    htmlFor="target_role_mentor"
                    className="text-xs font-medium cursor-pointer"
                  >
                    Mentor
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="target_role_parent"
                    checked={(form.target_roles || []).includes("parent")}
                    onCheckedChange={() => toggleTargetRole("parent")}
                  />
                  <Label
                    htmlFor="target_role_parent"
                    className="text-xs font-medium cursor-pointer"
                  >
                    Parent
                  </Label>
                </div>
              </div>
              {(!form.target_roles || form.target_roles.length === 0) && (
                <p className="text-[11px] text-red-500 font-medium">
                  Minimal satu target role wajib dipilih
                </p>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">
                Tampilkan Category
              </Label>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Checkbox
                  id="is_active"
                  checked={!!form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, is_active: !!checked }))
                  }
                />
                <Label htmlFor="is_active" className="text-sm cursor-pointer">
                  Aktif
                </Label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save}>
                <Save className="mr-2 h-3.5 w-3.5" />
                Simpan
              </Button>
              {form.id && (
                <Button size="sm" variant="outline" onClick={reset}>
                  Batal
                </Button>
              )}
            </div>
          </div>

          {/* list */}
          <div className="space-y-2">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Daftar Kategori ({categories.length})
              </p>
              <p className="text-[10px] text-muted-foreground italic">
                * Geser dan lepas (drag & drop) item kategori untuk mengatur urutan.
              </p>
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kategori.
              </p>
            ) : (
              categories.map((cat, idx) => {
                const roles = cat.target_roles || [];
                return (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    className="flex flex-col gap-1.5 rounded-lg border bg-background px-3 py-2.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {cat.name}
                        </span>
                        {!cat.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setForm({
                              id: cat.id,
                              name: cat.name || "",
                              slug: cat.slug || "",
                              description: cat.description || "",
                              sort_order: cat.sort_order || 0,
                              is_active: cat.is_active !== false,
                              target_roles:
                                cat.target_roles && cat.target_roles.length > 0
                                  ? cat.target_roles
                                  : ["student", "mentor", "parent"],
                            })
                          }
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => del(cat)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {/* Role Badges */}
                    <div className="flex flex-wrap gap-1 pl-5">
                      {roles.map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-1.5 py-0.2 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100 capitalize"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default CategoryPanel