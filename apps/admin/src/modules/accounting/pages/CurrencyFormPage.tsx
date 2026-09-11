import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { currencyApi, Currency } from "../currencyApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Coins } from "lucide-react";

const NUMBER_FORMAT_OPTIONS = [
  "#,###.##",
  "#.###,##",
  "#,###.###.###,###",
  "###.### ###,###'###.###,",
  "#,###",
  "#,##,###.##",
];

const emptyCurrency: Currency = {
  id: "",
  currency_name: "",
  enabled: true,
  fraction: "Cent",
  fraction_units: 100,
  smallest_currency_fraction_value: 0.01,
  symbol: "$",
  symbol_on_right: false,
  number_format: "#,###.##",
};

export default function CurrencyFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Currency>(emptyCurrency);

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      currencyApi
        .get(id)
        .then((res) => {
          setFormData({
            ...emptyCurrency,
            ...res,
          });
        })
        .catch(() => {
          toast.error("Mata uang tidak ditemukan");
          navigate("/desk/currency");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const updateField = <K extends keyof Currency>(key: K, value: Currency[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id?.trim()) {
      toast.error("Kode Currency (ID) wajib diisi");
      return;
    }
    if (!formData.symbol?.trim()) {
      toast.error("Symbol wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: Currency = {
        ...formData,
        id: formData.id.trim().toUpperCase(),
        currency_name: formData.currency_name?.trim() || formData.id.trim().toUpperCase(),
        fraction_units: Number(formData.fraction_units) || 100,
        smallest_currency_fraction_value: Number(formData.smallest_currency_fraction_value) || 0.01,
      };

      if (isNew) {
        await currencyApi.create(payload);
        toast.success("Currency berhasil dibuat");
        navigate(`/desk/currency/${payload.id}`, { replace: true });
      } else {
        await currencyApi.update(id!, payload);
        toast.success("Currency berhasil diperbarui");
      }
      setFormData(payload);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menyimpan Currency");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm(`Hapus Currency "${id}"?`)) return;
    try {
      await currencyApi.remove(id);
      toast.success(`Currency "${id}" berhasil dihapus`);
      navigate("/desk/currency");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Gagal menghapus Currency");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-xl p-12 text-center text-slate-500">
        Memuat data Currency...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/desk/currency">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Link to="/desk/accounting" className="hover:underline">
                Accounting
              </Link>
              <span>/</span>
              <Link to="/desk/currency" className="hover:underline">
                Currency
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isNew ? "New Currency" : formData.id}
              </h1>
              <Badge variant={isNew ? "secondary" : formData.enabled ? "default" : "outline"}>
                {isNew ? "Not Saved" : formData.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 font-medium text-white hover:bg-blue-700"
          >
            <Save className="mr-1.5 size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Form Content */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4 dark:border-slate-800">
            <Coins className="size-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Currency Details
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Currency Code / ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Currency Code <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                ISO 4217 Currency Code (misal: IDR, USD, EUR)
              </p>
              <Input
                name="currency_id"
                disabled={!isNew}
                value={formData.id}
                onChange={(e) => updateField("id", e.target.value.toUpperCase())}
                placeholder="IDR"
                className="uppercase font-semibold"
                required
              />
            </div>

            {/* Currency Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Currency Name
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                Nama lengkap mata uang (misal: Indonesian Rupiah, US Dollar)
              </p>
              <Input
                name="currency_name"
                value={formData.currency_name}
                onChange={(e) => updateField("currency_name", e.target.value)}
                placeholder="Indonesian Rupiah"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Symbol <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                A symbol for this currency. For e.g. Rp, $, €
              </p>
              <Input
                name="symbol"
                value={formData.symbol}
                onChange={(e) => updateField("symbol", e.target.value)}
                placeholder="Rp"
                required
              />
            </div>

            {/* Fraction */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Fraction
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                Sub-currency. For e.g. &quot;Cent&quot; or &quot;Sen&quot;
              </p>
              <Input
                name="fraction"
                value={formData.fraction}
                onChange={(e) => updateField("fraction", e.target.value)}
                placeholder="Sen"
              />
            </div>

            {/* Fraction Units */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Fraction Units
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                1 Currency = [?] Fraction. For e.g. 1 USD = 100 Cent
              </p>
              <Input
                name="fraction_units"
                type="number"
                value={formData.fraction_units}
                onChange={(e) => updateField("fraction_units", Number(e.target.value))}
                placeholder="100"
              />
            </div>

            {/* Smallest Currency Fraction Value */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Smallest Currency Fraction Value
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                Smallest circulating fraction unit (coin). For e.g. 1 cent for USD and it should be entered as 0.01
              </p>
              <Input
                name="smallest_currency_fraction_value"
                type="number"
                step="any"
                value={formData.smallest_currency_fraction_value}
                onChange={(e) => updateField("smallest_currency_fraction_value", Number(e.target.value))}
                placeholder="0.01"
              />
            </div>

            {/* Number Format */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Number Format
              </label>
              <p className="text-xs text-slate-500 mb-1.5">
                How should this currency be formatted? If not set, will use system defaults
              </p>
              <ERPSelect
                name="number_format"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={formData.number_format || "#,###.##"}
                onChange={(e) => updateField("number_format", e.target.value)}
              >
                {NUMBER_FORMAT_OPTIONS.map((opt) => (
                  <ERPSelectOption key={opt} value={opt}>
                    {opt}
                  </ERPSelectOption>
                ))}
              </ERPSelect>
            </div>

            {/* Checkboxes: Enabled & Symbol on Right */}
            <div className="space-y-4 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={(e) => updateField("enabled", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Enabled
                  </div>
                  <div className="text-xs text-slate-500">
                    Mata uang aktif dan dapat dipilih di transaksi dokumen
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="symbol_on_right"
                  checked={formData.symbol_on_right}
                  onChange={(e) => updateField("symbol_on_right", e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Show Currency Symbol on Right Side
                  </div>
                  <div className="text-xs text-slate-500">
                    Tampilkan simbol di sebelah kanan angka (misal: 100 €)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
