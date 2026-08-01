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
import api from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import { CHECKOUT_TYPE_OPTIONS, PricingCategory, PricingPlan } from "./types";
import StatusBadge from "./StatusBadge";
import PricingCategoryDrawer from "./PricingCategoryDrawer";


const fmt = (amount: number, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const fmtDate = (d?: string) =>
  d ? dayjs(d).format("DD MMM YYYY HH:mm") : "-";

const normalizeCheckoutType = (value?: string) =>
  (value || "").replace(/_/g, "-");



// ─── Pricing Plans Panel ─────────────────────────────────────────────────────

function PricingPanel() {
  const [rows, setRows] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PricingPlan | null>(null);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [checkoutTypeFilter, setCheckoutTypeFilter] = useState("all");
  const [requirementCourses, setRequirementCourses] = useState<
    Array<{ id: string; title: string; status?: string }>
  >([]);
  const [requirementCourseSearch, setRequirementCourseSearch] = useState("");
  const [form, setForm] = useState<
    Partial<PricingPlan> & {
      featuresText?: string;
      pricing_category_id?: string;
      feature_meta?: any;
    }
  >({
    name: "Pemula",
    amount: 99000,
    currency: "IDR",
    interval: "month",
    is_active: true,
    requires_approval: false,
    featuresText: "",
    pricing_category_id: "",
    feature_meta: null,
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        "/subscriptions/admin/resources/pricing-settings?limit=100"
      );
      setRows(res.data?.data || []);
    } catch {
      toast.error("Gagal memuat paket langganan");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get(
        "/subscriptions/admin/resources/pricing-categories?limit=100"
      );
      setCategories(res.data?.data || []);
    } catch {
      console.error("Gagal memuat kategori harga");
    }
  };

  const fetchRequirementCourses = async () => {
    try {
      const res = await api.get("/subscriptions/admin/resources/courses?limit=1000");
      setRequirementCourses(res.data?.data || []);
    } catch {
      toast.error("Gagal memuat daftar course prerequisite");
    }
  };

  useEffect(() => {
    fetch();
    fetchCategories();
    fetchRequirementCourses();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "Pemula",
      amount: 99000,
      currency: "IDR",
      interval: "month",
      is_active: true,
      requires_approval: false,
      featuresText: "",
      pricing_category_id: "",
      feature_meta: null,
    });
    setRequirementCourseSearch("");
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    const feats = featsList(row).join("\n");
    setForm({
      ...row,
      featuresText: feats,
      pricing_category_id: row.pricing_category_id || "",
      feature_meta: row.feature_meta || null,
      requires_approval: !!row.requires_approval,
    });
    setRequirementCourseSearch("");
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const features = (form.featuresText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      let duration_days = 30;
      if (form.interval === "yearly") {
        duration_days = 365;
      } else if (form.interval === "weekly") {
        duration_days = 7;
      } else if (form.interval === "lifetime") {
        duration_days = 0;
      } else if (form.interval === "monthly" || form.interval === "month") {
        duration_days = 30;
      }
      let featureMeta = form.feature_meta;
      if (typeof featureMeta === "string") {
        try {
          featureMeta = JSON.parse(featureMeta);
        } catch {
          featureMeta = {};
        }
      }
      if (featureMeta?.rules) {
        const legacyRules = featureMeta.rules;
        const {
          auto_publish_to_parent_plans: _autoPublish,
          require_modules_completion: _legacyAllCourses,
          required_course_ids: _legacyRequiredCourses,
          ...currentRules
        } = legacyRules;
        featureMeta = {
          ...featureMeta,
          rules: {
            ...currentRules,
            can_sell_course:
              currentRules.can_sell_course ?? !!currentRules.can_create_course,
            sell_requirement:
              currentRules.sell_requirement ||
              (_legacyAllCourses
                ? "all"
                : Array.isArray(_legacyRequiredCourses) &&
                  _legacyRequiredCourses.length > 0
                ? "selected"
                : "none"),
            sell_required_course_ids:
              currentRules.sell_required_course_ids ||
              _legacyRequiredCourses ||
              [],
          },
        };
      }
      const payload = { ...form, feature_meta: featureMeta, features, duration_days };
      delete (payload as any).featuresText;
      if (editing?.id) {
        await api.put(
          `/subscriptions/admin/resources/pricing-settings/${editing.id}`,
          payload
        );
        toast.success("Paket diperbarui");
      } else {
        await api.post("/subscriptions/admin/resources/pricing-settings", payload);
        toast.success("Paket dibuat");
      }
      setOpen(false);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: PricingPlan) => {
    if (!confirm(`Hapus paket "${row.name}"?`)) return;
    try {
      await api.delete(`/subscriptions/admin/resources/pricing-settings/${row.id}`);
      toast.success("Paket dihapus");
      fetch();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const featsList = (row: any): string[] => {
    const feats = row.features;
    if (!feats) return [];
    if (Array.isArray(feats)) {
      return feats.map((f: any) =>
        f && typeof f === "object" ? f.feature_key : String(f)
      );
    }
    try {
      const parsed = JSON.parse(feats as string);
      if (Array.isArray(parsed)) {
        return parsed.map((f: any) =>
          f && typeof f === "object" ? f.feature_key : String(f)
        );
      }
    } catch {}
    return [];
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const categoryID = row.pricing_category_id || row.pricing_category?.id || "";
      const checkoutType = normalizeCheckoutType(
        row.pricing_category?.checkout_type
      );
      const matchesCategory =
        categoryFilter === "all" || categoryID === categoryFilter;
      const matchesCheckoutType =
        checkoutTypeFilter === "all" || checkoutType === checkoutTypeFilter;
      return matchesCategory && matchesCheckoutType;
    });
  }, [rows, categoryFilter, checkoutTypeFilter]);

  const resetFilters = () => {
    setCategoryFilter("all");
    setCheckoutTypeFilter("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Paket Langganan</h2>
          <p className="text-sm text-slate-500">
            Paket yang dipilih peserta sebelum membayar.
          </p>
        </div>
        <div className="flex gap-2">
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
            Tambah Paket
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchCategories();
              setCategoryDrawerOpen(true);
            }}
          >
            <Tags className="mr-1.5 size-3.5" />
            Kategori
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
        <span className="text-xs font-semibold text-slate-500">Filter:</span>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <Tags className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={checkoutTypeFilter}
          onValueChange={setCheckoutTypeFilter}
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <Filter className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue placeholder="Semua Checkout Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Checkout Type</SelectItem>
            {CHECKOUT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(categoryFilter !== "all" || checkoutTypeFilter !== "all") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-500"
            onClick={resetFilters}
          >
            Reset
          </Button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {filteredRows.length} dari {rows.length} paket
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-3 py-8 text-center text-slate-400">
            Loading...
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-slate-400">
            Tidak ada paket sesuai filter.
          </p>
        ) : (
          filteredRows.map((row) => (
            <Card
              key={row.id}
              className={`relative overflow-hidden border transition-shadow hover:shadow-md ${
                !row.is_active ? "opacity-60" : ""
              }`}
            >
              <div
                className={`absolute top-0 right-0 left-0 h-1 ${
                  row.is_active ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
              <CardHeader className="pb-2 pt-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">{row.name}</CardTitle>
                    {row.pricing_category && (
                      <p className="text-xs text-slate-400">
                        Kategori: {row.pricing_category.name}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={row.is_active ? "active" : "expired"} />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {fmt(row.amount, row.currency)}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    /{row.interval}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {featsList(row).length > 0 && (
                  <ul className="space-y-1">
                    {featsList(row).map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end gap-1 pt-1">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Tambah"} Paket Langganan
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Nama Paket</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Contoh: Paket Premium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori Harga</Label>
              <Select
                value={form.pricing_category_id || "NONE"}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    pricing_category_id: v === "NONE" ? null : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori harga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tanpa Kategori</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
                <Input
                  type="number"
                  value={form.amount ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: +e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interval</Label>
                <Select
                  value={form.interval}
                  onValueChange={(v) => setForm((p) => ({ ...p, interval: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="lifetime">Lifetime (Aktif Terus)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fitur (satu baris = satu fitur)</Label>
              <Textarea
                className="min-h-[120px] font-mono text-sm"
                placeholder={
                  "Akses materi dasar\nCourse pemula\nProgress belajar"
                }
                value={form.featuresText}
                onChange={(e) =>
                  setForm((p) => ({ ...p, featuresText: e.target.value }))
                }
              />
              <p className="text-xs text-slate-400">
                Pisahkan tiap fitur dengan baris baru.
              </p>
            </div>
            {/* Course permissions for parent and external teacher plans. */}
            {(() => {
              const selectedCat = categories.find(
                (c) => c.id === form.pricing_category_id
              );
              const checkoutType = normalizeCheckoutType(
                selectedCat?.checkout_type
              );
              const isParentPlan =
                checkoutType === "parent" ||
                checkoutType === "parent-external" ||
                checkoutType === "parent-child" ||
                selectedCat?.slug === "parent-system";
              const isExternalMentorPlan =
                checkoutType === "teacher" ||
                checkoutType === "teacher-external" ||
                checkoutType === "mentor-external";
              if (!isParentPlan && !isExternalMentorPlan) return null;

              let parsedMeta = form.feature_meta;
              if (typeof parsedMeta === "string") {
                try {
                  parsedMeta = JSON.parse(parsedMeta);
                } catch {
                  parsedMeta = null;
                }
              }
              const rules = parsedMeta?.rules || {};
              const canCreateCourse = !!rules.can_create_course;
              const canSellCourse =
                rules.can_sell_course ?? rules.can_create_course ?? false;
              const createRequirement = rules.create_requirement || "none";
              const sellRequirement =
                rules.sell_requirement ||
                (rules.require_modules_completion
                  ? "all"
                  : Array.isArray(rules.required_course_ids) &&
                    rules.required_course_ids.length > 0
                  ? "selected"
                  : "none");
              const createRequiredCourseIDs: string[] = Array.isArray(
                rules.create_required_course_ids
              )
                ? rules.create_required_course_ids
                : [];
              const sellRequiredCourseIDs: string[] = Array.isArray(
                rules.sell_required_course_ids
              )
                ? rules.sell_required_course_ids
                : Array.isArray(rules.required_course_ids)
                ? rules.required_course_ids
                : [];
              const visibleRequirementCourses = requirementCourses.filter(
                (course) =>
                  course.title
                    .toLowerCase()
                    .includes(requirementCourseSearch.trim().toLowerCase())
              );

              const updateRules = (changes: Record<string, any>) => {
                setForm((prev: any) => {
                  let meta = prev.feature_meta || {};
                  if (typeof meta === "string") {
                    try {
                      meta = JSON.parse(meta);
                    } catch {
                      meta = {};
                    }
                  }
                  const {
                    auto_publish_to_parent_plans: _autoPublish,
                    require_modules_completion: _legacyAll,
                    required_course_ids: _legacyCourses,
                    ...currentRules
                  } = meta.rules || {};
                  return {
                    ...prev,
                    feature_meta: {
                      ...meta,
                      rules: {
                        ...currentRules,
                        ...changes,
                      },
                    },
                  };
                });
              };
              const updateRule = (key: string, val: any) =>
                updateRules({ [key]: val });

              const renderCoursePicker = (
                ruleKey: string,
                selectedCourseIDs: string[]
              ) => (
                <div className="space-y-2">
                  {selectedCourseIDs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCourseIDs.map((courseID) => {
                        const course = requirementCourses.find(
                          (item) => item.id === courseID
                        );
                        return (
                          <Badge
                            key={courseID}
                            variant="secondary"
                            className="gap-1 pr-1 text-[11px]"
                          >
                            {course?.title || courseID}
                            <button
                              type="button"
                              className="rounded px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                              aria-label={`Hapus ${course?.title || courseID}`}
                              onClick={() =>
                                updateRule(
                                  ruleKey,
                                  selectedCourseIDs.filter(
                                    (id) => id !== courseID
                                  )
                                )
                              }
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="rounded-md border bg-white p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                      <Input
                        value={requirementCourseSearch}
                        onChange={(event) =>
                          setRequirementCourseSearch(event.target.value)
                        }
                        placeholder="Cari course..."
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    <div className="max-h-36 space-y-1 overflow-y-auto">
                      {visibleRequirementCourses.length === 0 ? (
                        <p className="py-3 text-center text-xs text-slate-400">
                          Course tidak ditemukan
                        </p>
                      ) : (
                        visibleRequirementCourses.map((course) => {
                          const selected = selectedCourseIDs.includes(course.id);
                          return (
                            <button
                              key={course.id}
                              type="button"
                              onClick={() =>
                                updateRule(
                                  ruleKey,
                                  selected
                                    ? selectedCourseIDs.filter(
                                        (id) => id !== course.id
                                      )
                                    : [...selectedCourseIDs, course.id]
                                )
                              }
                              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${
                                selected
                                  ? "bg-indigo-50 font-medium text-indigo-700"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <span className="line-clamp-1">{course.title}</span>
                              {selected && (
                                <CheckCircle className="size-3.5 shrink-0 text-indigo-600" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );

              const renderCompletionRequirement = (
                stage: "create" | "sell",
                value: string,
                selectedCourseIDs: string[]
              ) => {
                const isCreate = stage === "create";
                const requirementKey = isCreate
                  ? "create_requirement"
                  : "sell_requirement";
                const minimumKey = isCreate
                  ? "min_completed_courses_to_create"
                  : "min_completed_courses_to_sell";
                const courseIDsKey = isCreate
                  ? "create_required_course_ids"
                  : "sell_required_course_ids";
                return (
                  <div className="space-y-2">
                    <Label className="text-xs">Syarat penyelesaian course</Label>
                    <Select
                      value={value}
                      onValueChange={(nextValue) =>
                        updateRule(requirementKey, nextValue)
                      }
                    >
                      <SelectTrigger className="h-9 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa syarat</SelectItem>
                        <SelectItem value="all">
                          Selesaikan semua course dalam paket
                        </SelectItem>
                        <SelectItem value="minimum">
                          Selesaikan sejumlah course
                        </SelectItem>
                        <SelectItem value="selected">
                          Selesaikan course tertentu
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {value === "minimum" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Minimal course yang harus diselesaikan
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-9 bg-white text-xs"
                          value={rules[minimumKey] ?? 1}
                          onChange={(event) =>
                            updateRule(minimumKey, +event.target.value)
                          }
                        />
                      </div>
                    )}
                    {value === "selected" &&
                      renderCoursePicker(courseIDsKey, selectedCourseIDs)}
                  </div>
                );
              };

              return (
                <div className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      Hak Akses Course
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Berlaku untuk {isParentPlan ? "parent" : "guru external"}.
                      Atur izin tambah dan jual course secara terpisah.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-md border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor="can_create_course" className="text-xs font-semibold">
                          Boleh menambah course
                        </Label>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Member dapat membuat course baru setelah syarat terpenuhi.
                        </p>
                      </div>
                      <Switch
                        id="can_create_course"
                        checked={canCreateCourse}
                        onCheckedChange={(checked) =>
                          updateRules({
                            can_create_course: checked,
                            ...(checked ? {} : { can_sell_course: false }),
                          })
                        }
                      />
                    </div>
                    {canCreateCourse &&
                      renderCompletionRequirement(
                        "create",
                        createRequirement,
                        createRequiredCourseIDs
                      )}
                  </div>

                  {canCreateCourse && (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <Label htmlFor="can_sell_course" className="text-xs font-semibold">
                            Boleh menjual course satuan
                          </Label>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Course dijual satuan dan tidak dimasukkan ke bundle.
                          </p>
                        </div>
                        <Switch
                          id="can_sell_course"
                          checked={!!canSellCourse}
                          onCheckedChange={(checked) =>
                            updateRule("can_sell_course", checked)
                          }
                        />
                      </div>

                      {canSellCourse && (
                        <div className="space-y-3 border-t border-slate-100 pt-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                Minimal course yang harus dibuat
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                className="h-9 bg-white text-xs"
                                value={rules.min_courses_to_sell ?? 0}
                                onChange={(event) =>
                                  updateRule(
                                    "min_courses_to_sell",
                                    +event.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                Minimal lesson per course
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                className="h-9 bg-white text-xs"
                                value={rules.min_lessons_to_sell ?? 0}
                                onChange={(event) =>
                                  updateRule(
                                    "min_lessons_to_sell",
                                    +event.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                          {renderCompletionRequirement(
                            "sell",
                            sellRequirement,
                            sellRequiredCourseIDs
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Butuh Approval Admin</Label>
                <p className="text-[10px] text-muted-foreground">Gratis, tetapi butuh persetujuan admin sebelum aktif</p>
              </div>
              <Switch
                checked={!!form.requires_approval}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, requires_approval: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Aktif</Label>
              <Switch
                checked={!!form.is_active}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, is_active: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PricingCategoryDrawer
        open={categoryDrawerOpen}
        onOpenChange={setCategoryDrawerOpen}
        onCategoriesChange={setCategories}
      />
    </div>
  );
}

export default PricingPanel;
