import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BundleFormDialog from "./BundleFormDialog";

type Bundle = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  age_range?: string;
  grade_range?: string;
  pillar?: string;
  is_active?: boolean;
  require_sequential_completion?: boolean;
  course_count?: number;
};

type Pricing = {
  id: string;
  name: string;
  amount: number;
  interval?: string;
  bundle_id?: string | null;
  bundle_ids?: string[];
  plan_bundles?: any[];
};

const dataOf = (res: any) => res.data?.data || [];

type BundleMultiSelectProps = {
  bundles: Bundle[];
  value: string[];
  disabled?: boolean;
  placeholder: string;
  onChange: (bundleIDs: string[]) => void;
};

function BundleMultiSelect({
  bundles,
  value,
  disabled,
  placeholder,
  onChange,
}: BundleMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = bundles.filter((bundle) => value.includes(bundle.id));

  const toggleBundle = (bundleID: string) => {
    onChange(
      value.includes(bundleID)
        ? value.filter((id) => id !== bundleID)
        : [...value, bundleID]
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="min-h-10 w-full justify-between border-slate-200 bg-white px-3 py-2 text-left font-normal"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-slate-400">{placeholder}</span>
            ) : (
              <>
                {selected.slice(0, 2).map((bundle) => (
                  <Badge
                    key={bundle.id}
                    variant="secondary"
                    className="max-w-[160px] truncate"
                  >
                    {bundle.name}
                  </Badge>
                ))}
                {selected.length > 2 && (
                  <Badge variant="outline">+{selected.length - 2}</Badge>
                )}
              </>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Cari bundle..." />
          <CommandList>
            <CommandEmpty>Tidak ada bundle ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all_access" onSelect={() => onChange([])}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.length === 0 ? "opacity-100" : "opacity-0"
                  )}
                />
                {placeholder}
              </CommandItem>
              {bundles.map((bundle) => {
                const checked = value.includes(bundle.id);
                return (
                  <CommandItem
                    key={bundle.id}
                    value={`${bundle.name} ${bundle.grade_range || ""} ${bundle.age_range || ""} ${bundle.pillar || ""}`}
                    onSelect={() => toggleBundle(bundle.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        checked ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{bundle.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {bundle.grade_range || bundle.age_range || bundle.pillar || "-"}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CourseBundlePage() {
  const { t } = useLanguage();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [plans, setPlans] = useState<Pricing[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachingPlanIDs, setAttachingPlanIDs] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [bundleRes, pricingRes] = await Promise.all([
        api.get("/subscriptions/admin/resources/course-bundles"),
        api.get("/subscriptions/admin/resources/pricing-settings"),
      ]);
      const nextBundles = dataOf(bundleRes);
      setBundles(nextBundles);
      setPlans(dataOf(pricingRes));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("bundles.toast.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNewBundleDialog = () => {
    setSelectedId("");
    setDialogOpen(true);
  };

  const openEditBundleDialog = (bundle: Bundle) => {
    setSelectedId(bundle.id);
    setDialogOpen(true);
  };

  const bundleIDsOfPlan = (plan: Pricing) => {
    const ids = Array.isArray(plan.bundle_ids) ? plan.bundle_ids : [];
    if (ids.length > 0) return ids.filter(Boolean);
    return plan.bundle_id ? [plan.bundle_id] : [];
  };

  const attachPlan = async (plan: Pricing, bundleIDs: string[]) => {
    if (attachingPlanIDs.includes(plan.id)) return;
    setAttachingPlanIDs((prev) => [...prev, plan.id]);
    try {
      const payload: any = { ...plan };
      delete payload.bundle_ids;
      delete payload.plan_bundles;
      delete payload.bundle;
      const response = await api.put(`/subscriptions/admin/resources/pricing-settings/${plan.id}`, {
        ...payload,
        bundle_id: bundleIDs[0] || null,
        bundle_ids: bundleIDs,
      });
      const updatedPlan = response.data?.data || {};
      setPlans((prev) =>
        prev.map((item) =>
          item.id === plan.id
            ? {
                ...item,
                ...updatedPlan,
                bundle_id: updatedPlan.bundle_id ?? bundleIDs[0] ?? null,
                bundle_ids: updatedPlan.bundle_ids || bundleIDs,
              }
            : item
        )
      );
      toast.success(t("bundles.toast.plan_updated"));
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || t("bundles.toast.connect_error")
      );
    } finally {
      setAttachingPlanIDs((prev) => prev.filter((id) => id !== plan.id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            {t("bundles.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {t("bundles.subtitle")}
          </p>
        </div>
        <Button onClick={openNewBundleDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("bundles.new_btn")}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-80 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("bundles.loading")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold text-slate-950">
                {t("bundles.list_title")}
              </h2>
              <p className="text-xs text-slate-500">
                {bundles.length} {t("bundles.count_label")}
              </p>
            </div>
            {bundles.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                {t("bundles.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("bundles.form.name")}</TableHead>
                      <TableHead>{t("bundles.form.grade_range")}</TableHead>
                      <TableHead className="text-center">Courses</TableHead>
                      <TableHead className="text-center">Sequential</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.map((bundle) => {
                      return (
                        <TableRow
                          key={bundle.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => openEditBundleDialog(bundle)}
                        >
                          <TableCell className="font-semibold text-slate-900">
                            {bundle.name}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {bundle.grade_range || bundle.age_range || "-"}
                          </TableCell>
                          <TableCell className="text-center text-slate-600">
                            {bundle.course_count ?? 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {bundle.require_sequential_completion ? (
                              <Badge variant="secondary">Ya</Badge>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                bundle.is_active !== false
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {bundle.is_active !== false
                                ? "Aktif"
                                : "Nonaktif"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditBundleDialog(bundle);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-950">
                {t("bundles.connect_title")}
              </h2>
              <p className="text-xs text-slate-500">
                {t("bundles.connect_subtitle")}
              </p>
            </div>
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                   key={plan.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      Rp {Number(plan.amount || 0).toLocaleString("id-ID")} /{" "}
                      {plan.interval || "month"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <BundleMultiSelect
                      bundles={bundles}
                      value={bundleIDsOfPlan(plan)}
                      disabled={attachingPlanIDs.includes(plan.id)}
                      placeholder={t("bundles.all_access")}
                      onChange={(bundleIDs) => attachPlan(plan, bundleIDs)}
                    />
                    {attachingPlanIDs.includes(plan.id) && (
                      <p className="text-xs text-slate-400">Menyimpan pilihan bundle...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BundleFormDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedBundle={bundles.find((b) => b.id === selectedId) || null}
        onSuccess={load}
      />
    </div>
  );
}

export default DashboardLayout(CourseBundlePage);
