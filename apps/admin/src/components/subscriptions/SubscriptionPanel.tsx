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
import StatusBadge from "@/components/subscriptions/StatusBadge";
import {
  CHECKOUT_TYPE_OPTIONS,
  PricingPlan,
  SortDir,
  Subscription,
} from "./types";


// ─── Helpers ─────────────────────────────────────────────────────────────────

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


// ─── Stats Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${color}`}
        >
          <Icon className="size-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Subscriptions Panel ─────────────────────────────────────────────────────

function SubscriptionsPanel() {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [movingSubscription, setMovingSubscription] =
    useState<Subscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [checkoutTypeFilter, setCheckoutTypeFilter] = useState("all");
  const [sortCol, setSortCol] =
    useState<keyof Subscription>("current_period_end");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [subPage, setSubPage] = useState(1);
  const perPage = 25;

  const fetch = async () => {
    setLoading(true);
    try {
      const [subscriptionsRes, plansRes] = await Promise.all([
        api.get("/subscriptions/admin/resources/subscriptions?limit=200"),
        api.get("/subscriptions/admin/resources/subscription-plans?limit=100"),
      ]);
      setRows(subscriptionsRes.data?.data || []);
      setPlans(
        (plansRes.data?.data || []).filter(
          (plan: PricingPlan) => plan.is_active
        )
      );
    } catch {
      toast.error("Gagal memuat subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const currentPlanId = (subscription: Subscription) =>
    subscription.plan_id || subscription.provider_plan_id || "";

  const planByID = useMemo(() => {
    const map = new Map<string, PricingPlan>();
    plans.forEach((plan) => {
      map.set(plan.id, plan);
    });
    return map;
  }, [plans]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach((plan) => {
      const category = plan.pricing_category;
      if (category?.id && category?.name) {
        map.set(category.id, category.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  const openMoveDialog = (subscription: Subscription) => {
    setMovingSubscription(subscription);
    setSelectedPlanId("");
  };

  const movePlan = async () => {
    if (!movingSubscription || !selectedPlanId) return;
    setMoving(true);
    try {
      await api.put(`/subscriptions/admin/${movingSubscription.id}/plan`, {
        plan_id: selectedPlanId,
      });
      toast.success("Paket subscription berhasil dipindahkan");
      setMovingSubscription(null);
      setSelectedPlanId("");
      await fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal memindahkan paket");
    } finally {
      setMoving(false);
    }
  };

  const sort = (col: keyof Subscription) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filteredSubs = rows
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => {
      const plan = planByID.get(currentPlanId(r));
      const categoryID =
        plan?.pricing_category_id || plan?.pricing_category?.id || "";
      const checkoutType = normalizeCheckoutType(
        plan?.pricing_category?.checkout_type
      );
      const matchesCategory =
        categoryFilter === "all" || categoryID === categoryFilter;
      const matchesCheckoutType =
        checkoutTypeFilter === "all" || checkoutType === checkoutTypeFilter;
      return matchesCategory && matchesCheckoutType;
    })
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.student_name || r.student_id || "").toLowerCase().includes(q) ||
        (r.parent_name || r.parent_id || "").toLowerCase().includes(q) ||
        (r.plan_name || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = String(a[sortCol] ?? "");
      const bv = String(b[sortCol] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const counts = {
    active: rows.filter((r) => r.status === "active").length,
    trialing: rows.filter((r) => r.status === "trialing").length,
    past_due: rows.filter((r) => r.status === "past_due").length,
    canceled: rows.filter((r) => r.status === "canceled").length,
  };

  const SortIcon = ({ col }: { col: keyof Subscription }) =>
    sortCol === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="ml-1 inline size-3" />
      ) : (
        <ChevronDown className="ml-1 inline size-3" />
      )
    ) : null;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={counts.active}
          icon={CheckCircle}
          color="bg-emerald-500"
        />
        <StatCard
          label="Trialing"
          value={counts.trialing}
          icon={Clock}
          color="bg-blue-500"
        />
        <StatCard
          label="Past Due"
          value={counts.past_due}
          icon={AlertCircle}
          color="bg-amber-500"
        />
        <StatCard
          label="Canceled"
          value={counts.canceled}
          icon={XCircle}
          color="bg-slate-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2 size-4 text-slate-400" />
          <Input
            className="h-8 pl-9 text-xs"
            placeholder="Cari nama partner, ortu, atau paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[145px] text-xs">
            <Filter className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {["active", "trialing", "past_due", "canceled", "expired"].map(
              (s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setSubPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <Tags className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={checkoutTypeFilter}
          onValueChange={(value) => {
            setCheckoutTypeFilter(value);
            setSubPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <Filter className="mr-1.5 size-3.5 text-slate-400" />
            <SelectValue placeholder="Checkout Type" />
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
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-500"
            onClick={() => {
              setCategoryFilter("all");
              setCheckoutTypeFilter("all");
              setSubPage(1);
            }}
          >
            Reset
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead
                  className="cursor-pointer"
                  onClick={() => sort("student_name")}
                >
                  Partner <SortIcon col="student_name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => sort("parent_name")}
                >
                  Merchant <SortIcon col="parent_name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => sort("plan_name")}
                >
                  Paket <SortIcon col="plan_name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => sort("status")}
                >
                  Status <SortIcon col="status" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => sort("amount")}
                >
                  Nominal <SortIcon col="amount" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => sort("current_period_end")}
                >
                  Berakhir <SortIcon col="current_period_end" />
                </TableHead>
                <TableHead className="w-16 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-slate-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredSubs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-slate-400"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubs
                  .slice((subPage - 1) * perPage, subPage * perPage)
                  .map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-800">
                          {row.student_name || "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.student_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-slate-700">
                          {row.parent_name || "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.parent_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium capitalize">
                          {row.plan_name || row.interval || "—"}
                        </span>
                        {planByID.get(currentPlanId(row))?.pricing_category && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {
                                planByID.get(currentPlanId(row))
                                  ?.pricing_category?.name
                              }
                            </Badge>
                            {planByID.get(currentPlanId(row))?.pricing_category
                              ?.checkout_type && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-slate-500"
                              >
                                {
                                  planByID.get(currentPlanId(row))
                                    ?.pricing_category?.checkout_type
                                }
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(row.amount, row.currency)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.current_period_end &&
                            dayjs(row.current_period_end).isBefore(dayjs())
                              ? "text-red-500"
                              : "text-slate-700"
                          }
                        >
                          {fmtDate(row.current_period_end)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pindahkan paket"
                          onClick={() => openMoveDialog(row)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          {filteredSubs.length > perPage && (
            <div className="flex items-center justify-between px-2 py-2 text-xs text-slate-500">
              <span>{filteredSubs.length} total</span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                  disabled={subPage <= 1}
                  onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="px-2">
                  {subPage} / {Math.ceil(filteredSubs.length / perPage)}
                </span>
                <button
                  className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                  disabled={subPage >= Math.ceil(filteredSubs.length / perPage)}
                  onClick={() => setSubPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-400">
        {filteredSubs.length} dari {rows.length} subscription
      </p>

      <Dialog
        open={Boolean(movingSubscription)}
        onOpenChange={(open) => {
          if (!open && !moving) setMovingSubscription(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan Paket Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {movingSubscription?.student_name || "Partner"}
              </p>
              <p>
                Paket saat ini:{" "}
                {movingSubscription?.plan_name || "Tidak diketahui"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-plan">Paket tujuan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id="target-plan">
                  <SelectValue placeholder="Pilih paket baru" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter(
                      (plan) =>
                        plan.id !==
                        (movingSubscription
                          ? currentPlanId(movingSubscription)
                          : "")
                    )
                    .map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {fmt(plan.amount, plan.currency)} /{" "}
                        {plan.interval}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Akses course langsung mengikuti paket baru. Masa aktif saat ini
                tetap sama.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMovingSubscription(null)}
              disabled={moving}
            >
              Batal
            </Button>
            <Button onClick={movePlan} disabled={!selectedPlanId || moving}>
              {moving ? "Memindahkan..." : "Pindahkan Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubscriptionsPanel;
