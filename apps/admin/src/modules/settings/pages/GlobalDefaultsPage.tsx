import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Globe,
  Save,
  Building2,
  DollarSign,
  Sliders,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
import { Textarea } from "@/components/ui/textarea";

export type GlobalDefaultsData = {
  id?: string;
  default_company?: string;
  country?: string;
  default_distance_unit?: string;
  default_currency?: string;
  hide_currency_symbol?: string;
  disable_rounded_total?: boolean;
  disable_in_words?: boolean;
  use_posting_datetime_for_naming_documents?: boolean;
};

type CommentItem = {
  id: string;
  author: string;
  content: string;
  created_at: string;
};

const initialDefaults: GlobalDefaultsData = {
  default_company: "",
  country: "Indonesia",
  default_distance_unit: "Kilometer",
  default_currency: "IDR",
  hide_currency_symbol: "No",
  disable_rounded_total: false,
  disable_in_words: false,
  use_posting_datetime_for_naming_documents: false,
};

export default function GlobalDefaultsPage() {
  const [form, setForm] = useState<GlobalDefaultsData>(initialDefaults);
  const [originalForm, setOriginalForm] = useState<GlobalDefaultsData>(initialDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Options
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  // Comments
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  const updateField = <K extends keyof GlobalDefaultsData>(
    field: K,
    value: GlobalDefaultsData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Load Global Defaults
  useEffect(() => {
    setLoading(true);
    api
      .get<{ data: GlobalDefaultsData }>("/global-defaults")
      .then(({ data }) => {
        if (data.data) {
          const loaded = {
            ...initialDefaults,
            ...data.data,
            hide_currency_symbol: data.data.hide_currency_symbol || "No",
          };
          setForm(loaded);
          setOriginalForm(loaded);
        }
      })
      .catch((err) => {
        toast.error("Gagal memuat Global Defaults");
      })
      .finally(() => setLoading(false));

    // Load Companies
    api
      .get<{ data: { id: string; name: string }[] }>("/organization/companies")
      .then((res) => setCompanies(res.data?.data || []))
      .catch(() => {});

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
        if (list.length > 0) {
          setCurrencies(list);
        } else {
          setCurrencies(["IDR", "USD", "EUR", "SGD", "GBP", "JPY", "CNY", "AUD"]);
        }
      })
      .catch(() => {
        setCurrencies(["IDR", "USD", "EUR", "SGD", "GBP", "JPY", "CNY", "AUD"]);
      });

    // Load local comments from storage
    try {
      const stored = localStorage.getItem("erp_global_defaults_comments");
      if (stored) {
        setComments(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return companies.map((c) => ({
      value: c.name,
      label: c.name,
      badge: "Company",
    }));
  }, [companies]);

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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/global-defaults", form);
      const updated = data.data || form;
      setForm(updated);
      setOriginalForm(updated);
      toast.success("Global Defaults berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Gagal menyimpan Global Defaults");
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    let authorName = "Administrator";
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      authorName = user.display_name || user.username || user.email || "Administrator";
    } catch {
      authorName = "Administrator";
    }

    const item: CommentItem = {
      id: Date.now().toString(),
      author: authorName,
      content: newComment.trim(),
      created_at: new Date().toLocaleString("id-ID"),
    };

    const next = [item, ...comments];
    setComments(next);
    setNewComment("");
    try {
      localStorage.setItem("erp_global_defaults_comments", JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success("Komentar ditambahkan");
  };

  if (loading) {
    return (
      <ERPPage>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Memuat Global Defaults...</p>
          </div>
        </div>
      </ERPPage>
    );
  }

  return (
    <ERPPage>
      <form onSubmit={handleSave} className="space-y-6">
        <ERPPageHeader
          title="Global Defaults"
          description="Konfigurasi default sistem global untuk seluruh transaksi, penamaan dokumen, dan mata uang."
          breadcrumbs={[
            { label: "Settings", href: "/desk/erpnext-settings" },
            { label: "Global Defaults", href: "/desk/global-defaults" },
            { label: "Global Defaults" },
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

        {/* Form Fields Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pengaturan Default Global</CardTitle>
            <CardDescription>
              Tentukan perusahaan utama, mata uang, dan perilaku transaksi seluruh sistem.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Default Company */}
              <div className="space-y-1.5">
                <Label htmlFor="default_company">Default Company</Label>
                <SearchableSelect
                  value={form.default_company || ""}
                  options={companyOptions}
                  onChange={(val) => updateField("default_company", val)}
                  placeholder="Begin typing for results..."
                  emptyText="Belum ada Company terdaftar"
                />
                <p className="text-xs text-slate-500">
                  Perusahaan utama yang menjadi pilihan default pada transaksi baru.
                </p>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <SearchableSelect
                  value={form.country || "Indonesia"}
                  options={countryOptions}
                  onChange={(val) => updateField("country", val)}
                  placeholder="Begin typing for results..."
                />
                <p className="text-xs text-slate-500">
                  Negara default untuk lokasi, format alamat, dan pajak.
                </p>
              </div>

              {/* Default Distance Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="default_distance_unit">Default Distance Unit</Label>
                <Select
                  value={form.default_distance_unit || "Kilometer"}
                  onValueChange={(val) => updateField("default_distance_unit", val)}
                >
                  <SelectTrigger id="default_distance_unit">
                    <SelectValue placeholder="Pilih Satuan Jarak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kilometer">Kilometer (km)</SelectItem>
                    <SelectItem value="Meter">Meter (m)</SelectItem>
                    <SelectItem value="Mile">Mile (mi)</SelectItem>
                    <SelectItem value="Foot">Foot (ft)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Satuan jarak untuk pengiriman dan logistik.</p>
              </div>

              {/* Default Currency */}
              <div className="space-y-1.5">
                <Label htmlFor="default_currency">Default Currency</Label>
                <SearchableSelect
                  value={form.default_currency || "IDR"}
                  options={currencyOptions}
                  onChange={(val) => updateField("default_currency", val)}
                  placeholder="Begin typing for results..."
                />
                <p className="text-xs text-slate-500">
                  Mata uang dasar sistem untuk laporan dan transaksi umum.
                </p>
              </div>

              {/* Hide Currency Symbol */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="hide_currency_symbol">Hide Currency Symbol</Label>
                <Select
                  value={form.hide_currency_symbol || "No"}
                  onValueChange={(val) => updateField("hide_currency_symbol", val)}
                >
                  <SelectTrigger id="hide_currency_symbol" className="sm:max-w-xs">
                    <SelectValue placeholder="Pilih opsi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Do not show any symbol like $ etc next to currencies.
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t pt-5">
              {/* Disable Rounded Total */}
              <div className="flex items-start justify-between rounded-xl border p-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold">Disable Rounded Total</Label>
                  <p className="text-xs text-slate-500">
                    If disable, &apos;Rounded Total&apos; field will not be visible in any transaction.
                  </p>
                </div>
                <Switch
                  checked={form.disable_rounded_total ?? false}
                  onCheckedChange={(val) => updateField("disable_rounded_total", val)}
                />
              </div>

              {/* Disable In Words */}
              <div className="flex items-start justify-between rounded-xl border p-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold">Disable In Words</Label>
                  <p className="text-xs text-slate-500">
                    If disable, &apos;In Words&apos; field will not be visible in any transaction.
                  </p>
                </div>
                <Switch
                  checked={form.disable_in_words ?? false}
                  onCheckedChange={(val) => updateField("disable_in_words", val)}
                />
              </div>

              {/* Use Posting Datetime for Naming Documents */}
              <div className="flex items-start justify-between rounded-xl border p-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold">
                    Use Posting Datetime for Naming Documents
                  </Label>
                  <p className="text-xs text-slate-500">
                    When checked, the system will use the posting datetime of the document for naming the document instead of the creation datetime of the document.
                  </p>
                </div>
                <Switch
                  checked={form.use_posting_datetime_for_naming_documents ?? false}
                  onCheckedChange={(val) =>
                    updateField("use_posting_datetime_for_naming_documents", val)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="size-4 text-blue-600" />
              Comments
            </CardTitle>
            <CardDescription>
              Catatan atau riwayat perubahan terkait pengaturan global.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Tuliskan komentar atau catatan..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="self-end"
              >
                <Send className="mr-1.5 size-4" />
                Kirim
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              {comments.length === 0 ? (
                <p className="text-xs italic text-slate-400">Belum ada komentar.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-xl border bg-slate-50/50 p-3 text-xs dark:bg-slate-900/50">
                    <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
                      <span>{c.author}</span>
                      <span className="font-normal text-slate-400">{c.created_at}</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </ERPPage>
  );
}
