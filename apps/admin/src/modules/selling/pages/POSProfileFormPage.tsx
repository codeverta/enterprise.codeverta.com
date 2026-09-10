import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  UserCheck,
  CreditCard,
  Building2,
  Settings,
  Printer,
  Coins,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect, SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import {
  posProfileApi,
  type POSProfile,
  type POSProfileUser,
  type POSProfilePaymentMethod,
  type POSProfileOptions,
} from "../posProfileApi";
import { toast } from "sonner";

const emptyProfile = (): POSProfile => ({
  name: "",
  company: "UD MILLION CANDLES",
  customer: "",
  country: "Indonesia",
  disabled: false,
  warehouse: "Stores - MC",
  company_address: "",
  hide_images: false,
  hide_unavailable_items: false,
  auto_add_item_to_cart: false,
  validate_stock_on_save: false,
  print_receipt_on_order_complete: true,
  action_on_new_invoice: "Always Ask",
  ignore_pricing_rule: false,
  allow_rate_change: false,
  allow_discount_change: false,
  set_grand_total_to_default_mop: true,
  allow_partial_payment: false,
  print_format: "Standard",
  letter_head: "",
  tc_name: "",
  select_print_heading: "Invoice",
  selling_price_list: "Standard Selling",
  currency: "IDR",
  write_off_account: "",
  write_off_cost_center: "",
  write_off_limit: 0,
  account_for_change_amount: "",
  disable_rounded_total: false,
  income_account: "",
  expense_account: "",
  taxes_and_charges: "",
  tax_category: "",
  apply_discount_on: "Grand Total",
  cost_center: "",
  project: "",
  utm_source: "",
  utm_campaign: "",
  utm_medium: "",
  applicable_for_users: [{ user: "Administrator", default: true }],
  payments: [
    { mode_of_payment: "Cash", default: true, allow_in_returns: true },
    { mode_of_payment: "Bank Transfer", default: false, allow_in_returns: true },
  ],
  item_groups: [],
  customer_groups: [],
});

