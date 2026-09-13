import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  GitFork,
  FolderTree,
  FileSpreadsheet,
  Package,
  Save,
  ShoppingCart,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Lock,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export type CompanyData = {
  id?: string;
  name: string;
  abbreviation: string;
  abbr?: string;
  tax_id?: string;
  domain?: string;
  email?: string;
  phone?: string;
  address?: string;
  currency: string;
  default_currency?: string;
  is_group: boolean;
  is_active: boolean;

  // Details
  country?: string;
  default_holiday_list?: string;
  default_letter_head?: string;
  date_of_establishment?: string;
  parent_company?: string;
  reporting_currency?: string;
  date_of_incorporation?: string;
  phone_no?: string;
  company_description?: string;
  fax?: string;
  website?: string;
  registration_details?: string;

  // Accounts
  create_chart_of_accounts_based_on?: string;
  chart_of_accounts?: string;
  default_bank_account?: string;
  default_cash_account?: string;
  default_receivable_account?: string;
  default_payable_account?: string;
  write_off_account?: string;
  unrealized_profit_loss_account?: string;
  default_expense_account?: string;
  default_income_account?: string;
  default_discount_account?: string;
  payment_terms?: string;
  cost_center?: string;
  default_finance_book?: string;
  exchange_gain_loss_account?: string;
  unrealized_exchange_gain_loss_account?: string;
  round_off_account?: string;
  round_off_cost_center?: string;
  round_off_for_opening?: string;
  default_deferred_revenue_account?: string;
  default_deferred_expense_account?: string;
  book_advance_payments_in_separate_party_account?: boolean;
  reconciliation_takes_effect_on?: string;
  auto_exchange_rate_revaluation?: boolean;
  auto_err_frequency?: string;
  submit_err_jv?: boolean;
  exception_budget_approver_role?: string;
  accumulated_depreciation_account?: string;
  depreciation_expense_account?: string;
  series_for_depreciation_entry?: string;
  disposal_account?: string;
  depreciation_cost_center?: string;
  capital_work_in_progress_account?: string;
  asset_received_but_not_billed?: string;

  // Accounts Closing
  accounts_frozen_till_date?: string;
  frozen_accounts_modifier?: string;

  // Buying & Selling
  default_buying_terms?: string;
  monthly_sales_target?: number;
  total_monthly_sales?: number;
  default_selling_terms?: string;
  default_sales_contact?: string;
  default_warehouse_for_sales_return?: string;
  credit_limit?: number;
  purchase_expense_account?: string;
  service_expense_account?: string;
  purchase_expense_contra_account?: string;

  // Stock & Manufacturing
  enable_perpetual_inventory?: boolean;
  enable_item_wise_inventory_account?: boolean;
  enable_provisional_accounting_for_non_stock_items?: boolean;
  default_inventory_account?: string;
  valuation_method?: string;
  stock_adjustment_account?: string;
  stock_received_but_not_billed?: string;
  default_provisional_account?: string;
  default_in_transit_warehouse?: string;
  default_operating_cost_account?: string;
  default_wip_warehouse?: string;
  default_fg_warehouse?: string;
  default_scrap_warehouse?: string;
};

const defaultCompany = (): CompanyData => ({
  name: "",
  abbreviation: "",
  currency: "IDR",
  is_group: false,
  is_active: true,
  country: "Indonesia",
  reporting_currency: "IDR",
  create_chart_of_accounts_based_on: "Standard Template",
  chart_of_accounts: "Indonesia - Chart of Accounts",
  reconciliation_takes_effect_on: "Advance Payment Date",
  auto_err_frequency: "Monthly",
  valuation_method: "FIFO",
  enable_perpetual_inventory: true,
  enable_item_wise_inventory_account: false,
  enable_provisional_accounting_for_non_stock_items: false,
  monthly_sales_target: 0,
  total_monthly_sales: 0,
  credit_limit: 0,
});

type AccountOption = {
  id: string;
  account_name: string;
  account_number: string;
  account_type?: string;
  account_category?: string;
};

type WarehouseOption = {
  id?: string;
  warehouse_name: string;
  warehouse_type?: string;
};

