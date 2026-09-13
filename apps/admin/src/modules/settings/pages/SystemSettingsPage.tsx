import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AppWindow,
  Cpu,
  Database,
  FileText,
  Info,
  Key,
  Lock,
  Mail,
  Monitor,
  Save,
  Shield,
  Sliders,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SystemSettingsData = {
  // Details
  country?: string;
  language?: string;
  time_zone?: string;
  currency?: string;
  enable_onboarding?: boolean;
  disable_document_sharing?: boolean;
  date_format?: string;
  time_format?: string;
  number_format?: string;
  use_number_format_from_currency?: boolean;
  first_day_of_the_week?: string;
  float_precision?: number;
  currency_precision?: number;
  rounding_method?: string;
  show_absolute_datetime_in_timeline?: boolean;
  apply_strict_user_permissions?: boolean;
  show_external_link_warning?: string;

  // Login
  session_expiry?: string;
  document_share_key_expiry?: number;
  deny_multiple_sessions?: boolean;
  disable_user_pass_login?: boolean;
  max_signups_allowed_per_hour?: number;
  allow_login_using_mobile_number?: boolean;
  allow_login_using_user_name?: boolean;
  login_with_email_link?: boolean;
  login_with_email_link_expiry?: number;
  rate_limit_email_link_login?: number;
  allow_consecutive_login_attempts?: number;
  allow_login_after_fail?: number;
  enable_two_factor_auth?: boolean;

  // Password
  logout_on_password_reset?: boolean;
  force_user_to_reset_password?: number;
  reset_password_link_expiry_duration?: string;
  password_reset_limit?: number;
  enable_password_policy?: boolean;
  minimum_password_score?: number;

  // Email
  email_footer_address?: string;
  email_retry_limit?: number;
  disable_standard_email_footer?: boolean;
  hide_footer_in_auto_email_reports?: boolean;
  attach_view_link?: boolean;
  store_attached_pdf_document?: boolean;
  welcome_email_template?: string;
  reset_password_template?: string;

  // Files
  max_file_size?: number;
  allow_guests_to_upload_files?: boolean;
  force_web_capture_mode_for_uploads?: boolean;
  strip_exif_metadata_from_uploaded_images?: boolean;
  only_allow_system_managers_to_upload_public_files?: boolean;
  delete_background_exported_reports_after?: number;
  allowed_file_extensions?: string;

  // App
  default_app?: string;

  // Display
  disable_system_update_notification?: boolean;
  disable_change_log_notification?: boolean;
  hide_empty_read_only_fields?: boolean;
  disable_product_suggestion?: boolean;

  // Backups
  backup_limit?: number;
  encrypt_backups?: boolean;

  // Advanced
  max_auto_email_report_per_user?: number;
  max_report_rows?: number;
  dormant_days?: number;
  allow_error_traceback?: boolean;
  enable_telemetry?: boolean;
  link_field_results_limit?: number;
  log_api_requests?: boolean;
};

const defaultSettings: SystemSettingsData = {
  country: "Indonesia",
  language: "English",
  time_zone: "Asia/Jakarta",
  currency: "IDR",
  enable_onboarding: true,
  disable_document_sharing: false,
  date_format: "yyyy-mm-dd",
  time_format: "HH:mm:ss",
  number_format: "#,###.##",
  use_number_format_from_currency: false,
  first_day_of_the_week: "Sunday",
  float_precision: 2,
  currency_precision: 2,
  rounding_method: "Banker's Rounding",
  show_absolute_datetime_in_timeline: false,
  apply_strict_user_permissions: false,
  show_external_link_warning: "Ask",

  session_expiry: "170:00",
  document_share_key_expiry: 30,
  deny_multiple_sessions: false,
  disable_user_pass_login: false,
  max_signups_allowed_per_hour: 300,
  allow_login_using_mobile_number: true,
  allow_login_using_user_name: true,
  login_with_email_link: false,
  login_with_email_link_expiry: 10,
  rate_limit_email_link_login: 0,
  allow_consecutive_login_attempts: 10,
  allow_login_after_fail: 60,
  enable_two_factor_auth: false,

  logout_on_password_reset: true,
  force_user_to_reset_password: 0,
  reset_password_link_expiry_duration: "20m",
  password_reset_limit: 3,
  enable_password_policy: true,
  minimum_password_score: 2,

  email_footer_address: "",
  email_retry_limit: 3,
  disable_standard_email_footer: false,
  hide_footer_in_auto_email_reports: false,
  attach_view_link: true,
  store_attached_pdf_document: false,
  welcome_email_template: "",
  reset_password_template: "",

  max_file_size: 0,
  allow_guests_to_upload_files: false,
  force_web_capture_mode_for_uploads: false,
  strip_exif_metadata_from_uploaded_images: true,
  only_allow_system_managers_to_upload_public_files: false,
  delete_background_exported_reports_after: 48,
  allowed_file_extensions: "CSV\nJPG\nPNG\nPDF\nXLSX\nDOCX",

  default_app: "Desk",

  disable_system_update_notification: false,
  disable_change_log_notification: false,
  hide_empty_read_only_fields: false,
  disable_product_suggestion: false,

  backup_limit: 3,
  encrypt_backups: false,

  max_auto_email_report_per_user: 20,
  max_report_rows: 100000,
  dormant_days: 4,
  allow_error_traceback: true,
  enable_telemetry: false,
  link_field_results_limit: 10,
  log_api_requests: false,
};

