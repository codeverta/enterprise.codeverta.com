import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  ExternalLink,
  Printer,
  Save,
  Trash2,
  XCircle,
  Building2,
  Layers,
  DollarSign,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanySelect } from "@/components/CompanySelect";
import { toast } from "sonner";
import { glEntryApi, type GLEntry, type GLEntryOptions } from "../glEntryApi";

const formatCurrency = (val: number, currency: string = "IDR") => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getVoucherPath = (type: string, no: string) => {
  if (!type || !no) return "#";
  const slug = type.toLowerCase().replace(/\s+/g, "-");
  return `/desk/${slug}/${encodeURIComponent(no)}`;
};

export default function GLEntryFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [options, setOptions] = useState<GLEntryOptions | null>(null);

  const [formData, setFormData] = useState<Partial<GLEntry>>({
    posting_date: new Date().toISOString().split("T")[0],
    fiscal_year: String(new Date().getFullYear()),
    account: "4210.000 - HPP Pembelian - PZTS",
    account_currency: "IDR",
    against: "1141.000 - Persediaan Barang - PZTS",
    voucher_type: "Delivery Note",
    voucher_no: "MAT-DN-2026-00001",
    voucher_subtype: "Delivery Note",
    transaction_currency: "IDR",
    transaction_exchange_rate: 1,
    reporting_currency_exchange_rate: 1,
    debit_in_account_currency: 0,
    debit: 0,
    debit_in_transaction_currency: 0,
    debit_in_reporting_currency: 0,
    credit_in_account_currency: 10000,
    credit: 10000,
    credit_in_transaction_currency: 10000,
    credit_in_reporting_currency: 10000,
    cost_center: "Main - PZTS",
    company: "",
    is_opening: false,
    is_advance: false,
    is_cancelled: true,
    remarks: "On cancellation of MAT-DN-2026-00001",
    comment: "At",
  });

  useEffect(() => {
    glEntryApi
      .getOptions()
      .then((opts) => setOptions(opts))
      .catch(() => {});

    if (!isNew && id) {
      setLoading(true);
      glEntryApi
        .get(id)
        .then((data) => {
          if (data) {
            setFormData({
              ...data,
              posting_date: data.posting_date ? data.posting_date.split("T")[0] : "",
            });
          }
        })
        .catch((err: any) => {
          toast.error(err.response?.data?.error || "Gagal memuat detail GL Entry");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleInputChange = (field: keyof GLEntry, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Synchronize debit/credit across currency representations if changed
      if (field === "debit") {
        const d = Number(value) || 0;
        next.debit_in_account_currency = d;
        next.debit_in_transaction_currency = d * (next.transaction_exchange_rate || 1);
        next.debit_in_reporting_currency = d * (next.reporting_currency_exchange_rate || 1);
      }
      if (field === "credit") {
        const c = Number(value) || 0;
        next.credit_in_account_currency = c;
        next.credit_in_transaction_currency = c * (next.transaction_exchange_rate || 1);
        next.credit_in_reporting_currency = c * (next.reporting_currency_exchange_rate || 1);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const created = await glEntryApi.create(formData);
        toast.success("GL Entry berhasil dibuat");
        navigate(`/desk/gl-entry/${created.id}`);
        setIsEditing(false);
      } else if (id) {
        await glEntryApi.update(id, formData);
        toast.success("GL Entry berhasil diperbarui");
        setIsEditing(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menyimpan GL Entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus GL Entry ini?")) return;
    try {
      await glEntryApi.delete(id);
      toast.success("GL Entry berhasil dihapus");
      navigate("/desk/gl-entry");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal menghapus GL Entry");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center text-slate-500">
          <BookOpen className="mx-auto size-8 animate-pulse text-blue-500" />
          <p className="mt-2 text-sm">Memuat detail GL Entry...</p>
        </div>
      </div>
    );
  }

  const postingDateFormatted = formatDate(formData.posting_date || "");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Link to="/desk/accounting" className="hover:text-blue-600 transition-colors">
              Akuntansi
            </Link>
            <span>/</span>
            <Link to="/desk/gl-entry" className="hover:text-blue-600 transition-colors">
              GL Entry
            </Link>
            <span>/</span>
            <span className="font-mono font-semibold text-slate-800">
              {isNew ? "New GL Entry" : id}
            </span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="text-slate-500 font-normal">GL Entry</span>
              <span className="font-mono text-blue-600">{isNew ? "New" : id}</span>
            </h1>
            {!isNew && (
              <div className="flex items-center gap-1.5">
                {formData.is_cancelled ? (
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs px-2.5 py-0.5">
                    Cancelled
                  </Badge>
                ) : formData.is_opening ? (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-0.5">
                    Opening
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5">
                    Active
                  </Badge>
                )}
                {formData.is_advance && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    Advance
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/desk/gl-entry")}
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
          >
            <ArrowLeft className="size-3.5 mr-1.5" />
            Back to List
          </Button>

          {!isNew && !isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
              >
                <Printer className="size-3.5 mr-1.5" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 shadow-2xs"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Delete
              </Button>
            </>
          )}

          {isEditing && (
            <>
              {!isNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
              >
                <Save className="size-3.5 mr-1.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Dates */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-blue-600" />
            Dates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Posting Date
              </label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.posting_date || ""}
                  onChange={(e) => handleInputChange("posting_date", e.target.value)}
                  className="rounded-xl text-sm border-slate-200"
                  required
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {postingDateFormatted}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                posting_date
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fiscal Year
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.fiscal_year || ""}
                  onChange={(e) => handleInputChange("fiscal_year", e.target.value)}
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/fiscal-year/${formData.fiscal_year}`}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    {formData.fiscal_year}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                fiscal_year
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Account Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="size-4 text-blue-600" />
            Account Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account
              </label>
              {isEditing ? (
                options?.accounts ? (
                  <select
                    value={formData.account || ""}
                    onChange={(e) => handleInputChange("account", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                    required
                  >
                    <option value="">Pilih Akun...</option>
                    {options.accounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    value={formData.account || ""}
                    onChange={(e) => handleInputChange("account", e.target.value)}
                    className="rounded-xl text-sm border-slate-200"
                    required
                  />
                )
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/desk/account/${encodeURIComponent(formData.account || "")}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1.5"
                  >
                    {formData.account}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                account
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Currency
              </label>
              {isEditing ? (
                <select
                  value={formData.account_currency || "IDR"}
                  onChange={(e) => handleInputChange("account_currency", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                >
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                  <option value="EUR">EUR</option>
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/currency/${formData.account_currency || "IDR"}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.account_currency || "IDR"}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                account_currency
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Against
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.against || ""}
                  onChange={(e) => handleInputChange("against", e.target.value)}
                  placeholder="e.g. 1141.000 - Persediaan Barang - PZTS"
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.against || "-"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                against
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Transaction Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            Transaction Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Voucher Type
              </label>
              {isEditing ? (
                options?.voucher_types ? (
                  <select
                    value={formData.voucher_type || "Delivery Note"}
                    onChange={(e) => handleInputChange("voucher_type", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                  >
                    {options.voucher_types.map((vt) => (
                      <option key={vt} value={vt}>
                        {vt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    value={formData.voucher_type || ""}
                    onChange={(e) => handleInputChange("voucher_type", e.target.value)}
                    className="rounded-xl text-sm border-slate-200"
                  />
                )
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/doctype/${encodeURIComponent(formData.voucher_type || "")}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.voucher_type}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                voucher_type
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Voucher No
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.voucher_no || ""}
                  onChange={(e) => handleInputChange("voucher_no", e.target.value)}
                  placeholder="e.g. MAT-DN-2026-00001"
                  className="rounded-xl text-sm border-slate-200 font-mono"
                  required
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100 font-mono">
                  <Link
                    to={getVoucherPath(formData.voucher_type || "", formData.voucher_no || "")}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.voucher_no}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                voucher_no
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Voucher Subtype
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.voucher_subtype || ""}
                  onChange={(e) => handleInputChange("voucher_subtype", e.target.value)}
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.voucher_subtype || "-"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                voucher_subtype
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Currency
              </label>
              {isEditing ? (
                <select
                  value={formData.transaction_currency || "IDR"}
                  onChange={(e) => handleInputChange("transaction_currency", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                >
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                  <option value="EUR">EUR</option>
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/currency/${formData.transaction_currency || "IDR"}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.transaction_currency || "IDR"}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                transaction_currency
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Exchange Rate
              </label>
              {isEditing ? (
                <Input
                  type="number"
                  step="any"
                  value={formData.transaction_exchange_rate ?? 1}
                  onChange={(e) =>
                    handleInputChange("transaction_exchange_rate", parseFloat(e.target.value) || 1)
                  }
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100 font-mono">
                  {formData.transaction_exchange_rate ?? 1}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                transaction_exchange_rate
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reporting Currency Exchange Rate
              </label>
              {isEditing ? (
                <Input
                  type="number"
                  step="any"
                  value={formData.reporting_currency_exchange_rate ?? 1}
                  onChange={(e) =>
                    handleInputChange("reporting_currency_exchange_rate", parseFloat(e.target.value) || 1)
                  }
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100 font-mono">
                  {formData.reporting_currency_exchange_rate ?? 1}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                reporting_currency_exchange_rate
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Amounts */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="size-4 text-blue-600" />
            Amounts
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debit Column */}
            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-blue-100 pb-2">
                Debit Breakdown
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Debit Amount in Account Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.debit_in_account_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("debit_in_account_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.debit_in_account_currency || 0, formData.account_currency)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  debit_in_account_currency
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Debit Amount
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.debit ?? 0}
                    onChange={(e) => handleInputChange("debit", parseFloat(e.target.value) || 0)}
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.debit || 0)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  debit
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Debit Amount in Transaction Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.debit_in_transaction_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("debit_in_transaction_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.debit_in_transaction_currency || 0, formData.transaction_currency)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  debit_in_transaction_currency
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Debit Amount in Reporting Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.debit_in_reporting_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("debit_in_reporting_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.debit_in_reporting_currency || 0)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  debit_in_reporting_currency
                </span>
              </div>
            </div>

            {/* Credit Column */}
            <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider border-b border-indigo-100 pb-2">
                Credit Breakdown
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Amount in Account Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.credit_in_account_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("credit_in_account_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.credit_in_account_currency || 0, formData.account_currency)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  credit_in_account_currency
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Amount
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.credit ?? 0}
                    onChange={(e) => handleInputChange("credit", parseFloat(e.target.value) || 0)}
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.credit || 0)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  credit
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Amount in Transaction Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.credit_in_transaction_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("credit_in_transaction_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.credit_in_transaction_currency || 0, formData.transaction_currency)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  credit_in_transaction_currency
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Amount in Reporting Currency
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={formData.credit_in_reporting_currency ?? 0}
                    onChange={(e) =>
                      handleInputChange("credit_in_reporting_currency", parseFloat(e.target.value) || 0)
                    }
                    className="rounded-xl text-sm border-slate-200 font-mono"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(formData.credit_in_reporting_currency || 0)}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block font-mono">
                  credit_in_reporting_currency
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Dimensions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="size-4 text-blue-600" />
            Dimensions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Center
              </label>
              {isEditing ? (
                options?.cost_centers ? (
                  <select
                    value={formData.cost_center || ""}
                    onChange={(e) => handleInputChange("cost_center", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                  >
                    {options.cost_centers.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    value={formData.cost_center || ""}
                    onChange={(e) => handleInputChange("cost_center", e.target.value)}
                    className="rounded-xl text-sm border-slate-200"
                  />
                )
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/cost-center/${encodeURIComponent(formData.cost_center || "")}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.cost_center || "-"}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                cost_center
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.project || ""}
                  onChange={(e) => handleInputChange("project", e.target.value)}
                  placeholder="Optional Project Code"
                  className="rounded-xl text-sm border-slate-200"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.project ? (
                    <Link
                      to={`/desk/project/${encodeURIComponent(formData.project)}`}
                      className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      {formData.project}
                      <ExternalLink className="size-3 text-slate-400" />
                    </Link>
                  ) : (
                    "-"
                  )}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                project
              </span>
            </div>
          </div>
        </div>

        {/* Section 6: More Info */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Info className="size-4 text-blue-600" />
            More Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company
              </label>
              {isEditing ? (
                <CompanySelect
                  value={formData.company}
                  onChange={(company) => handleInputChange("company", company)}
                  className="[&_button]:h-10 [&_button]:rounded-xl [&_button]:text-sm"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Link
                    to={`/desk/company/${encodeURIComponent(formData.company || "")}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {formData.company || "-"}
                    <ExternalLink className="size-3 text-slate-400" />
                  </Link>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                company
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Is Opening
              </label>
              {isEditing ? (
                <select
                  value={formData.is_opening ? "yes" : "no"}
                  onChange={(e) => handleInputChange("is_opening", e.target.value === "yes")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.is_opening ? "Yes" : "No"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                is_opening
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Is Advance
              </label>
              {isEditing ? (
                <select
                  value={formData.is_advance ? "yes" : "no"}
                  onChange={(e) => handleInputChange("is_advance", e.target.value === "yes")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.is_advance ? "Yes" : "No"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                is_advance
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Is Cancelled
              </label>
              {isEditing ? (
                <select
                  value={formData.is_cancelled ? "yes" : "no"}
                  onChange={(e) => handleInputChange("is_cancelled", e.target.value === "yes")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2 rounded-xl border border-slate-100">
                  {formData.is_cancelled ? (
                    <span className="text-rose-600 font-semibold">Yes</span>
                  ) : (
                    "No"
                  )}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                is_cancelled
              </span>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Remarks
              </label>
              {isEditing ? (
                <textarea
                  value={formData.remarks || ""}
                  onChange={(e) => handleInputChange("remarks", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  {formData.remarks || "-"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                remarks
              </span>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comments
              </label>
              {isEditing ? (
                <textarea
                  value={formData.comment || ""}
                  onChange={(e) => handleInputChange("comment", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-hidden"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900 bg-slate-50/70 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  {formData.comment || "-"}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                comment
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
