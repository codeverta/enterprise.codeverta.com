import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe,
  Info,
  Mail,
  MapPin,
  Phone,
  Save,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { customerApi, type Customer, type CustomerGroupItem } from "../customerApi";
import { territoryApi, type Territory } from "../territoryApi";
import { currencyApi, type Currency } from "@/modules/accounting/currencyApi";

type Tab = "details" | "contact" | "billing" | "settings";

const emptyCustomer: Customer = {
  customer_name: "",
  customer_type: "Company",
  customer_group: "All Customer Groups",
  territory: "All Territories",
  tax_id: "",
  email: "",
  phone: "",
  mobile_no: "",
  website: "",
  address: "",
  default_currency: "IDR",
  default_price_list: "Standard Selling",
  payment_terms: "",
  credit_limit: 0,
  notes: "",
  disabled: false,
  is_default_for_pos: false,
};

function Field({
  label,
  name,
  required,
  error,
  tooltip,
  children,
}: {
  label: string;
  name?: string;
  required?: boolean;
  error?: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex rounded-full text-slate-400 hover:text-blue-600 focus-visible:outline-none"
                  aria-label={`Info ${label}`}
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
                {name && <p className="mt-1 text-[11px] opacity-75 font-mono">{name}</p>}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-customer");

  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Options state
  const [customerGroups, setCustomerGroups] = useState<CustomerGroupItem[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    // 1. Fetch Customer Groups from API
    customerApi
      .listGroups()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCustomerGroups(data);
        }
      })
      .catch((err) => {
        console.warn("Could not load customer groups:", err);
      });

    // 2. Fetch Territories from API
    territoryApi
      .list()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTerritories(data);
        } else {
          return territoryApi.options().then((opts) => {
            if (opts?.parent_territories) {
              setTerritories(
                opts.parent_territories.map((t) => ({
                  territory_name: t,
                  is_group: false,
                }))
              );
            }
          });
        }
      })
      .catch((err) => {
        console.warn("Could not load territories:", err);
      });

    // 3. Fetch Billing Currencies from API
    currencyApi
      .list({ enabled: true })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCurrencies(data);
        }
      })
      .catch((err) => {
        console.warn("Could not load currencies:", err);
      });

    // If editing, load customer data
    if (!isNew && id) {
      customerApi
        .get(id)
        .then((data) => {
          if (data) {
            setCustomer({
              ...emptyCustomer,
              ...data,
              customer_name: data.customer_name ?? "",
              customer_type: data.customer_type ?? "Company",
              customer_group: data.customer_group ?? "All Customer Groups",
              territory: data.territory ?? "All Territories",
              tax_id: data.tax_id ?? "",
              email: data.email ?? "",
              phone: data.phone ?? "",
              mobile_no: data.mobile_no ?? "",
              website: data.website ?? "",
              address: data.address ?? "",
              default_currency: data.default_currency ?? "IDR",
              default_price_list: data.default_price_list ?? "Standard Selling",
              payment_terms: data.payment_terms ?? "",
              credit_limit: data.credit_limit ?? 0,
              notes: data.notes ?? "",
              disabled: Boolean(data.disabled),
              is_default_for_pos: Boolean(data.is_default_for_pos),
            });
          }
        })
        .catch((err: any) => {
          toast.error(err?.response?.data?.error || "Gagal mengambil data customer");
          navigate("/desk/customer");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  // Transform options for SearchableSelect
  const customerGroupOptions: SearchableSelectOption[] = useMemo(() => {
    const list = customerGroups.map((g) => ({
      value: g.group_name,
      label: g.group_name,
      sublabel: g.parent_group ? `Parent: ${g.parent_group}` : undefined,
    }));
    // Default fallback groups if empty
    if (list.length === 0) {
      return [
        { value: "All Customer Groups", label: "All Customer Groups" },
        { value: "Commercial", label: "Commercial" },
        { value: "Individual", label: "Individual" },
        { value: "Non Profit", label: "Non Profit" },
        { value: "Government", label: "Government" },
      ];
    }
    return list;
  }, [customerGroups]);

  const territoryOptions: SearchableSelectOption[] = useMemo(() => {
    const list = territories.map((t) => ({
      value: t.territory_name,
      label: t.territory_name,
      sublabel: t.parent_territory ? `Parent: ${t.parent_territory}` : undefined,
    }));
    if (list.length === 0) {
      return [
        { value: "All Territories", label: "All Territories" },
        { value: "Indonesia", label: "Indonesia" },
        { value: "Rest Of The World", label: "Rest Of The World" },
      ];
    }
    return list;
  }, [territories]);

  const currencyOptions: SearchableSelectOption[] = useMemo(() => {
    const list = currencies.map((c) => ({
      value: c.id,
      label: `${c.id} - ${c.currency_name || c.id}`,
      sublabel: c.symbol ? `Symbol: ${c.symbol}` : undefined,
    }));
    if (list.length === 0) {
      return [
        { value: "IDR", label: "IDR - Indonesian Rupiah", sublabel: "Rp" },
        { value: "USD", label: "USD - United States Dollar", sublabel: "$" },
        { value: "EUR", label: "EUR - Euro", sublabel: "€" },
        { value: "SGD", label: "SGD - Singapore Dollar", sublabel: "S$" },
      ];
    }
    return list;
  }, [currencies]);

  const priceListOptions: SearchableSelectOption[] = [
    { value: "Standard Selling", label: "Standard Selling" },
    { value: "Distributor Selling", label: "Distributor Selling" },
    { value: "Retail Selling", label: "Retail Selling" },
  ];

  const update = <K extends keyof Customer>(key: K, value: Customer[K]) => {
    setCustomer((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customer.customer_name.trim()) {
      newErrors.customer_name = "Nama customer wajib diisi";
    }

    if (customer.email && customer.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email.trim())) {
        newErrors.email = "Format email tidak valid (contoh: user@perusahaan.com)";
      }
    }

    if (customer.credit_limit < 0) {
      newErrors.credit_limit = "Credit limit tidak boleh negatif";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validate()) {
      toast.error("Silakan lengkapi formulir dengan data yang valid");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await customerApi.create(customer);
        toast.success("Customer berhasil dibuat");
        navigate(`/desk/customer/${created.id || ""}`, { replace: true });
        setCustomer((prev) => ({
          ...prev,
          ...created,
          disabled: Boolean(created.disabled),
          is_default_for_pos: Boolean(created.is_default_for_pos),
        }));
      } else if (id) {
        const updated = await customerApi.update(id, customer);
        toast.success("Customer berhasil diperbarui");
        setCustomer((prev) => ({
          ...prev,
          ...updated,
          disabled: Boolean(updated.disabled),
          is_default_for_pos: Boolean(updated.is_default_for_pos),
        }));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Gagal menyimpan customer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || isNew || !confirm(`Hapus customer "${customer.customer_name}"?`)) return;
    try {
      await customerApi.remove(id);
      toast.success("Customer berhasil dihapus");
      navigate("/desk/customer");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus customer");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Memuat detail Customer...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-4 lg:p-7">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-white p-5 shadow-xs dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/desk/customer")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link to="/desk/selling" className="hover:underline">
                Selling
              </Link>
              <span>/</span>
              <Link to="/desk/customer" className="hover:underline">
                Customer
              </Link>
              <span>/</span>
              <span>{isNew ? "New Customer" : customer.customer_name || id}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {isNew ? "New Customer" : customer.customer_name}
              </h1>
              <Badge variant={isNew ? "secondary" : customer.disabled ? "secondary" : "default"}>
                {isNew ? "Not Saved" : customer.disabled ? "Nonaktif" : "Aktif"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              size="icon"
              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={remove}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            onClick={() => save()}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-2 size-4" />
            {saving ? "Menyimpan..." : "Simpan Customer"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border bg-white shadow-xs dark:bg-slate-900">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="details"
              onClick={() => setActiveTab("details")}
              className="flex items-center gap-2 rounded-none px-5 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              <Building2 className="size-4" />
              Detail Customer
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              onClick={() => setActiveTab("contact")}
              className="flex items-center gap-2 rounded-none px-5 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              <Phone className="size-4" />
              Kontak & Alamat
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              onClick={() => setActiveTab("billing")}
              className="flex items-center gap-2 rounded-none px-5 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              <CreditCard className="size-4" />
              Billing & Akuntansi
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              onClick={() => setActiveTab("settings")}
              className="flex items-center gap-2 rounded-none px-5 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              <FileText className="size-4" />
              Catatan & Status
            </TabsTrigger>
          </TabsList>

          <div className="p-6 lg:p-8">
            {/* TAB 1: DETAILS */}
            {activeTab === "details" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Informasi Dasar Pelanggan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lengkapi identitas, kategori group pelanggan, dan wilayah penjualan (territory).
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Nama Customer"
                  name="customer_name"
                  required
                  error={errors.customer_name}
                  tooltip="Nama resmi perusahaan atau perorangan."
                >
                  <Input
                    placeholder="Contoh: PT Sumber Berkah / Budi Santoso"
                    value={customer.customer_name}
                    onChange={(e) => update("customer_name", e.target.value)}
                    className={errors.customer_name ? "border-red-500" : ""}
                  />
                </Field>

                <Field
                  label="Tipe Customer"
                  name="customer_type"
                  tooltip="Pilih apakah pelanggan bertindak sebagai Perusahaan (Company) atau Perorangan (Individual)."
                >
                  <select
                    className="h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-slate-900"
                    value={customer.customer_type}
                    onChange={(e) => update("customer_type", e.target.value)}
                  >
                    <option value="Company">Company (Perusahaan)</option>
                    <option value="Individual">Individual (Perorangan)</option>
                  </select>
                </Field>

                <Field
                  label="Customer Group"
                  name="customer_group"
                  tooltip="Kelompokkan pelanggan untuk laporan segmentasi dan penentuan harga default."
                >
                  <SearchableSelect
                    value={customer.customer_group}
                    options={customerGroupOptions}
                    onChange={(val) => update("customer_group", val)}
                    placeholder="Pilih Customer Group..."
                    searchPlaceholder="Cari customer group..."
                    addNewLabel="Tambah Customer Group"
                    addNewHref="/desk/customer-group/new"
                  />
                </Field>

                <Field
                  label="Territory"
                  name="territory"
                  tooltip="Wilayah penjualan untuk pemetaan target, distribusi pesanan, atau pelaporan regional."
                >
                  <SearchableSelect
                    value={customer.territory}
                    options={territoryOptions}
                    onChange={(val) => update("territory", val)}
                    placeholder="Pilih Territory..."
                    searchPlaceholder="Cari territory..."
                    addNewLabel="Tambah Territory"
                    addNewHref="/desk/territory/new"
                  />
                </Field>

                <Field
                  label="NPWP / Tax ID"
                  name="tax_id"
                  tooltip="Nomor Pokok Wajib Pajak untuk keperluan penerbitan faktur pajak."
                >
                  <Input
                    placeholder="00.000.000.0-000.000"
                    value={customer.tax_id}
                    onChange={(e) => update("tax_id", e.target.value)}
                  />
                </Field>

                <Field
                  label="Website"
                  name="website"
                  tooltip="Alamat website atau tautan profil perusahaan."
                >
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      className="pl-9"
                      value={customer.website}
                      onChange={(e) => update("website", e.target.value)}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT & ADDRESS */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Kontak dan Alamat Pengiriman/Penagihan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informasi komunikasi langsung untuk pengiriman invoice, konfirmasi pesanan, dan penagihan.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Email Pelanggan"
                  name="email"
                  error={errors.email}
                  tooltip="Alamat email resmi untuk notifikasi faktur dan invoice."
                >
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="customer@perusahaan.com"
                      className={`pl-9 ${errors.email ? "border-red-500" : ""}`}
                      value={customer.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </div>
                </Field>

                <Field
                  label="Nomor Telepon Kantor"
                  name="phone"
                  tooltip="Nomor telepon tetap kantor (PSTN)."
                >
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <Input
                      placeholder="021-xxxxxxxx"
                      className="pl-9"
                      value={customer.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </div>
                </Field>

                <Field
                  label="Nomor HP / WhatsApp"
                  name="mobile_no"
                  tooltip="Nomor seluler penanggung jawab atau bagian procurement."
                >
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <Input
                      placeholder="0812xxxxxxxx"
                      className="pl-9"
                      value={customer.mobile_no}
                      onChange={(e) => update("mobile_no", e.target.value)}
                    />
                  </div>
                </Field>

                <div className="md:col-span-2 lg:col-span-3">
                  <Field
                    label="Alamat Lengkap"
                    name="address"
                    tooltip="Alamat lengkap kantor pusat atau gudang penerimaan barang."
                  >
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 size-4 text-slate-400" />
                      <Textarea
                        rows={3}
                        placeholder="Masukkan nama jalan, gedung, blok, nomor, kota, provinsi, dan kode pos..."
                        className="pl-9"
                        value={customer.address}
                        onChange={(e) => update("address", e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BILLING & ACCOUNTING */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Pengaturan Keuangan dan Penagihan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan mata uang penagihan (Billing Currency), daftar harga jual default, dan limit kredit.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Billing Currency"
                  name="default_currency"
                  tooltip="Mata uang default yang digunakan pada Quotation, Sales Order, dan Sales Invoice untuk customer ini."
                >
                  <SearchableSelect
                    value={customer.default_currency}
                    options={currencyOptions}
                    onChange={(val) => update("default_currency", val)}
                    placeholder="Pilih Mata Uang..."
                    searchPlaceholder="Cari currency (IDR, USD...)..."
                    addNewLabel="Tambah Currency"
                    addNewHref="/desk/currency/new"
                  />
                </Field>

                <Field
                  label="Default Price List"
                  name="default_price_list"
                  tooltip="Daftar harga jual default ketika membuat penawaran atau invoice penjualan."
                >
                  <SearchableSelect
                    value={customer.default_price_list}
                    options={priceListOptions}
                    onChange={(val) => update("default_price_list", val)}
                    placeholder="Pilih Price List..."
                    searchPlaceholder="Cari price list..."
                    addNewLabel="Tambah Price List"
                    addNewHref="/desk/price-list/new"
                  />
                </Field>

                <Field
                  label="Payment Terms (Syarat Pembayaran)"
                  name="payment_terms"
                  tooltip="Contoh: Net 30 Days, Net 14 Days, COD, Pembayaran di muka."
                >
                  <Input
                    placeholder="Contoh: Net 30, COD, Net 14"
                    value={customer.payment_terms}
                    onChange={(e) => update("payment_terms", e.target.value)}
                  />
                </Field>

                <Field
                  label="Credit Limit (Batas Kredit)"
                  name="credit_limit"
                  error={errors.credit_limit}
                  tooltip="Batas maksimal total piutang yang belum terbayar untuk customer ini (0 = tanpa batas)."
                >
                  <Input
                    type="number"
                    min={0}
                    step={100000}
                    placeholder="0"
                    value={customer.credit_limit}
                    onChange={(e) => update("credit_limit", Number(e.target.value))}
                    className={errors.credit_limit ? "border-red-500" : ""}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS & NOTES */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Status dan Catatan Internal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catatan instruksi khusus atau menonaktifkan transaksi pelanggan.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field
                    label="Catatan Khusus / Internal Notes"
                    name="notes"
                    tooltip="Catatan tambahan untuk tim penjualan, finance, atau logistik mengenai customer ini."
                  >
                    <Textarea
                      rows={4}
                      placeholder="Tulis instruksi penagihan khusus, riwayat pertemuan, atau catatan penting..."
                      value={customer.notes}
                      onChange={(e) => update("notes", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 rounded-xl border p-4 bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="customer-pos-default-toggle"
                      checked={customer.is_default_for_pos || false}
                      onChange={(e) => update("is_default_for_pos", e.target.checked)}
                      className="mt-1 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          Is Default for POS Selling (Pelanggan Default Kasir POS)
                        </span>
                        {customer.is_default_for_pos && (
                          <Badge className="bg-blue-600 text-white text-[10px]">Default Aktif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Jika diaktifkan, customer ini akan otomatis terpilih secara default saat membuka kasir Point of Sale (POS) di halaman <code>/desk/point-of-sale</code>. Hanya boleh ada <strong>1 customer</strong> yang bernilai aktif; menetapkan pelanggan ini sebagai default akan otomatis mencabut status default dari pelanggan lain.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="customer-disabled-toggle"
                      checked={customer.disabled}
                      onChange={(e) => update("disabled", e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Nonaktifkan Pelanggan (Disabled)
                      </span>
                      <p className="text-xs text-slate-500">
                        Jika dicentang, pelanggan ini tidak akan muncul pada pilihan transaksi baru seperti Quotation atau Sales Invoice.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="mt-8 flex items-center justify-end gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/desk/customer")}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 size-4" />
              {saving ? "Menyimpan..." : "Simpan Customer"}
            </Button>
          </div>
        </div>
        </Tabs>
      </div>
    </div>
  );
}
