import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Info, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { posApi, type POSItem } from "../posApi";
import { subscriptionPlanApi, type SubscriptionPlan } from "../subscriptionPlanApi";
import api from "@/lib/api";

const CURRENCY_OPTIONS: SearchableSelectOption[] = [
  { value: "IDR", label: "IDR - Indonesian Rupiah" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "MYR", label: "MYR - Malaysian Ringgit" },
];

const PRICE_DETERMINATION_OPTIONS = [
  { value: "Fixed Rate", label: "Fixed Rate" },
  { value: "Based On Price List", label: "Based On Price List" },
  { value: "Monthly Rate", label: "Monthly Rate" },
];

const BILLING_INTERVAL_OPTIONS = [
  { value: "Day", label: "Day" },
  { value: "Week", label: "Week" },
  { value: "Month", label: "Month" },
  { value: "Year", label: "Year" },
];

const PAYMENT_GATEWAY_OPTIONS: SearchableSelectOption[] = [
  { value: "Midtrans", label: "Midtrans" },
  { value: "Xendit", label: "Xendit" },
  { value: "Stripe", label: "Stripe" },
  { value: "PayPal", label: "PayPal" },
  { value: "Razorpay", label: "Razorpay" },
];

const COST_CENTER_OPTIONS: SearchableSelectOption[] = [
  { value: "Main - CE", label: "Main - CE" },
  { value: "Default - CE", label: "Default - CE" },
  { value: "Selling - CE", label: "Selling - CE" },
  { value: "Administration - CE", label: "Administration - CE" },
];

const defaultPlan = (): SubscriptionPlan => ({
  plan_name: "",
  currency: "IDR",
  item: "",
  price_determination: "Fixed Rate",
  cost: 0,
  price_list: "Standard Selling",
  billing_interval: "Month",
  billing_interval_count: 1,
  product_price_id: "",
  payment_gateway: "",
  cost_center: "Main - CE",
  disabled: false,
  status: "Active",
});