export default function POSProfileFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-pos-profile");

  const [row, setRow] = useState<POSProfile>(emptyProfile());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<string>("general");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([
    "Stores - MC",
    "Stores - PT ZENIT",
    "Finished Goods - PT ZENIT",
  ]);
  const [options, setOptions] = useState<POSProfileOptions>({
    companies: ["UD MILLION CANDLES", "PT ZENIT TECHNOLOGY SOLUTION"],
    users: ["Administrator", "Kasir 1"],
    modes_of_payment: ["Cash", "Bank Transfer", "QRIS", "Credit Card"],
    action_on_new_invoices: [
      "Always Ask",
      "Save Changes and Load New Invoice",
      "Discard Changes and Load New Invoice",
    ],
  });

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [opts, compList, whList] = await Promise.all([
          posProfileApi.options(),
          warehouseApi.listCompanies(),
          warehouseApi.list(),
        ]);
        if (opts) setOptions(opts);
        if (compList && compList.length > 0) setCompanies(compList);
        if (whList && whList.length > 0) {
          setWarehouses(whList.map((w) => w.warehouse_name));
        }

        if (!isNew && id) {
          const data = await posProfileApi.get(id);
          if (data) {
            setRow({
              ...data,
              applicable_for_users: data.applicable_for_users || [],
              payments: data.payments || [],
              item_groups: data.item_groups || [],
              customer_groups: data.customer_groups || [],
            });
          }
        }
      } catch {
        toast.error("Gagal memuat POS Profile");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isNew]);

  const handleSave = async () => {
    if (!row.name.trim()) {
      toast.error("Name POS Profile wajib diisi");
      return;
    }
    if (!row.company.trim()) {
      toast.error("Company wajib diisi");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await posProfileApi.create(row);
        toast.success("POS Profile berhasil dibuat");
        navigate(`/desk/pos-profile/${created.id || created.name}`);
      } else {
        const updated = await posProfileApi.update(id!, row);
        toast.success("POS Profile berhasil diperbarui");
        setRow(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan POS Profile");
    } finally {
      setSaving(false);
    }
  };

  // Add / Remove User
  const handleAddUser = () => {
    setRow({
      ...row,
      applicable_for_users: [
        ...(row.applicable_for_users || []),
        { user: options.users[0] || "Administrator", default: false },
      ],
    });
  };

  const handleRemoveUser = (index: number) => {
    const list = [...(row.applicable_for_users || [])];
    list.splice(index, 1);
    setRow({ ...row, applicable_for_users: list });
  };

  // Add / Remove Payment
  const handleAddPayment = () => {
    setRow({
      ...row,
      payments: [
        ...(row.payments || []),
        { mode_of_payment: "Cash", default: false, allow_in_returns: true },
      ],
    });
  };

  const handleRemovePayment = (index: number) => {
    const list = [...(row.payments || [])];
    list.splice(index, 1);
    setRow({ ...row, payments: list });
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Action Bar */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <Link to="/desk/pos-profile" className="hover:text-blue-600">POS Profile</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New POS Profile" : row.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New POS Profile" : row.name}
            </h1>
            <span className="text-xs text-slate-400">
              {isNew ? "Not Saved" : row.disabled ? "Disabled" : "Active"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/pos-profile">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>

          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 size-4" />
            {saving ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Form Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="border-b bg-white px-5 rounded-2xl shadow-sm dark:bg-slate-950">
          <TabsList className="bg-transparent h-12 gap-6 p-0">
            <TabsTrigger
              value="general"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              General & Users
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Configuration & Payments
            </TabsTrigger>
            <TabsTrigger
              value="accounting"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Accounting & Print
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: General & Users */}
        <TabsContent value="general" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
              Informasi Utama
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={row.name}
                  onChange={(e) => setRow({ ...row, name: e.target.value })}
                  placeholder="e.g. Usaha Jualan Lilin / Kasir Utama"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.company}
                    options={(companies.length > 0
                      ? companies
                      : options.companies.map((name) => ({ name }))
                    ).map((c) => ({
                      value: c.name,
                      label: c.name,
                      badge: c.abbreviation || undefined,
                    }))}
                    onChange={(val) => setRow({ ...row, company: val })}
                    placeholder="Pilih Company..."
                    searchPlaceholder="Cari nama company..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Warehouse
                </label>
                <div className="mt-1">
                  <SearchableWarehouseSelect
                    value={row.warehouse || ""}
                    warehouses={warehouses}
                    onChange={(wh) => setRow({ ...row, warehouse: wh })}
                    placeholder="Pilih Gudang..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer
                </label>
                <Input
                  value={row.customer || ""}
                  onChange={(e) => setRow({ ...row, customer: e.target.value })}
                  placeholder="e.g. Walk-in Customer"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Country
                </label>
                <Input
                  value={row.country || "Indonesia"}
                  onChange={(e) => setRow({ ...row, country: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company Address
                </label>
                <Input
                  value={row.company_address || ""}
                  onChange={(e) => setRow({ ...row, company_address: e.target.value })}
                  placeholder="Alamat outlet atau toko..."
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                  <Checkbox
                    checked={row.disabled}
                    onCheckedChange={(c) => setRow({ ...row, disabled: !!c })}
                  />
                  Disabled
                </label>
                <p className="mt-1 text-[11px] text-slate-400 pl-6">
                  Jika dinonaktifkan, profil kasir ini tidak akan muncul saat membuka POS Opening Entry.
                </p>
              </div>
            </div>
          </div>

          {/* Applicable for Users */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Applicable for Users (Kasir yang Dapat Memakai Profil Ini)
                </h3>
                <p className="text-xs text-slate-400">
                  Tentukan user kasir yang memiliki akses ke profil POS ini.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddUser}>
                <Plus className="mr-1.5 size-3.5" /> Tambah User
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No.</th>
                    <th className="py-2.5 px-3 min-w-[200px]">User / Cashier</th>
                    <th className="py-2.5 px-3 w-28 text-center">Default</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.applicable_for_users || []).map((u, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <SearchableSelect
                          value={u.user}
                          options={options.users.map((name) => ({
                            value: name,
                            label: name,
                          }))}
                          onChange={(val) => {
                            const list = [...(row.applicable_for_users || [])];
                            list[index] = { ...list[index], user: val };
                            setRow({ ...row, applicable_for_users: list });
                          }}
                          placeholder="Pilih user kasir..."
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={u.default}
                          onCheckedChange={(c) => {
                            const list = [...(row.applicable_for_users || [])];
                            list[index] = { ...list[index], default: !!c };
                            setRow({ ...row, applicable_for_users: list });
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleRemoveUser(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!row.applicable_for_users || row.applicable_for_users.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Semua user kasir memiliki akses (tidak ada filter user spesifik).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Configuration & Payments */}
        <TabsContent value="configuration" className="space-y-6">
          {/* Payment Methods */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Payment Methods
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar metode pembayaran yang aktif pada POS kasir.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddPayment}>
                <Plus className="mr-1.5 size-3.5" /> Tambah Mode of Payment
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No.</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Mode of Payment</th>
                    <th className="py-2.5 px-3 w-28 text-center">Default</th>
                    <th className="py-2.5 px-3 w-36 text-center">Allow In Returns</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.payments || []).map((p, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={p.mode_of_payment}
                          onChange={(e) => {
                            const list = [...(row.payments || [])];
                            list[index] = { ...list[index], mode_of_payment: e.target.value };
                            setRow({ ...row, payments: list });
                          }}
                          className="w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                        >
                          {options.modes_of_payment.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={p.default}
                          onCheckedChange={(c) => {
                            const list = (row.payments || []).map((item, i) => ({
                              ...item,
                              default: i === index ? !!c : false,
                            }));
                            setRow({ ...row, payments: list });
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={p.allow_in_returns}
                          onCheckedChange={(c) => {
                            const list = [...(row.payments || [])];
                            list[index] = { ...list[index], allow_in_returns: !!c };
                            setRow({ ...row, payments: list });
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleRemovePayment(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Configuration
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.hide_images}
                  onCheckedChange={(c) => setRow({ ...row, hide_images: !!c })}
                />
                Hide Images
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.hide_unavailable_items}
                  onCheckedChange={(c) => setRow({ ...row, hide_unavailable_items: !!c })}
                />
                Hide Unavailable Items
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.auto_add_item_to_cart}
                  onCheckedChange={(c) => setRow({ ...row, auto_add_item_to_cart: !!c })}
                />
                Automatically Add Filtered Item To Cart
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.validate_stock_on_save}
                  onCheckedChange={(c) => setRow({ ...row, validate_stock_on_save: !!c })}
                />
                Validate Stock on Save
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.print_receipt_on_order_complete}
                  onCheckedChange={(c) =>
                    setRow({ ...row, print_receipt_on_order_complete: !!c })
                  }
                />
                Print Receipt on Order Complete
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.ignore_pricing_rule}
                  onCheckedChange={(c) => setRow({ ...row, ignore_pricing_rule: !!c })}
                />
                Ignore Pricing Rule
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.allow_rate_change}
                  onCheckedChange={(c) => setRow({ ...row, allow_rate_change: !!c })}
                />
                Allow User to Edit Rate
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.allow_discount_change}
                  onCheckedChange={(c) => setRow({ ...row, allow_discount_change: !!c })}
                />
                Allow User to Edit Discount
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.set_grand_total_to_default_mop}
                  onCheckedChange={(c) =>
                    setRow({ ...row, set_grand_total_to_default_mop: !!c })
                  }
                />
                Set Grand Total to Default Payment Method
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={row.allow_partial_payment}
                  onCheckedChange={(c) => setRow({ ...row, allow_partial_payment: !!c })}
                />
                Allow Partial Payment
              </label>
            </div>

            <div className="pt-3 border-t">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Action on New Invoice
              </label>
              <select
                value={row.action_on_new_invoice}
                onChange={(e) => setRow({ ...row, action_on_new_invoice: e.target.value })}
                className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
              >
                {options.action_on_new_invoices.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Accounting & Print */}
        <TabsContent value="accounting" className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Accounting Settings
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Price List
                </label>
                <Input
                  value={row.selling_price_list || "Standard Selling"}
                  onChange={(e) => setRow({ ...row, selling_price_list: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency
                </label>
                <Input
                  value={row.currency || "IDR"}
                  onChange={(e) => setRow({ ...row, currency: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Write Off Limit
                </label>
                <Input
                  type="number"
                  value={row.write_off_limit}
                  onChange={(e) =>
                    setRow({ ...row, write_off_limit: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Auto write off precision loss while consolidation.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Apply Discount On
                </label>
                <select
                  value={row.apply_discount_on}
                  onChange={(e) => setRow({ ...row, apply_discount_on: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                >
                  <option value="Grand Total">Grand Total</option>
                  <option value="Net Total">Net Total</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={row.disable_rounded_total}
                    onCheckedChange={(c) =>
                      setRow({ ...row, disable_rounded_total: !!c })
                    }
                  />
                  Disable Rounded Total
                </label>
                <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                  If enabled, the consolidated invoices will have rounded total disabled.
                </p>
              </div>
            </div>
          </div>

          {/* Print Settings */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
              Print Settings
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Print Format
                </label>
                <Input
                  value={row.print_format || "Standard"}
                  onChange={(e) => setRow({ ...row, print_format: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Letter Head
                </label>
                <Input
                  value={row.letter_head || ""}
                  onChange={(e) => setRow({ ...row, letter_head: e.target.value })}
                  placeholder="Kop surat nota..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terms and Conditions
                </label>
                <Input
                  value={row.tc_name || ""}
                  onChange={(e) => setRow({ ...row, tc_name: e.target.value })}
                  placeholder="Syarat & Ketentuan garansi..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Print Heading
                </label>
                <Input
                  value={row.select_print_heading || "Invoice"}
                  onChange={(e) => setRow({ ...row, select_print_heading: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
