import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Building2,
  UserCheck,
  CreditCard,
  Settings,
  Filter,
  Printer,
  Coins,
  Compass,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect, SearchableWarehouseSelect } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { warehouseApi } from "@/modules/stock/warehouseApi";
import {
  posProfileApi,
  type POSProfile,
  type POSProfileUser,
  type POSProfilePaymentMethod,
  type POSProfileItemGroup,
  type POSProfileCustomerGroup,
  type POSProfileOptions,
} from "../posProfileApi";
import { toast } from "sonner";

const emptyProfile = (): POSProfile => ({
  name: "",
  company: "",
  customer: "Walk-in Customer",
  country: "Indonesia",
  disabled: false,
  warehouse: "",
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
  const [tab, setTab] = useState<string>("details");

  // Dynamic Options
  const [companies, setCompanies] = useState<{ id?: string; name: string; abbreviation?: string }[]>([]);
  const [companyAddresses, setCompanyAddresses] = useState<{ id?: string; address_title?: string; address_line1?: string; city?: string }[]>([]);
  const [customers, setCustomers] = useState<{ id?: string; customer_name: string }[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [modesOfPayment, setModesOfPayment] = useState<string[]>([
    "Cash",
    "Bank Transfer",
    "QRIS",
    "Credit Card",
  ]);
  const [priceLists, setPriceLists] = useState<string[]>(["Standard Selling"]);
  const [currencies, setCurrencies] = useState<{ name: string; symbol?: string }[]>([
    { name: "IDR", symbol: "Rp" },
    { name: "USD", symbol: "$" },
  ]);
  const [allItemGroups, setAllItemGroups] = useState<string[]>([]);
  const [allCustomerGroups, setAllCustomerGroups] = useState<string[]>([]);
  const [letterHeads, setLetterHeads] = useState<string[]>([]);
  const [taxCategories, setTaxCategories] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);

  // Fetch company addresses whenever selected company changes
  const fetchAddressesForCompany = async (companyNameOrId: string) => {
    if (!companyNameOrId) {
      setCompanyAddresses([]);
      return;
    }
    const matchedComp = companies.find(
      (c) => c.name === companyNameOrId || c.id === companyNameOrId
    );
    const targetKey = matchedComp?.id || companyNameOrId;
    const addrs = await posProfileApi.listCompanyAddresses(targetKey);
    setCompanyAddresses(addrs || []);
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [
          opts,
          compList,
          whList,
          custList,
          userList,
          currList,
          plList,
          igList,
          cgList,
          lhList,
          tcList,
          prjList,
        ] = await Promise.all([
          posProfileApi.options(),
          posProfileApi.listCompanies(),
          warehouseApi.list(),
          posProfileApi.listCustomers(),
          posProfileApi.listUsers(),
          posProfileApi.listCurrencies(),
          posProfileApi.listPriceLists(),
          posProfileApi.listItemGroups(),
          posProfileApi.listCustomerGroups(),
          posProfileApi.listLetterHeads(),
          posProfileApi.listTaxCategories(),
          posProfileApi.listProjects(),
        ]);

        if (compList && compList.length > 0) setCompanies(compList);
        if (whList && whList.length > 0) {
          setWarehouses(whList.map((w) => w.warehouse_name));
        }
        if (custList && custList.length > 0) setCustomers(custList);
        
        // Merge users
        const uNames = new Set<string>();
        if (opts?.users) opts.users.forEach((u) => uNames.add(u));
        if (userList) userList.forEach((u) => uNames.add(u.display_name || u.username));
        setUsers(Array.from(uNames));

        if (opts?.modes_of_payment && opts.modes_of_payment.length > 0) {
          setModesOfPayment(opts.modes_of_payment);
        }
        if (currList && currList.length > 0) setCurrencies(currList);
        if (plList && plList.length > 0) setPriceLists(plList);
        if (igList && igList.length > 0) setAllItemGroups(igList);
        if (cgList && cgList.length > 0) setAllCustomerGroups(cgList);
        if (lhList && lhList.length > 0) setLetterHeads(lhList);
        if (tcList && tcList.length > 0) setTaxCategories(tcList);
        if (prjList && prjList.length > 0) setProjects(prjList);

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
            if (data.company) {
              fetchAddressesForCompany(data.company);
            }
          }
        } else {
          // Default company & warehouse from fetched lists
          const defaultCompany = compList?.[0]?.name || "";
          const defaultWarehouse = whList?.[0]?.warehouse_name || "";
          setRow((prev) => ({
            ...prev,
            company: prev.company || defaultCompany,
            warehouse: prev.warehouse || defaultWarehouse,
          }));
          if (defaultCompany) {
            fetchAddressesForCompany(defaultCompany);
          }
        }
      } catch {
        toast.error("Gagal memuat data master POS Profile");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isNew]);

  const handleCompanyChange = (companyName: string) => {
    setRow((prev) => ({ ...prev, company: companyName, company_address: "" }));
    fetchAddressesForCompany(companyName);
  };

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

  // Applicable for Users Handlers
  const handleAddUser = () => {
    setRow((prev) => ({
      ...prev,
      applicable_for_users: [
        ...(prev.applicable_for_users || []),
        { user: users[0] || "Administrator", default: false },
      ],
    }));
  };

  const handleRemoveUser = (index: number) => {
    setRow((prev) => {
      const list = [...(prev.applicable_for_users || [])];
      list.splice(index, 1);
      return { ...prev, applicable_for_users: list };
    });
  };

  // Payments Handlers
  const handleAddPayment = () => {
    setRow((prev) => ({
      ...prev,
      payments: [
        ...(prev.payments || []),
        {
          mode_of_payment: modesOfPayment[0] || "Cash",
          default: false,
          allow_in_returns: true,
        },
      ],
    }));
  };

  const handleRemovePayment = (index: number) => {
    setRow((prev) => {
      const list = [...(prev.payments || [])];
      list.splice(index, 1);
      return { ...prev, payments: list };
    });
  };

  // Item Groups Handlers
  const handleAddItemGroup = () => {
    setRow((prev) => ({
      ...prev,
      item_groups: [
        ...(prev.item_groups || []),
        { item_group: allItemGroups[0] || "Products" },
      ],
    }));
  };

  const handleRemoveItemGroup = (index: number) => {
    setRow((prev) => {
      const list = [...(prev.item_groups || [])];
      list.splice(index, 1);
      return { ...prev, item_groups: list };
    });
  };

  // Customer Groups Handlers
  const handleAddCustomerGroup = () => {
    setRow((prev) => ({
      ...prev,
      customer_groups: [
        ...(prev.customer_groups || []),
        { customer_group: allCustomerGroups[0] || "All Customer Groups" },
      ],
    }));
  };

  const handleRemoveCustomerGroup = (index: number) => {
    setRow((prev) => {
      const list = [...(prev.customer_groups || [])];
      list.splice(index, 1);
      return { ...prev, customer_groups: list };
    });
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Action Bar */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <Link to="/desk/pos-profile" className="hover:text-blue-600">
              POS Profile
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New POS Profile" : row.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New POS Profile" : row.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isNew
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  : row.disabled
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              }`}
            >
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
            disabled={saving || loading}
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
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Details & Users
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Payments & Configuration
            </TabsTrigger>
            <TabsTrigger
              value="filters_print"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Filters & Print
            </TabsTrigger>
            <TabsTrigger
              value="accounting"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent px-2 text-sm font-medium"
            >
              Accounting & Dimensions
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================= TAB 1: DETAILS & USERS ================= */}
        <TabsContent value="details" className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Building2 className="size-4 text-blue-600" />
              General Details
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={row.name}
                  onChange={(e) => setRow({ ...row, name: e.target.value })}
                  placeholder="__newname"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <CompanySelect
                    value={row.company}
                    onChange={handleCompanyChange}
                    placeholder="Pilih Company..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.customer || ""}
                    options={customers.map((c) => ({
                      value: c.customer_name,
                      label: c.customer_name,
                    }))}
                    onChange={(val) => setRow({ ...row, customer: val })}
                    placeholder="Pilih Customer..."
                    searchPlaceholder="Cari customer..."
                    addNewLabel="Tambah Customer"
                    addNewHref="/desk/customer/new"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Country
                </label>
                <Input
                  value={row.country || "Indonesia"}
                  onChange={(e) => setRow({ ...row, country: e.target.value })}
                  placeholder="Indonesia"
                  className="mt-1"
                />
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
                  Company Address
                </label>
                <div className="mt-1">
                  {companyAddresses.length > 0 ? (
                    <SearchableSelect
                      value={row.company_address || ""}
                      options={companyAddresses.map((a) => ({
                        value: a.address_title || a.address_line1 || a.id || "",
                        label: `${a.address_title || "Address"}${
                          a.address_line1 ? ` - ${a.address_line1}` : ""
                        }`,
                        badge: a.city,
                      }))}
                      onChange={(val) => setRow({ ...row, company_address: val })}
                      placeholder="Pilih Alamat Toko / Company..."
                      searchPlaceholder="Cari alamat..."
                      addNewLabel="Tambah Alamat"
                      addNewHref="/desk/address/new"
                    />
                  ) : (
                    <Input
                      value={row.company_address || ""}
                      onChange={(e) =>
                        setRow({ ...row, company_address: e.target.value })
                      }
                      placeholder="Masukkan alamat atau buat baru di Address..."
                    />
                  )}
                </div>
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
                  Jika dinonaktifkan, profil kasir ini tidak dapat digunakan saat membuka POS Shift Opening Entry.
                </p>
              </div>
            </div>
          </div>

          {/* Applicable for Users */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <UserCheck className="size-4 text-blue-600" />
                  Applicable for Users
                </h3>
                <p className="text-xs text-slate-400">
                  Hanya user terdaftar di bawah yang dapat membuka profil kasir ini. Jika tabel kosong, semua kasir diizinkan.
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
                    <th className="py-2.5 px-3 w-28 text-center">Default</th>
                    <th className="py-2.5 px-3 min-w-[240px]">User</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.applicable_for_users || []).map((u, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
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
                      <td className="py-2.5 px-3">
                        <SearchableSelect
                          value={u.user}
                          options={users.map((name) => ({
                            value: name,
                            label: name,
                          }))}
                          onChange={(val) => {
                            const list = [...(row.applicable_for_users || [])];
                            list[index] = { ...list[index], user: val };
                            setRow({ ...row, applicable_for_users: list });
                          }}
                          placeholder="Pilih user kasir..."
                          searchPlaceholder="Cari nama user..."
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
                  {(!row.applicable_for_users ||
                    row.applicable_for_users.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No rows. Semua kasir dapat menggunakan profil ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 2: PAYMENTS & CONFIGURATION ================= */}
        <TabsContent value="configuration" className="space-y-6">
          {/* Payment Methods */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CreditCard className="size-4 text-blue-600" />
                  Payment Methods
                </h3>
                <p className="text-xs text-slate-400">
                  Tentukan mode pembayaran yang diterima, mode default, dan izin refund/retur.
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
                    <th className="py-2.5 px-3 w-28 text-center">Default</th>
                    <th className="py-2.5 px-3 w-36 text-center">Allow In Returns</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Mode of Payment</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.payments || []).map((p, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
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
                      <td className="py-2.5 px-3">
                        <SearchableSelect
                          value={p.mode_of_payment}
                          options={modesOfPayment.map((m) => ({
                            value: m,
                            label: m,
                          }))}
                          onChange={(val) => {
                            const list = [...(row.payments || [])];
                            list[index] = { ...list[index], mode_of_payment: val };
                            setRow({ ...row, payments: list });
                          }}
                          placeholder="Pilih Mode of Payment..."
                          searchPlaceholder="Cari mode pembayaran..."
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
                  {(!row.payments || row.payments.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No rows. Tambahkan minimal satu metode pembayaran.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Configuration */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Settings className="size-4 text-blue-600" />
              Configuration
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.hide_images}
                  onCheckedChange={(c) => setRow({ ...row, hide_images: !!c })}
                />
                Hide Images
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.hide_unavailable_items}
                  onCheckedChange={(c) =>
                    setRow({ ...row, hide_unavailable_items: !!c })
                  }
                />
                Hide Unavailable Items
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.auto_add_item_to_cart}
                  onCheckedChange={(c) =>
                    setRow({ ...row, auto_add_item_to_cart: !!c })
                  }
                />
                Automatically Add Filtered Item To Cart
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.validate_stock_on_save}
                  onCheckedChange={(c) =>
                    setRow({ ...row, validate_stock_on_save: !!c })
                  }
                />
                Validate Stock on Save
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.print_receipt_on_order_complete}
                  onCheckedChange={(c) =>
                    setRow({ ...row, print_receipt_on_order_complete: !!c })
                  }
                />
                Print Receipt on Order Complete
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.ignore_pricing_rule}
                  onCheckedChange={(c) =>
                    setRow({ ...row, ignore_pricing_rule: !!c })
                  }
                />
                Ignore Pricing Rule
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.allow_rate_change}
                  onCheckedChange={(c) =>
                    setRow({ ...row, allow_rate_change: !!c })
                  }
                />
                Allow User to Edit Rate
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.allow_discount_change}
                  onCheckedChange={(c) =>
                    setRow({ ...row, allow_discount_change: !!c })
                  }
                />
                Allow User to Edit Discount
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.set_grand_total_to_default_mop}
                  onCheckedChange={(c) =>
                    setRow({ ...row, set_grand_total_to_default_mop: !!c })
                  }
                />
                Set Grand Total to Default Payment Method
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={row.allow_partial_payment}
                  onCheckedChange={(c) =>
                    setRow({ ...row, allow_partial_payment: !!c })
                  }
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
                onChange={(e) =>
                  setRow({ ...row, action_on_new_invoice: e.target.value })
                }
                className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
              >
                <option value="Always Ask">Always Ask</option>
                <option value="Save Changes and Load New Invoice">
                  Save Changes and Load New Invoice
                </option>
                <option value="Discard Changes and Load New Invoice">
                  Discard Changes and Load New Invoice
                </option>
              </select>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 3: FILTERS & PRINT ================= */}
        <TabsContent value="filters_print" className="space-y-6">
          {/* Filters: Item Groups */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Filter className="size-4 text-blue-600" />
                  Item Groups (Hanya tampilkan produk dari grup ini)
                </h3>
                <p className="text-xs text-slate-400">
                  Jika dibiarkan kosong, semua grup item akan tampil di POS katalog.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddItemGroup}>
                <Plus className="mr-1.5 size-3.5" /> Tambah Baris
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No.</th>
                    <th className="py-2.5 px-3 min-w-[250px]">Item Group</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.item_groups || []).map((ig, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <SearchableSelect
                          value={ig.item_group}
                          options={allItemGroups.map((g) => ({
                            value: g,
                            label: g,
                          }))}
                          onChange={(val) => {
                            const list = [...(row.item_groups || [])];
                            list[index] = { ...list[index], item_group: val };
                            setRow({ ...row, item_groups: list });
                          }}
                          placeholder="Pilih Item Group..."
                          searchPlaceholder="Cari item group..."
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleRemoveItemGroup(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!row.item_groups || row.item_groups.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No rows. Semua grup item diperbolehkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filters: Customer Groups */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Filter className="size-4 text-blue-600" />
                  Customer Groups (Hanya tampilkan customer dari grup ini)
                </h3>
                <p className="text-xs text-slate-400">
                  Jika dibiarkan kosong, semua customer dapat dipilih pada sesi kasir.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddCustomerGroup}
              >
                <Plus className="mr-1.5 size-3.5" /> Tambah Baris
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No.</th>
                    <th className="py-2.5 px-3 min-w-[250px]">Customer Group</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(row.customer_groups || []).map((cg, index) => (
                    <tr key={index}>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <SearchableSelect
                          value={cg.customer_group}
                          options={allCustomerGroups.map((g) => ({
                            value: g,
                            label: g,
                          }))}
                          onChange={(val) => {
                            const list = [...(row.customer_groups || [])];
                            list[index] = { ...list[index], customer_group: val };
                            setRow({ ...row, customer_groups: list });
                          }}
                          placeholder="Pilih Customer Group..."
                          searchPlaceholder="Cari customer group..."
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleRemoveCustomerGroup(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!row.customer_groups || row.customer_groups.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No rows. Semua customer group diperbolehkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print Settings */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Printer className="size-4 text-blue-600" />
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
                  placeholder="Standard / POS Receipt"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Letter Head
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.letter_head || ""}
                    options={letterHeads.map((lh) => ({
                      value: lh,
                      label: lh,
                    }))}
                    onChange={(val) => setRow({ ...row, letter_head: val })}
                    placeholder="Pilih Letter Head..."
                    searchPlaceholder="Cari kop surat..."
                    addNewLabel="Tambah Kop Surat"
                    addNewHref="/desk/letter-head/new"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terms and Conditions
                </label>
                <Input
                  value={row.tc_name || ""}
                  onChange={(e) => setRow({ ...row, tc_name: e.target.value })}
                  placeholder="e.g. Syarat Garansi Toko..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Print Heading
                </label>
                <Input
                  value={row.select_print_heading || "Invoice"}
                  onChange={(e) =>
                    setRow({ ...row, select_print_heading: e.target.value })
                  }
                  placeholder="Invoice / POS Receipt"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 4: ACCOUNTING & DIMENSIONS ================= */}
        <TabsContent value="accounting" className="space-y-6">
          {/* Accounting Settings */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Coins className="size-4 text-blue-600" />
              Accounting
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Price List
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.selling_price_list || "Standard Selling"}
                    options={priceLists.map((p) => ({
                      value: p,
                      label: p,
                    }))}
                    onChange={(val) => setRow({ ...row, selling_price_list: val })}
                    placeholder="Pilih Price List..."
                    searchPlaceholder="Cari price list..."
                    addNewLabel="Tambah Price List"
                    addNewHref="/desk/price-list/new"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.currency || "IDR"}
                    options={currencies.map((c) => ({
                      value: c.name,
                      label: `${c.name}${c.symbol ? ` (${c.symbol})` : ""}`,
                      badge: c.name,
                    }))}
                    onChange={(val) => setRow({ ...row, currency: val })}
                    placeholder="Pilih Mata Uang..."
                    searchPlaceholder="Cari mata uang..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Write Off Account
                </label>
                <Input
                  value={row.write_off_account || ""}
                  onChange={(e) =>
                    setRow({ ...row, write_off_account: e.target.value })
                  }
                  placeholder="e.g. 5110 - Beban Pembulatan"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Write Off Cost Center
                </label>
                <Input
                  value={row.write_off_cost_center || ""}
                  onChange={(e) =>
                    setRow({ ...row, write_off_cost_center: e.target.value })
                  }
                  placeholder="e.g. Main - PZTS"
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
                    setRow({
                      ...row,
                      write_off_limit: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Auto write off precision loss while consolidation
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account for Change Amount
                </label>
                <Input
                  value={row.account_for_change_amount || ""}
                  onChange={(e) =>
                    setRow({ ...row, account_for_change_amount: e.target.value })
                  }
                  placeholder="e.g. Cash - MC"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Income Account
                </label>
                <Input
                  value={row.income_account || ""}
                  onChange={(e) => setRow({ ...row, income_account: e.target.value })}
                  placeholder="e.g. 4110 - Pendapatan Penjualan"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Expense Account
                </label>
                <Input
                  value={row.expense_account || ""}
                  onChange={(e) =>
                    setRow({ ...row, expense_account: e.target.value })
                  }
                  placeholder="e.g. 5110 - Biaya Pokok Penjualan"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Taxes and Charges
                </label>
                <Input
                  value={row.taxes_and_charges || ""}
                  onChange={(e) =>
                    setRow({ ...row, taxes_and_charges: e.target.value })
                  }
                  placeholder="Template Pajak Penjualan..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tax Category
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.tax_category || ""}
                    options={taxCategories.map((t) => ({
                      value: t,
                      label: t,
                    }))}
                    onChange={(val) => setRow({ ...row, tax_category: val })}
                    placeholder="Pilih Tax Category..."
                    searchPlaceholder="Cari kategori pajak..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Apply Discount On
                </label>
                <select
                  value={row.apply_discount_on || "Grand Total"}
                  onChange={(e) =>
                    setRow({ ...row, apply_discount_on: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                >
                  <option value="Grand Total">Grand Total</option>
                  <option value="Net Total">Net Total</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                  <Checkbox
                    checked={row.disable_rounded_total}
                    onCheckedChange={(c) =>
                      setRow({ ...row, disable_rounded_total: !!c })
                    }
                  />
                  Disable Rounded Total
                </label>
                <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                  If enabled, the consolidated invoices will have rounded total disabled
                </p>
              </div>
            </div>
          </div>

          {/* Accounting Dimensions */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Compass className="size-4 text-blue-600" />
              Accounting Dimensions
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cost Center
                </label>
                <Input
                  value={row.cost_center || ""}
                  onChange={(e) => setRow({ ...row, cost_center: e.target.value })}
                  placeholder="e.g. Main - MC"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    value={row.project || ""}
                    options={projects.map((p) => ({
                      value: p,
                      label: p,
                    }))}
                    onChange={(val) => setRow({ ...row, project: val })}
                    placeholder="Pilih Project..."
                    searchPlaceholder="Cari project..."
                    addNewLabel="Tambah Project"
                    addNewHref="/desk/project/new"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Campaign */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
              <Megaphone className="size-4 text-blue-600" />
              Campaign
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Source
                </label>
                <Input
                  value={row.utm_source || ""}
                  onChange={(e) => setRow({ ...row, utm_source: e.target.value })}
                  placeholder="utm_source"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Campaign
                </label>
                <Input
                  value={row.utm_campaign || ""}
                  onChange={(e) => setRow({ ...row, utm_campaign: e.target.value })}
                  placeholder="utm_campaign"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Medium
                </label>
                <Input
                  value={row.utm_medium || ""}
                  onChange={(e) => setRow({ ...row, utm_medium: e.target.value })}
                  placeholder="utm_medium"
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