// Reusable Field with Info (i) icon and Tooltip
const Field = ({
  label,
  children,
  tooltip,
  required,
}: {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  required?: boolean;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-slate-400 transition-colors hover:text-blue-600 focus:outline-none"
              aria-label={`Info ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    {children}
    {tooltip && <p className="text-xs text-slate-500">{tooltip}</p>}
  </div>
);

// Reusable Toggle Field with Info (i) icon and Tooltip
const ToggleField = ({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  tooltip?: string;
}) => (
  <div className="flex items-start justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
    <div className="space-y-1 pr-4">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-semibold">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-slate-400 transition-colors hover:text-blue-600 focus:outline-none"
                aria-label={`Info ${label}`}
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {tooltip && <p className="text-xs text-slate-500">{tooltip}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default function SystemSettingsPage() {
  const [form, setForm] = useState<SystemSettingsData>(defaultSettings);
  const [originalForm, setOriginalForm] = useState<SystemSettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Options
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string }[]>([]);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  const updateField = <K extends keyof SystemSettingsData>(
    field: K,
    value: SystemSettingsData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setLoading(true);
    // Load System Settings
    api
      .get<{ data: SystemSettingsData }>("/system-settings")
      .then(({ data }) => {
        if (data.data) {
          const merged = { ...defaultSettings, ...data.data };
          setForm(merged);
          setOriginalForm(merged);
        }
      })
      .catch(() => {
        toast.error("Gagal memuat System Settings");
      })
      .finally(() => setLoading(false));

    // Load Countries
    api
      .get<{ data: { code: string; name: string }[] }>("/countries")
      .then((res) => setCountries(res.data?.data || []))
      .catch(() => {});

    // Load Currencies
    api
      .get<{ data: { id: string; enabled: boolean }[] }>("/currencies")
      .then((res) => {
        const list = (res.data?.data || []).map((item) => item.id);
        if (list.length > 0) setCurrencies(list);
        else setCurrencies(["IDR", "USD", "EUR", "SGD", "GBP", "JPY", "CNY", "AUD"]);
      })
      .catch(() => {
        setCurrencies(["IDR", "USD", "EUR", "SGD", "GBP", "JPY", "CNY", "AUD"]);
      });

    // Load Email Templates
    api
      .get<{ data: { id: string; name: string }[] }>("/communication/email-templates")
      .then((res) => setEmailTemplates(res.data?.data || []))
      .catch(() => {});
  }, []);

  const countryOptions: SearchableSelectOption[] = useMemo(() => {
    if (countries.length > 0) {
      return countries.map((c) => ({
        value: c.name,
        label: c.name,
        sublabel: c.code,
      }));
    }
    return ["Indonesia", "Malaysia", "Singapore", "United States", "Australia", "United Kingdom"].map(
      (c) => ({ value: c, label: c })
    );
  }, [countries]);

  const currencyOptions: SearchableSelectOption[] = useMemo(() => {
    return currencies.map((curr) => ({
      value: curr,
      label: curr,
      badge: "Currency",
    }));
  }, [currencies]);

  const emailTemplateOptions: SearchableSelectOption[] = useMemo(() => {
    return emailTemplates.map((t) => ({
      value: t.name,
      label: t.name,
    }));
  }, [emailTemplates]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/system-settings", form);
      const updated = data.data || form;
      setForm((prev) => ({ ...prev, ...updated }));
      setOriginalForm((prev) => ({ ...prev, ...updated }));
      toast.success("System Settings berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Gagal menyimpan System Settings");
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
            <p className="text-sm text-slate-500">Memuat System Settings...</p>
          </div>
        </div>
      </ERPPage>
    );
  }

  return (
    <ERPPage>
      <form onSubmit={handleSave} className="space-y-6">
        <ERPPageHeader
          title="System Settings"
          description="Konfigurasi sistem global ERPNext untuk format penanggalan, otentikasi login, kebijakan keamanan, email, dan integrasi berkas."
          breadcrumbs={[
            { label: "ERPNext Settings", href: "/desk/global-defaults" },
            { label: "System Settings", href: "/desk/system-settings" },
            { label: "System Settings" },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <Badge variant={isDirty ? "destructive" : "secondary"} className="px-2.5 py-1 text-xs">
                {isDirty ? "Not Saved" : "Saved"}
              </Badge>
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
                value="login"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="password"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Password
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Email
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Files
              </TabsTrigger>
              <TabsTrigger
                value="app"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                App
              </TabsTrigger>
              <TabsTrigger
                value="display"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Display
              </TabsTrigger>
              <TabsTrigger
                value="backups"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Backups
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4 py-2 font-medium"
              >
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: DETAILS */}
          {/* ========================================================================= */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Regional & Bahasa</CardTitle>
                <CardDescription>Lokasi, zona waktu, dan mata uang dasar sistem.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label="Country" tooltip="Negara default untuk seluruh sistem.">
                  <SearchableSelect
                    value={form.country || "Indonesia"}
                    options={countryOptions}
                    onChange={(val) => updateField("country", val)}
                    placeholder="Begin typing for results..."
                  />
                </Field>

                <Field label="Language" tooltip="Bahasa default aplikasi.">
                  <Select
                    value={form.language || "English"}
                    onValueChange={(val) => updateField("language", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Bahasa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Indonesian">Bahasa Indonesia</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Time Zone" tooltip="Zona waktu untuk pencatatan transaksi dan waktu server.">
                  <Select
                    value={form.time_zone || "Asia/Jakarta"}
                    onValueChange={(val) => updateField("time_zone", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Zona Waktu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                      <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                      <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Currency" tooltip="Default display currency">
                  <SearchableSelect
                    value={form.currency || "IDR"}
                    options={currencyOptions}
                    onChange={(val) => updateField("currency", val)}
                    placeholder="Begin typing for results..."
                  />
                </Field>

                <div className="sm:col-span-2">
                  <ToggleField
                    label="Enable Onboarding"
                    checked={form.enable_onboarding ?? true}
                    onChange={(val) => updateField("enable_onboarding", val)}
                    tooltip="Tampilkan panduan awal onboarding bagi pengguna baru."
                  />
                </div>

                <div className="sm:col-span-2">
                  <ToggleField
                    label="Disable Document Sharing"
                    checked={form.disable_document_sharing ?? false}
                    onChange={(val) => updateField("disable_document_sharing", val)}
                    tooltip="Nonaktifkan fitur membagikan dokumen ke pihak luar."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Date and Number Format</CardTitle>
                <CardDescription>Format angka, tanggal, dan presisi desimal.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label="Date Format" tooltip="Format tampilan tanggal di seluruh dokumen.">
                  <Select
                    value={form.date_format || "yyyy-mm-dd"}
                    onValueChange={(val) => updateField("date_format", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Format Tanggal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yyyy-mm-dd">yyyy-mm-dd</SelectItem>
                      <SelectItem value="dd-mm-yyyy">dd-mm-yyyy</SelectItem>
                      <SelectItem value="dd/mm/yyyy">dd/mm/yyyy</SelectItem>
                      <SelectItem value="dd.mm.yyyy">dd.mm.yyyy</SelectItem>
                      <SelectItem value="mm/dd/yyyy">mm/dd/yyyy</SelectItem>
                      <SelectItem value="mm-dd-yyyy">mm-dd-yyyy</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Time Format" tooltip="Format tampilan waktu.">
                  <Select
                    value={form.time_format || "HH:mm:ss"}
                    onValueChange={(val) => updateField("time_format", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Format Waktu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HH:mm:ss">HH:mm:ss</SelectItem>
                      <SelectItem value="HH:mm">HH:mm</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Number Format" tooltip="Pemisah ribuan dan desimal.">
                  <Select
                    value={form.number_format || "#,###.##"}
                    onValueChange={(val) => updateField("number_format", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Format Angka" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#,###.##">#,###.## (Contoh: 1,000.00)</SelectItem>
                      <SelectItem value="#.###,##">#.###,## (Contoh: 1.000,00)</SelectItem>
                      <SelectItem value="# ###.##"># ###.## (Contoh: 1 000.00)</SelectItem>
                      <SelectItem value="#'###.##">#&apos;###.## (Contoh: 1&apos;000.00)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="First Day of the Week" tooltip="Hari pertama dalam kalender dan laporan mingguan.">
                  <Select
                    value={form.first_day_of_the_week || "Sunday"}
                    onValueChange={(val) => updateField("first_day_of_the_week", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Hari" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                        (day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Float Precision" tooltip="Jumlah digit desimal untuk angka umum (2-9).">
                  <Select
                    value={String(form.float_precision ?? 2)}
                    onValueChange={(val) => updateField("float_precision", Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Presisi" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Currency Precision"
                  tooltip="If not set, the currency precision will depend on number format"
                >
                  <Select
                    value={String(form.currency_precision ?? 2)}
                    onValueChange={(val) => updateField("currency_precision", Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Presisi Mata Uang" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Rounding Method" tooltip="Metode pembulatan desimal keuangan.">
                  <Select
                    value={form.rounding_method || "Banker's Rounding"}
                    onValueChange={(val) => updateField("rounding_method", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode Pembulatan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banker's Rounding">Banker&apos;s Rounding</SelectItem>
                      <SelectItem value="Commercial Rounding">Commercial Rounding</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="sm:col-span-2 space-y-4 pt-2">
                  <ToggleField
                    label="Use Number Format from Currency"
                    checked={form.use_number_format_from_currency ?? false}
                    onChange={(val) => updateField("use_number_format_from_currency", val)}
                    tooltip="Gunakan format angka spesifik dari mata uang dokumen."
                  />
                  <ToggleField
                    label="Show Absolute Datetime in Timeline"
                    checked={form.show_absolute_datetime_in_timeline ?? false}
                    onChange={(val) => updateField("show_absolute_datetime_in_timeline", val)}
                    tooltip="Tampilkan tanggal dan jam penuh pada timeline aktivitas (bukan '2 jam yang lalu')."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Permissions</CardTitle>
                <CardDescription>Keamanan akses dokumen dan tautan eksternal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleField
                  label="Apply Strict User Permissions"
                  checked={form.apply_strict_user_permissions ?? false}
                  onChange={(val) => updateField("apply_strict_user_permissions", val)}
                  tooltip="If Apply Strict User Permission is checked and User Permission is defined for a DocType for a User, then all the documents where value of the link is blank, will not be shown to that User"
                />

                <Field
                  label="Show External Link Warning"
                  tooltip="Tampilkan peringatan saat membuka tautan yang mengarah ke luar aplikasi."
                >
                  <Select
                    value={form.show_external_link_warning || "Ask"}
                    onValueChange={(val) => updateField("show_external_link_warning", val)}
                  >
                    <SelectTrigger className="sm:max-w-xs">
                      <SelectValue placeholder="Pilih opsi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Never">Never</SelectItem>
                      <SelectItem value="Ask">Ask</SelectItem>
                      <SelectItem value="Always">Always</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: LOGIN */}
          {/* ========================================================================= */}
          <TabsContent value="login" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Sesi & Batasan Login</CardTitle>
                <CardDescription>Durasi sesi, jumlah perangkat aktif, dan batas signup.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Session Expiry (idle timeout)"
                  tooltip="Example: Setting this to 24:00 will log out a user if they are not active for 24:00 hours."
                >
                  <Input
                    value={form.session_expiry || "170:00"}
                    onChange={(e) => updateField("session_expiry", e.target.value)}
                    placeholder="170:00"
                  />
                </Field>

                <Field
                  label="Document Share Key Expiry (in Days)"
                  tooltip="Number of days after which the document Web View link shared on email will be expired"
                >
                  <Input
                    type="number"
                    value={form.document_share_key_expiry ?? 30}
                    onChange={(e) => updateField("document_share_key_expiry", Number(e.target.value))}
                    placeholder="30"
                  />
                </Field>

                <Field label="Max signups allowed per hour" tooltip="Batas pendaftaran akun baru per jam.">
                  <Input
                    type="number"
                    value={form.max_signups_allowed_per_hour ?? 300}
                    onChange={(e) => updateField("max_signups_allowed_per_hour", Number(e.target.value))}
                    placeholder="300"
                  />
                </Field>

                <div className="sm:col-span-2 space-y-4 pt-2">
                  <ToggleField
                    label="Allow only one session per user"
                    checked={form.deny_multiple_sessions ?? false}
                    onChange={(val) => updateField("deny_multiple_sessions", val)}
                    tooltip="Note: Multiple sessions will be allowed in case of mobile device"
                  />
                  <ToggleField
                    label="Disable Username/Password Login"
                    checked={form.disable_user_pass_login ?? false}
                    onChange={(val) => updateField("disable_user_pass_login", val)}
                    tooltip="Make sure to configure a Social Login Key before disabling to prevent lockout"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Login Methods</CardTitle>
                <CardDescription>Metode autentikasi yang diizinkan untuk login pengguna.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleField
                  label="Allow Login using Mobile Number"
                  checked={form.allow_login_using_mobile_number ?? true}
                  onChange={(val) => updateField("allow_login_using_mobile_number", val)}
                  tooltip="User can login using Email id or Mobile number"
                />

                <ToggleField
                  label="Allow Login using User Name"
                  checked={form.allow_login_using_user_name ?? true}
                  onChange={(val) => updateField("allow_login_using_user_name", val)}
                  tooltip="User can login using Email id or User Name"
                />

                <ToggleField
                  label="Login with email link"
                  checked={form.login_with_email_link ?? false}
                  onChange={(val) => updateField("login_with_email_link", val)}
                  tooltip="Allow users to log in without a password, using a login link sent to their email"
                />

                {form.login_with_email_link && (
                  <div className="grid gap-5 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-900">
                    <Field
                      label="Login with email link expiry (in minutes)"
                      tooltip="Masa berlaku link login email dalam menit."
                    >
                      <Input
                        type="number"
                        value={form.login_with_email_link_expiry ?? 10}
                        onChange={(e) => updateField("login_with_email_link_expiry", Number(e.target.value))}
                        placeholder="10"
                      />
                    </Field>

                    <Field
                      label="Rate limit for email link login"
                      tooltip="You can set a high value here if multiple users will be logging in from the same network."
                    >
                      <Input
                        type="number"
                        value={form.rate_limit_email_link_login ?? 0}
                        onChange={(e) => updateField("rate_limit_email_link_login", Number(e.target.value))}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Brute Force Security & 2FA</CardTitle>
                <CardDescription>Perlindungan terhadap serangan tebakan password berulang.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Allow Consecutive Login Attempts"
                  tooltip="Jumlah percobaan gagal sebelum akun terkunci sementara."
                >
                  <Input
                    type="number"
                    value={form.allow_consecutive_login_attempts ?? 10}
                    onChange={(e) => updateField("allow_consecutive_login_attempts", Number(e.target.value))}
                    placeholder="10"
                  />
                </Field>

                <Field
                  label="Allow Login After Fail (In seconds)"
                  tooltip="Durasi penundaan login setelah gagal berulang."
                >
                  <Input
                    type="number"
                    value={form.allow_login_after_fail ?? 60}
                    onChange={(e) => updateField("allow_login_after_fail", Number(e.target.value))}
                    placeholder="60"
                  />
                </Field>

                <div className="sm:col-span-2 pt-2">
                  <ToggleField
                    label="Enable Two Factor Auth (2FA)"
                    checked={form.enable_two_factor_auth ?? false}
                    onChange={(val) => updateField("enable_two_factor_auth", val)}
                    tooltip="Wajibkan autentikasi dua faktor via OTP atau Authenticator App."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: PASSWORD */}
          {/* ========================================================================= */}
          <TabsContent value="password" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Kebijakan Password</CardTitle>
                <CardDescription>Kekuatan sandi, batas reset, dan masa berlaku tautan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ToggleField
                  label="Logout All Sessions on Password Reset"
                  checked={form.logout_on_password_reset ?? true}
                  onChange={(val) => updateField("logout_on_password_reset", val)}
                  tooltip="Keluarkan seluruh sesi aktif di perangkat lain saat password diganti."
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Force User to Reset Password (In Days)"
                    tooltip="0 = Tidak pernah wajib ganti sandi secara periodik."
                  >
                    <Input
                      type="number"
                      value={form.force_user_to_reset_password ?? 0}
                      onChange={(e) => updateField("force_user_to_reset_password", Number(e.target.value))}
                      placeholder="0"
                    />
                  </Field>

                  <Field
                    label="Reset Password Link Expiry Duration"
                    tooltip="Masa berlaku tautan lupa password (contoh: 20m)."
                  >
                    <Input
                      value={form.reset_password_link_expiry_duration || "20m"}
                      onChange={(e) => updateField("reset_password_link_expiry_duration", e.target.value)}
                      placeholder="20m"
                    />
                  </Field>

                  <Field
                    label="Password Reset Link Generation Limit"
                    tooltip="Hourly rate limit for generating password reset links"
                  >
                    <Input
                      type="number"
                      value={form.password_reset_limit ?? 3}
                      onChange={(e) => updateField("password_reset_limit", Number(e.target.value))}
                      placeholder="3"
                    />
                  </Field>
                </div>

                <div className="border-t pt-5">
                  <ToggleField
                    label="Enable Password Policy"
                    checked={form.enable_password_policy ?? true}
                    onChange={(val) => updateField("enable_password_policy", val)}
                    tooltip="If enabled, the password strength will be enforced based on the Minimum Password Score value. A value of 1 being very weak and 4 being very strong."
                  />
                </div>

                {form.enable_password_policy && (
                  <Field
                    label="Minimum Password Score"
                    tooltip="0 - too guessable: risky password. 1 - very guessable: protection from throttled online attacks. 2 - somewhat guessable: protection from unthrottled online attacks. 3 - safely unguessable: moderate protection from offline slow-hash scenario. 4 - very unguessable: strong protection from offline slow-hash scenario."
                  >
                    <Select
                      value={String(form.minimum_password_score ?? 2)}
                      onValueChange={(val) => updateField("minimum_password_score", Number(val))}
                    >
                      <SelectTrigger className="sm:max-w-md">
                        <SelectValue placeholder="Pilih Skor Password" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Too guessable (Risky password)</SelectItem>
                        <SelectItem value="1">1 - Very guessable (Basic online protection)</SelectItem>
                        <SelectItem value="2">2 - Somewhat guessable (Standard protection)</SelectItem>
                        <SelectItem value="3">3 - Safely unguessable (Moderate protection)</SelectItem>
                        <SelectItem value="4">4 - Very unguessable (Strong enterprise security)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: EMAIL */}
          {/* ========================================================================= */}
          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Pengaturan Email Keluar</CardTitle>
                <CardDescription>Footer email, batas pengiriman ulang, dan lampiran PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field
                  label="Email Footer Address"
                  tooltip="Your organization name and address for the email footer."
                >
                  <Textarea
                    rows={3}
                    value={form.email_footer_address || ""}
                    onChange={(e) => updateField("email_footer_address", e.target.value)}
                    placeholder="PT ZENIT TECHNOLOGY SOLUTION, Jl. Kapten Haryadi, Sleman, Yogyakarta"
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email Retry Limit" tooltip="Jumlah percobaan kirim ulang jika email gagal terkirim.">
                    <Input
                      type="number"
                      value={form.email_retry_limit ?? 3}
                      onChange={(e) => updateField("email_retry_limit", Number(e.target.value))}
                      placeholder="3"
                    />
                  </Field>

                  <Field label="Welcome Email Template" tooltip="Template email saat pengguna baru dibuat.">
                    <SearchableSelect
                      value={form.welcome_email_template || ""}
                      options={emailTemplateOptions}
                      onChange={(val) => updateField("welcome_email_template", val)}
                      placeholder="Begin typing for results..."
                    />
                  </Field>

                  <Field label="Reset Password Template" tooltip="Template email saat melakukan reset password.">
                    <SearchableSelect
                      value={form.reset_password_template || ""}
                      options={emailTemplateOptions}
                      onChange={(val) => updateField("reset_password_template", val)}
                      placeholder="Begin typing for results..."
                    />
                  </Field>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <ToggleField
                    label="Disable Standard Email Footer"
                    checked={form.disable_standard_email_footer ?? false}
                    onChange={(val) => updateField("disable_standard_email_footer", val)}
                    tooltip="Sembunyikan teks footer standar 'Sent via Codeverta ERP'."
                  />

                  <ToggleField
                    label="Hide footer in auto email reports"
                    checked={form.hide_footer_in_auto_email_reports ?? false}
                    onChange={(val) => updateField("hide_footer_in_auto_email_reports", val)}
                    tooltip="Jangan sertakan footer pada pengiriman laporan terjadwal otomatis."
                  />

                  <ToggleField
                    label="Include Web View Link in Email"
                    checked={form.attach_view_link ?? true}
                    onChange={(val) => updateField("attach_view_link", val)}
                    tooltip="Sertakan tautan web view pada notifikasi email dokumen."
                  />

                  <ToggleField
                    label="Store Attached PDF Document"
                    checked={form.store_attached_pdf_document ?? false}
                    onChange={(val) => updateField("store_attached_pdf_document", val)}
                    tooltip="When sending document using email, store the PDF on Communication. Warning: This can increase your storage usage."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 5: FILES */}
          {/* ========================================================================= */}
          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Pengaturan File & Media</CardTitle>
                <CardDescription>Batas ukuran unggahan, ekstensi file, dan pembersihan otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Max File Size (MB)"
                    tooltip="0 = Gunakan batas default sistem (50 MB)."
                  >
                    <Input
                      type="number"
                      value={form.max_file_size ?? 0}
                      onChange={(e) => updateField("max_file_size", Number(e.target.value))}
                      placeholder="0"
                    />
                  </Field>

                  <Field
                    label="Delete Background Exported Reports After (Hours)"
                    tooltip="Defines how long exported reports sent via email are kept in the system. Older files will be automatically deleted."
                  >
                    <Input
                      type="number"
                      value={form.delete_background_exported_reports_after ?? 48}
                      onChange={(e) =>
                        updateField("delete_background_exported_reports_after", Number(e.target.value))
                      }
                      placeholder="48"
                    />
                  </Field>
                </div>

                <Field
                  label="Allowed File Extensions"
                  tooltip="Provide a list of allowed file extensions for file uploads. Each line should contain one allowed file type. If unset, all file extensions are allowed. Example: CSV, JPG, PNG"
                >
                  <Textarea
                    rows={4}
                    value={form.allowed_file_extensions || ""}
                    onChange={(e) => updateField("allowed_file_extensions", e.target.value)}
                    placeholder="CSV&#10;JPG&#10;PNG&#10;PDF"
                  />
                </Field>

                <div className="space-y-4 border-t pt-4">
                  <ToggleField
                    label="Allow Guests to Upload Files"
                    checked={form.allow_guests_to_upload_files ?? false}
                    onChange={(val) => updateField("allow_guests_to_upload_files", val)}
                    tooltip="When enabled this will allow guests to upload files to your application, You can enable this if you wish to collect files from user without having them to log in, for example in job applications web form."
                  />

                  <ToggleField
                    label="Force Web Capture Mode for Uploads"
                    checked={form.force_web_capture_mode_for_uploads ?? false}
                    onChange={(val) => updateField("force_web_capture_mode_for_uploads", val)}
                    tooltip="When uploading files, force the use of the web-based image capture. If this is unchecked, the default behavior is to use the mobile native camera when use from a mobile is detected."
                  />

                  <ToggleField
                    label="Strip EXIF tags from uploaded images"
                    checked={form.strip_exif_metadata_from_uploaded_images ?? true}
                    onChange={(val) => updateField("strip_exif_metadata_from_uploaded_images", val)}
                    tooltip="Hapus data lokasi GPS dan metadata kamera dari foto yang diunggah untuk privasi."
                  />

                  <ToggleField
                    label="Only allow System Managers to upload public files"
                    checked={form.only_allow_system_managers_to_upload_public_files ?? false}
                    onChange={(val) =>
                      updateField("only_allow_system_managers_to_upload_public_files", val)
                    }
                    tooltip="If enabled, only System Managers can upload public files. Other users can't see the checkbox Is Private in the upload dialog."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 6: APP */}
          {/* ========================================================================= */}
          <TabsContent value="app" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Aplikasi Tujuan Utama</CardTitle>
                <CardDescription>Aplikasi tujuan pengalihan setelah pengguna berhasil login.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Default App"
                  tooltip="Redirect to the selected app after login"
                >
                  <Select
                    value={form.default_app || "Desk"}
                    onValueChange={(val) => updateField("default_app", val)}
                  >
                    <SelectTrigger className="sm:max-w-md">
                      <SelectValue placeholder="Pilih Default App" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Desk">Desk (Workspace Dashboard)</SelectItem>
                      <SelectItem value="Selling">Selling</SelectItem>
                      <SelectItem value="Buying">Buying</SelectItem>
                      <SelectItem value="Stock">Stock & Inventory</SelectItem>
                      <SelectItem value="Accounting">Accounting</SelectItem>
                      <SelectItem value="HR">HR & Payroll</SelectItem>
                      <SelectItem value="CRM">CRM</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 7: DISPLAY */}
          {/* ========================================================================= */}
          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Pengaturan Tampilan Antarmuka</CardTitle>
                <CardDescription>Notifikasi versi, changelog, dan penyembunyian field kosong.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleField
                  label="Disable System Update Notification"
                  checked={form.disable_system_update_notification ?? false}
                  onChange={(val) => updateField("disable_system_update_notification", val)}
                  tooltip="Jangan tampilkan banner pemberitahuan pembaruan versi baru."
                />

                <ToggleField
                  label="Disable Change Log Notification"
                  checked={form.disable_change_log_notification ?? false}
                  onChange={(val) => updateField("disable_change_log_notification", val)}
                  tooltip="Jangan tampilkan pop-up rilis catatan perubahan sistem."
                />

                <ToggleField
                  label="Hide Empty Read-Only Fields"
                  checked={form.hide_empty_read_only_fields ?? false}
                  onChange={(val) => updateField("hide_empty_read_only_fields", val)}
                  tooltip="Sembunyikan kolom read-only yang tidak berisi data agar tampilan formulir lebih ringkas."
                />

                <ToggleField
                  label="Disable Product Suggestion"
                  checked={form.disable_product_suggestion ?? false}
                  onChange={(val) => updateField("disable_product_suggestion", val)}
                  tooltip="Nonaktifkan saran produk dan ekstensi fitur di dalam menu."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 8: BACKUPS */}
          {/* ========================================================================= */}
          <TabsContent value="backups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Cadangan Data (Backups)</CardTitle>
                <CardDescription>Retensi cadangan database dan enkripsi arsip.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Number of Backups"
                  tooltip="Older backups will be automatically deleted"
                >
                  <Input
                    type="number"
                    value={form.backup_limit ?? 3}
                    onChange={(e) => updateField("backup_limit", Number(e.target.value))}
                    placeholder="3"
                    className="sm:max-w-xs"
                  />
                </Field>

                <ToggleField
                  label="Encrypt Backups"
                  checked={form.encrypt_backups ?? false}
                  onChange={(val) => updateField("encrypt_backups", val)}
                  tooltip="Enkripsi file cadangan database dengan kunci rahasia server."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 9: ADVANCED */}
          {/* ========================================================================= */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Reports & Batas Baris</CardTitle>
                <CardDescription>Batas baris query laporan dan pengiriman otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Max auto email report per user"
                  tooltip="Batas pengiriman laporan otomatis via email untuk tiap user."
                >
                  <Input
                    type="number"
                    value={form.max_auto_email_report_per_user ?? 20}
                    onChange={(e) =>
                      updateField("max_auto_email_report_per_user", Number(e.target.value))
                    }
                    placeholder="20"
                  />
                </Field>

                <Field
                  label="Max Report Rows"
                  tooltip="This value specifies the max number of rows that can be rendered in report view."
                >
                  <Input
                    type="number"
                    value={form.max_report_rows ?? 100000}
                    onChange={(e) => updateField("max_report_rows", Number(e.target.value))}
                    placeholder="100000"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Background Workers & Scheduler</CardTitle>
                <CardDescription>Penjadwalan antrean background worker pada situs yang tidak aktif.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Run Jobs only Daily if Inactive For (Days)"
                  tooltip="Will run scheduled jobs only once a day for inactive sites. Set it to 0 to avoid automatically disabling the scheduler."
                >
                  <Input
                    type="number"
                    value={form.dormant_days ?? 4}
                    onChange={(e) => updateField("dormant_days", Number(e.target.value))}
                    placeholder="4"
                    className="sm:max-w-xs"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Telemetry & Developer Tools</CardTitle>
                <CardDescription>Pencatatan traceback error dan pengiriman telemetri sistem.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleField
                  label="Show Full Error and Allow Reporting of Issues to the Developer"
                  checked={form.allow_error_traceback ?? true}
                  onChange={(val) => updateField("allow_error_traceback", val)}
                  tooltip="Tampilkan pesan stack trace saat terjadi kesalahan untuk mempermudah perbaikan."
                />

                <ToggleField
                  label="Allow Sending Usage Data for Improving Applications"
                  checked={form.enable_telemetry ?? false}
                  onChange={(val) => updateField("enable_telemetry", val)}
                  tooltip="Izinkan pengiriman data diagnostik anonim untuk peningkatan kualitas sistem."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Search & API Logging</CardTitle>
                <CardDescription>Batas hasil pencarian relasi dan pencatatan log permintaan API.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Link Field Results Limit"
                  tooltip="Batas jumlah hasil yang muncul pada dropdown pencarian link field."
                >
                  <Input
                    type="number"
                    value={form.link_field_results_limit ?? 10}
                    onChange={(e) => updateField("link_field_results_limit", Number(e.target.value))}
                    placeholder="10"
                    className="sm:max-w-xs"
                  />
                </Field>

                <ToggleField
                  label="Log API Requests"
                  checked={form.log_api_requests ?? false}
                  onChange={(val) => updateField("log_api_requests", val)}
                  tooltip="Catat riwayat panggilan HTTP REST API pada log sistem."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </ERPPage>
  );
}
