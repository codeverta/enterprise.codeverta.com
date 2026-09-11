import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Check, FilePlus2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { customerApi, type Customer } from "../customerApi";
import { buyingApi, type Supplier } from "@/modules/buying/api";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import { subscriptionApi, type Subscription, type SubscriptionPlanItem } from "../subscriptionApi";

const today = () => new Date().toISOString().slice(0, 10);
const dateForInput = (value?: string) => (value ? String(value).slice(0, 10) : "");

const blankPlan = (): SubscriptionPlanItem => ({
  plan: "",
  qty: 1,
});

const defaultSubscription = (): Subscription => ({
  party_type: "Customer",
  party: "",
  company: "",
  start_date: today(),
  end_date: "",
  trial_period_start: "",
  trial_period_end: "",
  follow_calendar_months: false,
  generate_new_invoices_past_due_date: false,
  submit_invoice: false,
  days_until_due: 0,
  generate_invoice_at: "End of the current subscription period",
  cancel_at_period_end: false,
  apply_additional_discount: "Grand Total",
  additional_discount_percentage: 0,
  additional_discount_amount: 0,
  cost_center: "Main - CE",
  status: "Draft",
  plans: [blankPlan()],
});

export default function SubscriptionPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const pathSegments = loc.pathname.split("/").filter(Boolean);
  const routeId = pathSegments[2];
  const isForm = Boolean(routeId && routeId !== "view") || loc.pathname.includes("/new");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Subscription[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [sub, setSub] = useState<Subscription>(defaultSubscription);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load initial options
  useEffect(() => {
    warehouseApi.listCompanies().then(setCompanies).catch(() => {});
    customerApi.list().then(setCustomers).catch(() => {});
    buyingApi.supplierList().then(setSuppliers).catch(() => {});
  }, []);

  // Load list of subscriptions
  const loadList = async () => {
    setLoading(true);
    try {
      const data = await subscriptionApi.list({
        q: query || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal memuat daftar subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isForm) return;
    if (!query) {
      loadList();
      return;
    }
    const timer = setTimeout(loadList, 250);
    return () => clearTimeout(timer);
  }, [isForm, query, statusFilter]);

  // Load record detail if in edit mode
  useEffect(() => {
    if (!isForm) return;

    if (routeId && !routeId.startsWith("new")) {
      setLoading(true);
      subscriptionApi
        .get(routeId)
        .then((data) => {
          setSub({
            ...defaultSubscription(),
            ...data,
            plans: data.plans && data.plans.length > 0 ? data.plans : [blankPlan()],
          });
        })
        .catch(() => {
          toast.error("Subscription tidak ditemukan");
          nav("/desk/subscription");
        })
        .finally(() => setLoading(false));
    } else {
      setSub(defaultSubscription());
    }
  }, [isForm, routeId, nav]);

  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    const list = companies
      .map((c: any) => ({
        value: c.name || c.company_name || "",
        label: c.name || c.company_name || "",
      }))
      .filter((c) => Boolean(c.value));
    return list;
  }, [companies]);

  // Async search for customer or supplier depending on party_type
  const searchPartyOptions = async (keyword: string): Promise<SearchableSelectOption[]> => {
    if (sub.party_type === "Customer") {
      try {
        const list = await customerApi.list(keyword);
        return list.map((c) => ({
          value: c.customer_name,
          label: c.customer_name,
          description: c.customer_group ? `Grup: ${c.customer_group}` : c.email || undefined,
        }));
      } catch {
        return customers
          .filter((c) => c.customer_name.toLowerCase().includes(keyword.toLowerCase()))
          .map((c) => ({
            value: c.customer_name,
            label: c.customer_name,
            description: c.customer_group ? `Grup: ${c.customer_group}` : c.email || undefined,
          }));
      }
    } else {
      try {
        const list = await buyingApi.supplierList(keyword);
        return list.map((s) => ({
          value: s.supplier_name,
          label: s.supplier_name,
          description: s.supplier_group ? `Grup: ${s.supplier_group}` : undefined,
        }));
      } catch {
        return suppliers
          .filter((s) => s.supplier_name.toLowerCase().includes(keyword.toLowerCase()))
          .map((s) => ({
            value: s.supplier_name,
            label: s.supplier_name,
            description: s.supplier_group ? `Grup: ${s.supplier_group}` : undefined,
          }));
      }
    }
  };

  const initialPartyOptions: SearchableSelectOption[] = useMemo(() => {
    if (sub.party_type === "Customer") {
      return customers.slice(0, 50).map((c) => ({
        value: c.customer_name,
        label: c.customer_name,
        description: c.customer_group ? `Grup: ${c.customer_group}` : c.email || undefined,
      }));
    } else {
      return suppliers.slice(0, 50).map((s) => ({
        value: s.supplier_name,
        label: s.supplier_name,
        description: s.supplier_group ? `Grup: ${s.supplier_group}` : undefined,
      }));
    }
  }, [sub.party_type, customers, suppliers]);

  // Save subscription
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sub.party.trim()) {
      toast.error(`Pilih ${sub.party_type} terlebih dahulu`);
      return;
    }
    if (!sub.plans || sub.plans.length === 0 || !sub.plans.some((p) => p.plan.trim())) {
      toast.error("Harap tambahkan setidaknya satu Plan");
      return;
    }

    setSaving(true);
    try {
      if (routeId && !routeId.startsWith("new")) {
        await subscriptionApi.update(routeId, sub);
        toast.success("Subscription berhasil diperbarui");
      } else {
        const created = await subscriptionApi.create(sub);
        toast.success("Subscription berhasil disimpan");
        nav(`/desk/subscription/${created.id || created.subscription_number}`, { replace: true });
        return;
      }
      nav("/desk/subscription");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan subscription");
    } finally {
      setSaving(false);
    }
  };

  // Delete subscription
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus subscription ${name}?`)) return;
    try {
      await subscriptionApi.remove(id);
      toast.success("Subscription berhasil dihapus");
      loadList();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus subscription");
    }
  };

  // Plans table handlers
  const updatePlan = (idx: number, field: keyof SubscriptionPlanItem, val: any) => {
    setSub((prev) => {
      const nextPlans = [...prev.plans];
      nextPlans[idx] = { ...nextPlans[idx], [field]: val };
      return { ...prev, plans: nextPlans };
    });
  };

  const addPlanRow = () => {
    setSub((prev) => ({
      ...prev,
      plans: [...prev.plans, blankPlan()],
    }));
  };

  const removePlanRow = (idx: number) => {
    setSub((prev) => {
      const nextPlans = prev.plans.filter((_, i) => i !== idx);
      return { ...prev, plans: nextPlans.length > 0 ? nextPlans : [blankPlan()] };
    });
  };

  // --- FORM VIEW ---
  if (isForm) {
    const isEditing = Boolean(routeId && !routeId.startsWith("new"));

    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/desk/subscription">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Subscription</p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {isEditing ? sub.subscription_number || routeId : "New Subscription"}
                </h1>
                <Badge variant={isEditing ? "default" : "secondary"}>
                  {isEditing ? sub.status || "Draft" : "Not Saved"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/desk/subscription">Batal</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Menyimpan..." : "Save"}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Main Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">Party & Company</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {/* Party Type */}
              <div className="space-y-2">
                <Label htmlFor="party_type" className="text-xs font-semibold uppercase text-slate-600">
                  Party Type
                </Label>
                <select
                  id="party_type"
                  value={sub.party_type}
                  onChange={(e) => {
                    const newType = e.target.value as "Customer" | "Supplier";
                    setSub((prev) => ({
                      ...prev,
                      party_type: newType,
                      party: "", // reset party when switching type
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                </select>
              </div>

              {/* Party (Customer / Supplier with SearchableSelect) */}
              <div className="space-y-2">
                <Label htmlFor="party" className="text-xs font-semibold uppercase text-slate-600">
                  Party <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  key={sub.party_type} // re-mount on type change for clean state
                  value={sub.party}
                  onChange={(val) => setSub((prev) => ({ ...prev, party: val }))}
                  options={initialPartyOptions}
                  onSearch={searchPartyOptions}
                  placeholder={
                    sub.party_type === "Customer"
                      ? "Begin typing for customer results..."
                      : "Begin typing for supplier results..."
                  }
                  addNewHref={sub.party_type === "Customer" ? "/desk/customer/new" : "/desk/supplier/new"}
                  addNewLabel={sub.party_type === "Customer" ? "Buat Customer Baru" : "Buat Supplier Baru"}
                />
              </div>

              {/* Company */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="company" className="text-xs font-semibold uppercase text-slate-600">
                  Company
                </Label>
                <CompanySelect
                  value={sub.company}
                  onChange={(val) => setSub((prev) => ({ ...prev, company: val }))}
                  fallbackOptions={companyOptions.map((company) => company.value)}
                  placeholder="Begin typing for results."
                />
              </div>
            </div>
          </div>

          {/* Subscription Period Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">Subscription Period</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-xs font-semibold uppercase text-slate-600">
                  Subscription Start Date
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={dateForInput(sub.start_date)}
                  onChange={(e) => setSub((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-xs font-semibold uppercase text-slate-600">
                  Subscription End Date
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={dateForInput(sub.end_date)}
                  onChange={(e) => setSub((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial_period_start" className="text-xs font-semibold uppercase text-slate-600">
                  Trial Period Start Date
                </Label>
                <Input
                  id="trial_period_start"
                  type="date"
                  value={dateForInput(sub.trial_period_start)}
                  onChange={(e) => setSub((prev) => ({ ...prev, trial_period_start: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="days_until_due" className="text-xs font-semibold uppercase text-slate-600">
                  Days Until Due
                </Label>
                <Input
                  id="days_until_due"
                  type="number"
                  min="0"
                  value={sub.days_until_due}
                  onChange={(e) => setSub((prev) => ({ ...prev, days_until_due: Number(e.target.value) || 0 }))}
                />
                <p className="text-[11px] text-slate-500">
                  Number of days that the subscriber has to pay invoices generated by this subscription
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="generate_invoice_at" className="text-xs font-semibold uppercase text-slate-600">
                  Generate Invoice At
                </Label>
                <select
                  id="generate_invoice_at"
                  value={sub.generate_invoice_at}
                  onChange={(e) => setSub((prev) => ({ ...prev, generate_invoice_at: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="End of the current subscription period">End of the current subscription period</option>
                  <option value="Beginning of the current subscription period">Beginning of the current subscription period</option>
                  <option value="Days before the current subscription period">Days before the current subscription period</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="space-y-4 md:col-span-2 pt-2 border-t border-slate-100">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="follow_calendar_months"
                    checked={sub.follow_calendar_months}
                    onCheckedChange={(checked) => setSub((prev) => ({ ...prev, follow_calendar_months: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="follow_calendar_months" className="text-sm font-semibold text-slate-800 cursor-pointer">
                      Follow Calendar Months
                    </Label>
                    <p className="text-xs text-slate-500">
                      If this is checked subsequent new invoices will be created on calendar month and quarter start dates irrespective of current invoice start date
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="generate_new_invoices_past_due_date"
                    checked={sub.generate_new_invoices_past_due_date}
                    onCheckedChange={(checked) => setSub((prev) => ({ ...prev, generate_new_invoices_past_due_date: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="generate_new_invoices_past_due_date" className="text-sm font-semibold text-slate-800 cursor-pointer">
                      Generate New Invoices Past Due Date
                    </Label>
                    <p className="text-xs text-slate-500">
                      New invoices will be generated as per schedule even if current invoices are unpaid or past due date
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="submit_invoice"
                    checked={sub.submit_invoice}
                    onCheckedChange={(checked) => setSub((prev) => ({ ...prev, submit_invoice: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="submit_invoice" className="text-sm font-semibold text-slate-800 cursor-pointer">
                      Submit Generated Invoices
                    </Label>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cancel_at_period_end"
                    checked={sub.cancel_at_period_end}
                    onCheckedChange={(checked) => setSub((prev) => ({ ...prev, cancel_at_period_end: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="cancel_at_period_end" className="text-sm font-semibold text-slate-800 cursor-pointer">
                      Cancel At End Of Period
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plans Table Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Plans</h2>
                <p className="text-xs text-slate-500">Daftar paket dan kuantitas langganan.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPlanRow}>
                <Plus className="mr-1.5 size-3.5" /> Tambah Baris
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">No.</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="w-32 px-4 py-3">Quantity</th>
                    <th className="w-16 px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sub.plans.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-center text-xs font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          value={p.plan}
                          placeholder="Masukkan nama paket (e.g. Standard Plan, Premium Plan)"
                          onChange={(e) => updatePlan(idx, "plan", e.target.value)}
                          className="h-9"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min="1"
                          value={p.qty}
                          onChange={(e) => updatePlan(idx, "qty", Number(e.target.value) || 1)}
                          className="h-9"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePlanRow(idx)}
                          className="size-8 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discounts Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">Discounts</h2>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="apply_additional_discount" className="text-xs font-semibold uppercase text-slate-600">
                  Apply Additional Discount On
                </Label>
                <select
                  id="apply_additional_discount"
                  value={sub.apply_additional_discount}
                  onChange={(e) => setSub((prev) => ({ ...prev, apply_additional_discount: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Grand Total">Grand Total</option>
                  <option value="Net Total">Net Total</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional_discount_percentage" className="text-xs font-semibold uppercase text-slate-600">
                  Additional Discount Percentage (%)
                </Label>
                <Input
                  id="additional_discount_percentage"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={sub.additional_discount_percentage}
                  onChange={(e) =>
                    setSub((prev) => ({ ...prev, additional_discount_percentage: Number(e.target.value) || 0 }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional_discount_amount" className="text-xs font-semibold uppercase text-slate-600">
                  Additional Discount Amount (Rp)
                </Label>
                <Input
                  id="additional_discount_amount"
                  type="number"
                  step="any"
                  min="0"
                  value={sub.additional_discount_amount}
                  onChange={(e) =>
                    setSub((prev) => ({ ...prev, additional_discount_amount: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Accounting Dimensions Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">Accounting Dimensions</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cost_center" className="text-xs font-semibold uppercase text-slate-600">
                  Cost Center
                </Label>
                <Input
                  id="cost_center"
                  value={sub.cost_center}
                  onChange={(e) => setSub((prev) => ({ ...prev, cost_center: e.target.value }))}
                  placeholder="e.g. Main - CE"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" asChild>
              <Link to="/desk/subscription">Batal</Link>
            </Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Menyimpan..." : "Save Subscription"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Subscription</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Subscription</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Kelola langganan pelanggan & supplier, siklus penagihan, dan paket langganan.
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/subscription/new">
            <FilePlus2 className="mr-2 size-4" /> New Subscription
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Search and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-64 max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ID, party, atau perusahaan..."
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {["All", "Draft", "Active", "Cancelled", "Completed"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === s
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Subscription</th>
                <th className="px-5 py-3">Party Type</th>
                <th className="px-5 py-3">Party</th>
                <th className="px-5 py-3">Start Date</th>
                <th className="px-5 py-3">End Date</th>
                <th className="px-5 py-3">Plans</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    Memuat data subscription...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Belum ada subscription</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Klik "New Subscription" untuk membuat langganan baru.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-bold">
                      <Link
                        to={`/desk/subscription/${r.id || r.subscription_number}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.subscription_number || r.id}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline">{r.party_type}</Badge>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {r.party}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {r.start_date || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {r.end_date || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {r.plans && r.plans.length > 0
                        ? r.plans.map((p) => `${p.plan || "Plan"} (${p.qty})`).join(", ")
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          r.status === "Active"
                            ? "default"
                            : r.status === "Cancelled"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {r.status || "Draft"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="size-8">
                          <Link to={`/desk/subscription/${r.id || r.subscription_number}`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r.id!, r.subscription_number || r.party)}
                          className="size-8 text-rose-500 hover:bg-rose-50"
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