export default function CompanyDetailPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Extract ID or company name from /desk/company/:nameOrId
  const segments = pathname.split("/").filter(Boolean);
  // URL format: /desk/company/:nameOrId
  const companyIdentifier = segments.length >= 3 ? decodeURIComponent(segments[2]) : "";
  const isNew = !companyIdentifier || companyIdentifier === "new" || companyIdentifier.startsWith("new-");

  const [form, setForm] = useState<CompanyData>(defaultCompany());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // External options loaded for integration
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [letterHeads, setLetterHeads] = useState<{ id: string; name: string }[]>([]);
  const [branchesCount, setBranchesCount] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);

  const updateField = <K extends keyof CompanyData>(field: K, value: CompanyData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Load Company Details
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get<{ data: CompanyData }>(`/organization/companies/${encodeURIComponent(companyIdentifier)}`)
      .then(({ data }) => {
        if (data.data) {
          const comp = data.data;
          setForm({
            ...defaultCompany(),
            ...comp,
            abbreviation: comp.abbreviation || comp.abbr || "",
            currency: comp.currency || comp.default_currency || "IDR",
            phone: comp.phone || comp.phone_no || "",
            phone_no: comp.phone_no || comp.phone || "",
          });
        }
      })
      .catch(() => {
        toast.error("Gagal memuat data company");
      })
      .finally(() => setLoading(false));
  }, [companyIdentifier, isNew]);

  // Load related accounts, warehouses, and metadata
  useEffect(() => {
    // 1. Load companies for Parent Company select
    api
      .get<{ data: { id: string; name: string }[] }>("/organization/companies")
      .then((res) => setAllCompanies(res.data?.data || []))
      .catch(() => {});

    // 2. Load letterheads
    api
      .get<{ data: { id: string; name: string }[] }>("/organization/letter-heads")
      .then((res) => setLetterHeads(res.data?.data || []))
      .catch(() => {});

    // 3. Load branches and departments count
    Promise.all([
      api.get("/organization/branches"),
      api.get("/organization/departments"),
    ])
      .then(([bRes, dRes]) => {
        const bList = bRes.data?.data || [];
        const dList = dRes.data?.data || [];
        if (form.id) {
          setBranchesCount(bList.filter((b: any) => b.company_id === form.id).length);
          setDepartmentsCount(dList.filter((d: any) => d.company_id === form.id).length);
        } else {
          setBranchesCount(bList.length);
          setDepartmentsCount(dList.length);
        }
      })
      .catch(() => {});
  }, [form.id]);

  // Load Chart of Accounts for this company
  useEffect(() => {
    const cid = form.id || companyIdentifier;
    if (!cid || cid === "new") return;

    api
      .get<{ data: AccountOption[] }>("/accounting/accounts", {
        params: { company_id: cid },
      })
      .then((res) => {
        const list = res.data?.data || [];
        setAccounts(list);
      })
      .catch(() => {
        // Fallback: load all accounts if company specific not yet isolated
        api
          .get<{ data: AccountOption[] }>("/accounting/accounts")
          .then((res) => setAccounts(res.data?.data || []))
          .catch(() => {});
      });

    // Load Warehouses for this company
    api
      .get<{ data: WarehouseOption[] }>("/stock/warehouses", {
        params: { company: form.name || companyIdentifier },
      })
      .then((res) => setWarehouses(res.data?.data || []))
      .catch(() => {
        api
          .get<{ data: WarehouseOption[] }>("/stock/warehouses")
          .then((res) => setWarehouses(res.data?.data || []))
          .catch(() => {});
      });
  }, [form.id, form.name, companyIdentifier]);

  // Transform accounts into SearchableSelect options
  const accountSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts.map((acc) => {
      const fullLabel = `${acc.account_number} - ${acc.account_name}`;
      return {
        value: fullLabel,
        label: fullLabel,
        sublabel: acc.account_type || acc.account_category || undefined,
        badge: acc.account_number,
      };
    });
  }, [accounts]);

  // Transform warehouses into SearchableSelect options
  const warehouseSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return warehouses.map((wh) => ({
      value: wh.warehouse_name,
      label: wh.warehouse_name,
      sublabel: wh.warehouse_type || "Warehouse",
    }));
  }, [warehouses]);

  // Handle Save / Submit
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama Company wajib diisi");
      return;
    }
    if (!form.abbreviation.trim()) {
      toast.error("Abbreviation wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        abbr: form.abbreviation,
        default_currency: form.currency,
        phone_no: form.phone_no || form.phone,
        phone: form.phone || form.phone_no,
      };

      if (isNew) {
        const { data } = await api.post("/organization/companies", payload);
        toast.success("Company berhasil dibuat!");
        const newComp = data.data || data;
        navigate(`/desk/company/${encodeURIComponent(newComp.name || newComp.id)}`);
      } else {
        const targetId = form.id || companyIdentifier;
        await api.put(`/organization/companies/${encodeURIComponent(targetId)}`, payload);
        toast.success("Company berhasil diperbarui!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Gagal menyimpan Company");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ERPPage>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Memuat data Company...</p>
          </div>
        </div>
      </ERPPage>
    );
  }

  return (
    <ERPPage>
      <form onSubmit={handleSave} className="space-y-6">
        <ERPPageHeader
          title={isNew ? "New Company" : form.name || "Company"}
          description={
            isNew
              ? "Tambahkan profil badan usaha multi-company baru."
              : `ID: ${form.id || companyIdentifier} • Abbr: ${form.abbreviation || "-"}`
          }
          breadcrumbs={[
            { label: "Organization", href: "/desk/company" },
            { label: "Company", href: "/desk/company" },
            { label: isNew ? "New" : form.name || "Detail" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/desk/company")}
              >
                <ArrowLeft className="mr-1.5 size-4" />
                Kembali
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-1.5 size-4" />
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="details" className="w-full space-y-6">
          <div className="overflow-x-auto border-b bg-white px-3 py-1 dark:bg-slate-950">
            <TabsList className="h-10 bg-transparent p-0">
              <TabsTrigger
                value="details"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="accounts"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Accounts
              </TabsTrigger>
              <TabsTrigger
                value="accounts-closing"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Accounts Closing
              </TabsTrigger>
              <TabsTrigger
                value="buying-selling"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Buying and Selling
              </TabsTrigger>
              <TabsTrigger
                value="stock-manufacturing"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Stock and Manufacturing
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Dashboard
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: DETAILS */}
          {/* ========================================================================= */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Identitas Perusahaan</CardTitle>
                <CardDescription>Informasi umum legalitas dan entitas korporat.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Company Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Contoh: PT ZENIT TECHNOLOGY SOLUTION"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="abbreviation">
                    Abbr <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="abbreviation"
                    required
                    value={form.abbreviation}
                    onChange={(e) => updateField("abbreviation", e.target.value.toUpperCase())}
                    placeholder="Contoh: PZTS"
                  />
                  <p className="text-xs text-slate-500">Singkatan nama perusahaan untuk kode akun & dokumen.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={form.currency || "IDR"}
                    onValueChange={(val) => updateField("currency", val)}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Pilih Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {["IDR", "USD", "SGD", "EUR", "JPY", "MYR", "AUD"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={form.country || ""}
                    onChange={(e) => updateField("country", e.target.value)}
                    placeholder="Contoh: Indonesia"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="parent_company">Parent Company</Label>
                  <Select
                    value={form.parent_company || "__none__"}
                    onValueChange={(val) =>
                      updateField("parent_company", val === "__none__" ? "" : val)
                    }
                  >
                    <SelectTrigger id="parent_company">
                      <SelectValue placeholder="Begin typing for results..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tanpa Parent Company</SelectItem>
                      {allCompanies
                        .filter((c) => c.name !== form.name)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reporting_currency">Reporting Currency</Label>
                  <Select
                    value={form.reporting_currency || "IDR"}
                    onValueChange={(val) => updateField("reporting_currency", val)}
                  >
                    <SelectTrigger id="reporting_currency">
                      <SelectValue placeholder="Pilih Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {["IDR", "USD", "SGD", "EUR"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tax_id">Tax ID (NPWP)</Label>
                  <Input
                    id="tax_id"
                    value={form.tax_id || ""}
                    onChange={(e) => updateField("tax_id", e.target.value)}
                    placeholder="Contoh: 01.234.567.8-901.000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={form.domain || ""}
                    onChange={(e) => updateField("domain", e.target.value)}
                    placeholder="Contoh: codeverta.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="default_letter_head">Default Letter Head</Label>
                  <Select
                    value={form.default_letter_head || "__none__"}
                    onValueChange={(val) =>
                      updateField("default_letter_head", val === "__none__" ? "" : val)
                    }
                  >
                    <SelectTrigger id="default_letter_head">
                      <SelectValue placeholder="Begin typing for results..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Default Standard Letter Head</SelectItem>
                      {letterHeads.map((lh) => (
                        <SelectItem key={lh.id} value={lh.name}>
                          {lh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="default_holiday_list">Default Holiday List</Label>
                  <Input
                    id="default_holiday_list"
                    value={form.default_holiday_list || ""}
                    onChange={(e) => updateField("default_holiday_list", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="date_of_establishment">Date of Establishment</Label>
                  <Input
                    type="date"
                    id="date_of_establishment"
                    value={form.date_of_establishment || ""}
                    onChange={(e) => updateField("date_of_establishment", e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label className="text-sm font-semibold">Is Group</Label>
                    <p className="text-xs text-slate-500">Perusahaan ini merupakan induk kelompok holding.</p>
                  </div>
                  <Switch
                    checked={form.is_group}
                    onCheckedChange={(val) => updateField("is_group", val)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Address & Contact</CardTitle>
                <CardDescription>Alamat legal kantor pusat dan kontak operasional.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="date_of_incorporation">Date of Incorporation</Label>
                  <Input
                    type="date"
                    id="date_of_incorporation"
                    value={form.date_of_incorporation || ""}
                    onChange={(e) => updateField("date_of_incorporation", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone_no">Phone No</Label>
                  <Input
                    id="phone_no"
                    value={form.phone_no || form.phone || ""}
                    onChange={(e) => {
                      updateField("phone_no", e.target.value);
                      updateField("phone", e.target.value);
                    }}
                    placeholder="+62 274..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="contact@codeverta.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={form.fax || ""}
                    onChange={(e) => updateField("fax", e.target.value)}
                    placeholder="Nomor Fax"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website || ""}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://codeverta.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    rows={3}
                    value={form.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Jl. Kapten Haryadi, Sleman, Yogyakarta..."
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company_description">Company Description</Label>
                  <Textarea
                    id="company_description"
                    rows={2}
                    value={form.company_description || ""}
                    onChange={(e) => updateField("company_description", e.target.value)}
                    placeholder="Deskripsi singkat profil bisnis perusahaan..."
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="registration_details">Registration Details</Label>
                  <Textarea
                    id="registration_details"
                    rows={2}
                    value={form.registration_details || ""}
                    onChange={(e) => updateField("registration_details", e.target.value)}
                    placeholder="Company registration numbers for your reference. Tax numbers etc."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: ACCOUNTS */}
          {/* ========================================================================= */}
          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Chart of Accounts</CardTitle>
                <CardDescription>Struktur Bagan Akun Standar (COA) untuk perusahaan ini.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Create Chart Of Accounts Based On</Label>
                  <Select
                    value={form.create_chart_of_accounts_based_on || "Standard Template"}
                    onValueChange={(val) => updateField("create_chart_of_accounts_based_on", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Dasar COA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard Template">Standard Template</SelectItem>
                      <SelectItem value="Existing Company">Existing Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Chart Of Accounts Template</Label>
                  <Input
                    value={form.chart_of_accounts || "Indonesia - Chart of Accounts"}
                    onChange={(e) => updateField("chart_of_accounts", e.target.value)}
                    placeholder="Indonesia - Chart of Accounts"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Default Accounts</CardTitle>
                <CardDescription>Akun default untuk transaksi penjualan, pembelian, kas, dan operasional.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Bank Account</Label>
                  <SearchableSelect
                    value={form.default_bank_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_bank_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Cash Account</Label>
                  <SearchableSelect
                    value={form.default_cash_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_cash_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Receivable Account</Label>
                  <SearchableSelect
                    value={form.default_receivable_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_receivable_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Payable Account</Label>
                  <SearchableSelect
                    value={form.default_payable_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_payable_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Cost of Goods Sold Account</Label>
                  <SearchableSelect
                    value={form.default_expense_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_expense_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Income Account</Label>
                  <SearchableSelect
                    value={form.default_income_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_income_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Payment Discount Account</Label>
                  <SearchableSelect
                    value={form.default_discount_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_discount_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Write Off Account</Label>
                  <SearchableSelect
                    value={form.write_off_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("write_off_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Unrealized Profit / Loss Account</Label>
                  <SearchableSelect
                    value={form.unrealized_profit_loss_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("unrealized_profit_loss_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Payment Terms Template</Label>
                  <Input
                    value={form.payment_terms || ""}
                    onChange={(e) => updateField("payment_terms", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Cost Center</Label>
                  <Input
                    value={form.cost_center || ""}
                    onChange={(e) => updateField("cost_center", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Finance Book</Label>
                  <Input
                    value={form.default_finance_book || ""}
                    onChange={(e) => updateField("default_finance_book", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Exchange Gain / Loss & Round Off</CardTitle>
                <CardDescription>Pengaturan selisih kurs mata uang asing dan pembulatan nilai transaksi.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Exchange Gain / Loss Account</Label>
                  <SearchableSelect
                    value={form.exchange_gain_loss_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("exchange_gain_loss_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Unrealized Exchange Gain/Loss Account</Label>
                  <SearchableSelect
                    value={form.unrealized_exchange_gain_loss_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("unrealized_exchange_gain_loss_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Round Off Account</Label>
                  <SearchableSelect
                    value={form.round_off_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("round_off_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Round Off for Opening</Label>
                  <SearchableSelect
                    value={form.round_off_for_opening || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("round_off_for_opening", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Round Off Cost Center</Label>
                  <Input
                    value={form.round_off_cost_center || ""}
                    onChange={(e) => updateField("round_off_cost_center", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Deferred Accounting & Advance Payments</CardTitle>
                <CardDescription>Pendapatan/beban diterima di muka dan uang muka pesanan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Deferred Revenue Account</Label>
                  <SearchableSelect
                    value={form.default_deferred_revenue_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_deferred_revenue_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Deferred Expense Account</Label>
                  <SearchableSelect
                    value={form.default_deferred_expense_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_deferred_expense_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Reconciliation Takes Effect On</Label>
                  <Select
                    value={form.reconciliation_takes_effect_on || "Advance Payment Date"}
                    onValueChange={(val) => updateField("reconciliation_takes_effect_on", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Rekonsiliasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Advance Payment Date">Advance Payment Date</SelectItem>
                      <SelectItem value="Oldest Of Invoice Or Advance">Oldest Of Invoice Or Advance</SelectItem>
                      <SelectItem value="Reconciliation Date">Reconciliation Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label className="text-sm font-semibold">Book Advance Payments in Separate Party Account</Label>
                    <p className="text-xs text-slate-500">
                      Catat penerimaan uang muka di akun kewajiban dan pembayaran uang muka di akun aset.
                    </p>
                  </div>
                  <Switch
                    checked={form.book_advance_payments_in_separate_party_account || false}
                    onCheckedChange={(val) =>
                      updateField("book_advance_payments_in_separate_party_account", val)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Fixed Asset Defaults</CardTitle>
                <CardDescription>Akun penyusutan, pelepasan, dan perolehan aset tetap.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Accumulated Depreciation Account</Label>
                  <SearchableSelect
                    value={form.accumulated_depreciation_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("accumulated_depreciation_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Depreciation Expense Account</Label>
                  <SearchableSelect
                    value={form.depreciation_expense_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("depreciation_expense_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Gain/Loss Account on Asset Disposal</Label>
                  <SearchableSelect
                    value={form.disposal_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("disposal_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Capital Work In Progress Account</Label>
                  <SearchableSelect
                    value={form.capital_work_in_progress_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("capital_work_in_progress_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Asset Received But Not Billed</Label>
                  <SearchableSelect
                    value={form.asset_received_but_not_billed || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("asset_received_but_not_billed", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Asset Depreciation Cost Center</Label>
                  <Input
                    value={form.depreciation_cost_center || ""}
                    onChange={(e) => updateField("depreciation_cost_center", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: ACCOUNTS CLOSING */}
          {/* ========================================================================= */}
          <TabsContent value="accounts-closing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Tutup Buku & Pembekuan Akuntansi</CardTitle>
                <CardDescription>
                  Batasi modifikasi jurnal dan transaksi keuangan sebelum tanggal tertentu.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="accounts_frozen_till_date">Accounts Frozen Till Date</Label>
                  <Input
                    type="date"
                    id="accounts_frozen_till_date"
                    value={form.accounts_frozen_till_date || ""}
                    onChange={(e) => updateField("accounts_frozen_till_date", e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Accounting entries are frozen up to this date. Only users with the specified role can create or modify entries before this date.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="frozen_accounts_modifier">Roles Allowed to Set and Edit Frozen Account Entries</Label>
                  <Input
                    id="frozen_accounts_modifier"
                    value={form.frozen_accounts_modifier || ""}
                    onChange={(e) => updateField("frozen_accounts_modifier", e.target.value)}
                    placeholder="Contoh: Accounts Manager, System Manager"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: BUYING AND SELLING */}
          {/* ========================================================================= */}
          <TabsContent value="buying-selling" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Selling & Targets</CardTitle>
                <CardDescription>Target penjualan bulanan, kontak sales, dan batas kredit default.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Monthly Sales Target</Label>
                  <Input
                    type="number"
                    value={form.monthly_sales_target ?? 0}
                    onChange={(e) => updateField("monthly_sales_target", Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Total Monthly Sales (Actual)</Label>
                  <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    Rp {(form.total_monthly_sales ?? 0).toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    value={form.credit_limit ?? 0}
                    onChange={(e) => updateField("credit_limit", Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Sales Contact</Label>
                  <Input
                    value={form.default_sales_contact || ""}
                    onChange={(e) => updateField("default_sales_contact", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Warehouse for Sales Return</Label>
                  <SearchableSelect
                    value={form.default_warehouse_for_sales_return || ""}
                    options={warehouseSelectOptions}
                    onChange={(val) => updateField("default_warehouse_for_sales_return", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Selling Terms</Label>
                  <Input
                    value={form.default_selling_terms || ""}
                    onChange={(e) => updateField("default_selling_terms", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Buying & Expenses</CardTitle>
                <CardDescription>Akun pembebanan pengadaan barang & jasa.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Buying Terms</Label>
                  <Input
                    value={form.default_buying_terms || ""}
                    onChange={(e) => updateField("default_buying_terms", e.target.value)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Purchase Expense Account</Label>
                  <SearchableSelect
                    value={form.purchase_expense_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("purchase_expense_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Service Expense Account</Label>
                  <SearchableSelect
                    value={form.service_expense_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("service_expense_account", val)}
                    placeholder="For service item..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Purchase Expense Contra Account</Label>
                  <SearchableSelect
                    value={form.purchase_expense_contra_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("purchase_expense_contra_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 5: STOCK AND MANUFACTURING */}
          {/* ========================================================================= */}
          <TabsContent value="stock-manufacturing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Stock Settings</CardTitle>
                <CardDescription>Metode valuasi stok, perpetual inventory, dan akun pergerakan barang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <Label className="text-sm font-semibold">Enable Perpetual Inventory</Label>
                      <p className="text-xs text-slate-500">Otomatisasi jurnal akuntansi saat mutasi stok.</p>
                    </div>
                    <Switch
                      checked={form.enable_perpetual_inventory ?? true}
                      onCheckedChange={(val) => updateField("enable_perpetual_inventory", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <Label className="text-sm font-semibold">Enable Item-wise Inventory Account</Label>
                      <p className="text-xs text-slate-500">Gunakan akun dari Item Master / Item Group.</p>
                    </div>
                    <Switch
                      checked={form.enable_item_wise_inventory_account ?? false}
                      onCheckedChange={(val) =>
                        updateField("enable_item_wise_inventory_account", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <Label className="text-sm font-semibold">Provisional Accounting for Non-Stock</Label>
                      <p className="text-xs text-slate-500">Aktifkan akrual barang non-stok.</p>
                    </div>
                    <Switch
                      checked={form.enable_provisional_accounting_for_non_stock_items ?? false}
                      onCheckedChange={(val) =>
                        updateField("enable_provisional_accounting_for_non_stock_items", val)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Default Inventory Account</Label>
                    <SearchableSelect
                      value={form.default_inventory_account || ""}
                      options={accountSelectOptions}
                      onChange={(val) => updateField("default_inventory_account", val)}
                      placeholder="Contoh: 1141.000 - Persediaan Barang - PZTS"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Default Stock Valuation Method</Label>
                    <Select
                      value={form.valuation_method || "FIFO"}
                      onValueChange={(val) => updateField("valuation_method", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Metode Valuasi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIFO">FIFO (First-In, First-Out)</SelectItem>
                        <SelectItem value="Moving Average">Moving Average</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Stock Adjustment Account</Label>
                    <SearchableSelect
                      value={form.stock_adjustment_account || ""}
                      options={accountSelectOptions}
                      onChange={(val) => updateField("stock_adjustment_account", val)}
                      placeholder="Contoh: 5110.020 - Penyesuaian Stock - PZTS"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Stock Received But Not Billed</Label>
                    <SearchableSelect
                      value={form.stock_received_but_not_billed || ""}
                      options={accountSelectOptions}
                      onChange={(val) => updateField("stock_received_but_not_billed", val)}
                      placeholder="Contoh: 2115.000 - Stock Diterima Tapi Tidak Ditagih - PZTS"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Default Provisional Account</Label>
                    <SearchableSelect
                      value={form.default_provisional_account || ""}
                      options={accountSelectOptions}
                      onChange={(val) => updateField("default_provisional_account", val)}
                      placeholder="Begin typing for results..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Default In-Transit Warehouse</Label>
                    <SearchableSelect
                      value={form.default_in_transit_warehouse || ""}
                      options={warehouseSelectOptions}
                      onChange={(val) => updateField("default_in_transit_warehouse", val)}
                      placeholder="Begin typing for results..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Manufacturing</CardTitle>
                <CardDescription>Gudang barang setengah jadi (WIP), barang jadi (FG), dan sisa produksi (Scrap).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Operating Cost Account</Label>
                  <SearchableSelect
                    value={form.default_operating_cost_account || ""}
                    options={accountSelectOptions}
                    onChange={(val) => updateField("default_operating_cost_account", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Work In Progress Warehouse</Label>
                  <SearchableSelect
                    value={form.default_wip_warehouse || ""}
                    options={warehouseSelectOptions}
                    onChange={(val) => updateField("default_wip_warehouse", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Finished Goods Warehouse</Label>
                  <SearchableSelect
                    value={form.default_fg_warehouse || ""}
                    options={warehouseSelectOptions}
                    onChange={(val) => updateField("default_fg_warehouse", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Scrap Warehouse</Label>
                  <SearchableSelect
                    value={form.default_scrap_warehouse || ""}
                    options={warehouseSelectOptions}
                    onChange={(val) => updateField("default_scrap_warehouse", val)}
                    placeholder="Begin typing for results..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 6: DASHBOARD */}
          {/* ========================================================================= */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Branches</CardTitle>
                  <GitFork className="size-4 text-violet-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{branchesCount}</div>
                  <p className="text-xs text-slate-500">Cabang operasional</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Departments</CardTitle>
                  <FolderTree className="size-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{departmentsCount}</div>
                  <p className="text-xs text-slate-500">Unit kerja organisasi</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Chart of Accounts</CardTitle>
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{accounts.length}</div>
                  <p className="text-xs text-slate-500">Akun terdaftar</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Warehouses</CardTitle>
                  <WarehouseIcon className="size-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{warehouses.length}</div>
                  <p className="text-xs text-slate-500">Gudang penyimpanan</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Tautan Cepat & Modul Terkait</CardTitle>
                <CardDescription>Akses cepat ke konfigurasi dan dokumen transaksi terkait perusahaan ini.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Link
                  to="/desk/account"
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Chart of Accounts</h4>
                      <p className="text-xs text-slate-500">Bagan akun & saldo awal</p>
                    </div>
                  </div>
                  <ExternalLink className="size-4 text-slate-400" />
                </Link>

                <Link
                  to="/desk/warehouse"
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <WarehouseIcon className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Warehouses</h4>
                      <p className="text-xs text-slate-500">Pengaturan lokasi gudang</p>
                    </div>
                  </div>
                  <ExternalLink className="size-4 text-slate-400" />
                </Link>

                <Link
                  to="/desk/gl-entry"
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">General Ledger</h4>
                      <p className="text-xs text-slate-500">Buku besar transaksi keuangan</p>
                    </div>
                  </div>
                  <ExternalLink className="size-4 text-slate-400" />
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </ERPPage>
  );
}