export default function SubscriptionPlanPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const isNew = pathname === "/desk/subscription-plan/new" || pathname.includes("/new-subscription-plan");
  const isDetail = !isNew && /^\/desk\/subscription-plan\/[^/]+$/.test(pathname);
  const planId = params["*"] || (pathname.split("/desk/subscription-plan/")[1] ?? "");

  // Master Data Options
  const [items, setItems] = useState<POSItem[]>([]);
  const [priceLists, setPriceLists] = useState<string[]>(["Standard Selling", "Standard Buying"]);

  // List State
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Form State
  const [formData, setFormData] = useState<SubscriptionPlan>(defaultPlan());
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load Items for selection
    posApi
      .listItems()
      .then((res) => setItems(res || []))
      .catch(() => setItems([]));

    // Load Price Lists
    api
      .get("/selling/price-lists")
      .then((res) => {
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data) && data.length > 0) {
          setPriceLists(data.map((pl: any) => pl.price_list_name || pl.name || String(pl)));
        }
      })
      .catch(() => {});
  }, []);

  const fetchPlans = async () => {
    setLoadingList(true);
    try {
      const data = await subscriptionPlanApi.list({
        q: searchQuery,
        status: statusFilter !== "All" ? statusFilter : undefined,
      });
      setPlans(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat Subscription Plans");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!isNew && !isDetail) {
      fetchPlans();
    }
  }, [isNew, isDetail, searchQuery, statusFilter]);

  useEffect(() => {
    if (isNew) {
      setFormData(defaultPlan());
    } else if (isDetail && planId) {
      setLoadingForm(true);
      subscriptionPlanApi
        .get(planId)
        .then((data) => {
          setFormData({
            ...defaultPlan(),
            ...data,
          });
        })
        .catch((err: any) => {
          toast.error(err?.response?.data?.error || "Gagal memuat Subscription Plan");
          navigate("/desk/subscription-plan");
        })
        .finally(() => setLoadingForm(false));
    }
  }, [isNew, isDetail, planId]);

  const itemOptions: SearchableSelectOption[] = useMemo(() => {
    return items.map((i) => ({
      value: i.item_code,
      label: `${i.item_code} - ${i.item_name}`,
      sublabel: `Rp ${Number(i.rate || 0).toLocaleString("id-ID")}`,
    }));
  }, [items]);

  const priceListOptions: SearchableSelectOption[] = useMemo(() => {
    return priceLists.map((p) => ({
      value: p,
      label: p,
    }));
  }, [priceLists]);

  const handleSave = async () => {
    if (!formData.plan_name.trim()) {
      toast.error("Plan Name wajib diisi");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await subscriptionPlanApi.create(formData);
        toast.success(res.message || "Subscription Plan berhasil dibuat");
        navigate("/desk/subscription-plan");
      } else {
        const targetId = formData.id || planId;
        const res = await subscriptionPlanApi.update(targetId, formData);
        toast.success(res.message || "Subscription Plan berhasil diperbarui");
        navigate("/desk/subscription-plan");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Subscription Plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus Subscription Plan ini?")) return;
    try {
      const targetId = formData.id || planId;
      const res = await subscriptionPlanApi.delete(targetId);
      toast.success(res.message || "Subscription Plan berhasil dihapus");
      navigate("/desk/subscription-plan");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Subscription Plan");
    }
  };

  // RENDER FORM (NEW OR EDIT)
  if (isNew || isDetail) {
    if (loadingForm) {
      return (
        <div className="p-8 text-center text-sm text-slate-500">
          Memuat data Subscription Plan...
        </div>
      );
    }

    const badgeStatus = isNew
      ? "Not Saved"
      : formData.disabled
      ? "Disabled"
      : formData.status || "Active";

    return (
      <div className="space-y-6 pb-20">
        {/* Top Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/desk/subscription-plan"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {isNew
                    ? formData.plan_name || "New Subscription Plan"
                    : formData.plan_name || planId}
                </h1>
                <Badge
                  variant={
                    badgeStatus === "Not Saved"
                      ? "secondary"
                      : badgeStatus === "Active"
                      ? "default"
                      : "destructive"
                  }
                  className={
                    badgeStatus === "Not Saved"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : badgeStatus === "Active"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }
                >
                  {badgeStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <Link to="/desk/subscription-plan" className="hover:underline">
                  Subscription Plan
                </Link>{" "}
                / {isNew ? "New Subscription Plan" : formData.plan_name || planId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:bg-red-50 dark:text-red-400"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Check className="mr-1.5 h-4 w-4" />
              {saving ? "Menyimpan..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Form Body */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
          {/* Main Plan Info */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-3 dark:border-slate-800">
              Detail Plan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan Name */}
              <div className="space-y-1.5">
                <Label htmlFor="plan_name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Plan Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="plan_name"
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                  placeholder="e.g. Basic Monthly Plan / Enterprise Annual"
                  className="h-9"
                />
                <span className="text-[11px] text-slate-400">plan_name</span>
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency
                </Label>
                <SearchableSelect
                  value={formData.currency}
                  options={CURRENCY_OPTIONS}
                  onChange={(val) => setFormData({ ...formData, currency: val })}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari currency..."
                />
                <span className="text-[11px] text-slate-400">currency</span>
              </div>

              {/* Item */}
              <div className="space-y-1.5">
                <Label htmlFor="item" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Item
                </Label>
                <SearchableSelect
                  value={formData.item}
                  options={itemOptions}
                  onChange={(val) => setFormData({ ...formData, item: val })}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari item code atau nama..."
                />
                <span className="text-[11px] text-slate-400">item</span>
              </div>

              {/* Subscription Price Based On */}
              <div className="space-y-1.5">
                <Label htmlFor="price_determination" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subscription Price Based On
                </Label>
                <select
                  id="price_determination"
                  value={formData.price_determination}
                  onChange={(e) => setFormData({ ...formData, price_determination: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
                >
                  {PRICE_DETERMINATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">price_determination</span>
              </div>

              {/* Cost / Rate (when Fixed Rate or Monthly Rate) */}
              {(formData.price_determination === "Fixed Rate" ||
                formData.price_determination === "Monthly Rate") && (
                <div className="space-y-1.5">
                  <Label htmlFor="cost" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cost / Rate ({formData.currency || "IDR"})
                  </Label>
                  <Input
                    id="cost"
                    type="number"
                    value={formData.cost ?? 0}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-9"
                  />
                  <span className="text-[11px] text-slate-400">cost</span>
                </div>
              )}

              {/* Price List (when Based On Price List) */}
              {formData.price_determination === "Based On Price List" && (
                <div className="space-y-1.5">
                  <Label htmlFor="price_list" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Price List
                  </Label>
                  <SearchableSelect
                    value={formData.price_list || ""}
                    options={priceListOptions}
                    onChange={(val) => setFormData({ ...formData, price_list: val })}
                    placeholder="Begin typing for results."
                    searchPlaceholder="Cari price list..."
                  />
                  <span className="text-[11px] text-slate-400">price_list</span>
                </div>
              )}

              {/* Billing Interval */}
              <div className="space-y-1.5">
                <Label htmlFor="billing_interval" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Billing Interval
                </Label>
                <select
                  id="billing_interval"
                  value={formData.billing_interval}
                  onChange={(e) => setFormData({ ...formData, billing_interval: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
                >
                  {BILLING_INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">billing_interval</span>
              </div>

              {/* Billing Interval Count */}
              <div className="space-y-1.5">
                <Label htmlFor="billing_interval_count" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Billing Interval Count
                </Label>
                <Input
                  id="billing_interval_count"
                  type="number"
                  min="1"
                  value={formData.billing_interval_count}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billing_interval_count: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-9"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Number of intervals for the interval field e.g if Interval is 'Days' and Billing Interval Count is 3, invoices will be generated every 3 days
                </p>
                <span className="text-[11px] text-slate-400">billing_interval_count</span>
              </div>
            </div>
          </div>

          {/* Payment Plan Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-3 dark:border-slate-800">
              Payment Plan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Price ID */}
              <div className="space-y-1.5">
                <Label htmlFor="product_price_id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Product Price ID
                </Label>
                <Input
                  id="product_price_id"
                  value={formData.product_price_id || ""}
                  onChange={(e) => setFormData({ ...formData, product_price_id: e.target.value })}
                  placeholder="e.g. price_1H... or plan_xxx"
                  className="h-9"
                />
                <span className="text-[11px] text-slate-400">product_price_id</span>
              </div>

              {/* Payment Gateway */}
              <div className="space-y-1.5">
                <Label htmlFor="payment_gateway" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Gateway
                </Label>
                <SearchableSelect
                  value={formData.payment_gateway || ""}
                  options={PAYMENT_GATEWAY_OPTIONS}
                  onChange={(val) => setFormData({ ...formData, payment_gateway: val })}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari payment gateway..."
                />
                <span className="text-[11px] text-slate-400">payment_gateway</span>
              </div>
            </div>
          </div>

          {/* Accounting Dimensions Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-3 dark:border-slate-800">
              Accounting Dimensions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cost Center */}
              <div className="space-y-1.5">
                <Label htmlFor="cost_center" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center
                </Label>
                <SearchableSelect
                  value={formData.cost_center || ""}
                  options={COST_CENTER_OPTIONS}
                  onChange={(val) => setFormData({ ...formData, cost_center: val })}
                  placeholder="Begin typing for results."
                  searchPlaceholder="Cari cost center..."
                />
                <span className="text-[11px] text-slate-400">cost_center</span>
              </div>

              {/* Disabled Status */}
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="disabled"
                  checked={formData.disabled || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      disabled: Boolean(checked),
                      status: checked ? "Disabled" : "Active",
                    })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="disabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Disabled
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Nonaktifkan plan ini agar tidak dapat dipilih pada Subscription baru
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER LIST
  return (
    <div className="space-y-6 p-6">
      {/* List Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Subscription Plan
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {plans.length}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Daftar template paket langganan berulang
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Link to="/desk/subscription-plan/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Subscription Plan
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Plan Name, Item..."
            className="h-9 pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["All", "Active", "Disabled"].map((tab) => (
            <Button
              key={tab}
              variant={statusFilter === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(tab)}
              className="h-8 text-xs"
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Plan Name</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Price Determination</th>
              <th className="px-4 py-3">Rate / Cost</th>
              <th className="px-4 py-3">Billing Interval</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loadingList ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Memuat data Subscription Plan...
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Belum ada Subscription Plan. Klik{" "}
                  <Link
                    to="/desk/subscription-plan/new"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Add Subscription Plan
                  </Link>{" "}
                  untuk membuat baru.
                </td>
              </tr>
            ) : (
              plans.map((p) => {
                const isPlanDisabled = p.disabled || p.status === "Disabled";
                return (
                  <tr
                    key={p.id || p.plan_name}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(`/desk/subscription-plan/${p.id || p.plan_name}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {p.plan_name}
                    </td>
                    <td className="px-4 py-3">{p.currency || "IDR"}</td>
                    <td className="px-4 py-3">{p.item || "-"}</td>
                    <td className="px-4 py-3">{p.price_determination || "Fixed Rate"}</td>
                    <td className="px-4 py-3">
                      {p.price_determination === "Based On Price List"
                        ? p.price_list || "Price List"
                        : `Rp ${Number(p.cost || 0).toLocaleString("id-ID")}`}
                    </td>
                    <td className="px-4 py-3">
                      Every {p.billing_interval_count || 1} {p.billing_interval || "Month"}
                    </td>
                    <td className="px-4 py-3">{p.payment_gateway || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={isPlanDisabled ? "secondary" : "default"}
                        className={
                          isPlanDisabled
                            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }
                      >
                        {isPlanDisabled ? "Disabled" : "Active"}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
