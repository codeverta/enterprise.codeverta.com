import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Globe,
  Handshake,
  Percent,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  salesPartnerApi,
  type SalesPartner,
  type SalesPartnerTarget,
  type SalesPartnerOptions,
  type SalesPartnerType,
  type ItemGroupOption,
  type FiscalYearOption,
} from "../salesPartnerApi";

const formatRp = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const emptyTarget = (defaultItemGroup = "Products", defaultFiscalYear = "2026"): SalesPartnerTarget => ({
  item_group: defaultItemGroup,
  fiscal_year: defaultFiscalYear,
  target_qty: 0,
  target_amount: 0,
  distribution_id: "Even",
});

const emptyPartner = (): SalesPartner => ({
  partner_name: "",
  partner_type: "Distributor",
  territory: "All Territories",
  commission_rate: 0,
  show_in_website: false,
  referral_code: "",
  disabled: false,
  targets: [],
});

/* =========================================================================
   LIST PAGE
   ========================================================================= */
export function SalesPartnerListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SalesPartner[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<SalesPartnerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [listResult, typesResult] = await Promise.all([
        salesPartnerApi.list({ q, partner_type: typeFilter || undefined }),
        salesPartnerApi.listPartnerTypes(),
      ]);
      setRows(listResult);
      setPartnerTypes(typesResult);
    } catch {
      toast.error("Gagal memuat data Sales Partner");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [typeFilter]);

  const handleDelete = async (row: SalesPartner) => {
    if (!row.id) return;
    if (!confirm(`Hapus Sales Partner "${row.partner_name}"?`)) return;
    try {
      await salesPartnerApi.remove(row.id);
      toast.success(`Sales Partner "${row.partner_name}" berhasil dihapus`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus sales partner");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-7 space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Sales Partner</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Partner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola mitra penjualan, agen, distributor, reseller, serta rate komisi dan target penjualannya.
          </p>
        </div>

        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/desk/sales-partner/new">
            <Plus className="mr-2 size-4" /> New Sales Partner
          </Link>
        </Button>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Cari partner name, territory, atau referral code..."
            className="h-9 text-xs"
          />
          <Button variant="secondary" size="sm" onClick={load} className="h-9">
            <Search className="mr-1.5 size-3.5" /> Cari
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Partner Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-xs dark:bg-slate-900"
          >
            <option value="">Semua Tipe</option>
            {partnerTypes.map((pt) => (
              <option key={pt.id || pt.partner_type_name} value={pt.partner_type_name}>
                {pt.partner_type_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Sales Partner Name</th>
                <th className="py-3 px-4 min-w-[150px]">Partner Type</th>
                <th className="py-3 px-4 min-w-[150px]">Territory</th>
                <th className="py-3 px-4 w-32 text-right">Commission Rate</th>
                <th className="py-3 px-4 w-28 text-center">Targets</th>
                <th className="py-3 px-4 w-32 text-center">Referral Code</th>
                <th className="py-3 px-4 w-24 text-center">Website</th>
                <th className="py-3 px-4 w-20 text-center">Status</th>
                <th className="py-3 px-4 w-20 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Memuat data Sales Partner...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada Sales Partner yang ditemukan.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50"
                  >
                    <td className="py-3 px-4 font-semibold">
                      <Link
                        to={`/desk/sales-partner/${row.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.partner_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        {row.partner_type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {row.territory || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {row.commission_rate ? `${row.commission_rate}%` : "0%"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.targets && row.targets.length > 0 ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          {row.targets.length} Target
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {row.referral_code ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded dark:bg-slate-800">
                          {row.referral_code}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.show_in_website ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          Tampil
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={row.disabled ? "secondary" : "default"}>
                        {row.disabled ? "Nonaktif" : "Aktif"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild className="size-7">
                          <Link to={`/desk/sales-partner/${row.id}`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleDelete(row)}
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

/* =========================================================================
   FORM PAGE
   ========================================================================= */
export default function SalesPartnerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-sales-partner");

  const [row, setRow] = useState<SalesPartner>(emptyPartner());
  const [partnerTypes, setPartnerTypes] = useState<SalesPartnerType[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroupOption[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearOption[]>([]);
  const [territories, setTerritories] = useState<string[]>(["All Territories", "Indonesia"]);
  const [distributions, setDistributions] = useState<string[]>([
    "Even",
    "Quarterly",
    "Seasonality",
    "H1 Heavy",
    "H2 Heavy",
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [opts, ptList, igList, fyList] = await Promise.all([
          salesPartnerApi.options(),
          salesPartnerApi.listPartnerTypes(),
          salesPartnerApi.listItemGroups(),
          salesPartnerApi.listFiscalYears(),
        ]);

        if (ptList && ptList.length > 0) setPartnerTypes(ptList);
        else if (opts?.partner_types) setPartnerTypes(opts.partner_types);

        if (igList && igList.length > 0) setItemGroups(igList);
        else if (opts?.item_groups) setItemGroups(opts.item_groups);

        if (fyList && fyList.length > 0) setFiscalYears(fyList);
        else if (opts?.fiscal_years) setFiscalYears(opts.fiscal_years);

        if (opts?.territories && opts.territories.length > 0) setTerritories(opts.territories);
        if (opts?.distributions && opts.distributions.length > 0) setDistributions(opts.distributions);

        if (!isNew && id) {
          const loaded = await salesPartnerApi.get(id);
          setRow(loaded);
        } else {
          // If default partner_type not set or empty, set to first available
          if (ptList && ptList.length > 0) {
            setRow((prev) => ({
              ...prev,
              partner_type: prev.partner_type || ptList[0].partner_type_name,
            }));
          }
        }
      } catch {
        toast.error("Gagal memuat opsi Sales Partner");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isNew]);

  const update = <K extends keyof SalesPartner>(key: K, value: SalesPartner[K]) =>
    setRow((prev) => ({ ...prev, [key]: value }));

  const updateTarget = (idx: number, patch: Partial<SalesPartnerTarget>) => {
    const current = row.targets || [];
    const updated = current.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    update("targets", updated);
  };

  const addTarget = () => {
    const current = row.targets || [];
    const defIG = itemGroups.length > 0 ? itemGroups[0].item_group_name : "Products";
    const defFY = fiscalYears.length > 0 ? fiscalYears[0].year_name : "2026";
    update("targets", [...current, emptyTarget(defIG, defFY)]);
  };

  const removeTarget = (idx: number) => {
    const current = row.targets || [];
    update("targets", current.filter((_, i) => i !== idx));
  };

  const totalQty = useMemo(() => {
    return (row.targets || []).reduce((sum, t) => sum + (Number(t.target_qty) || 0), 0);
  }, [row.targets]);

  const totalAmount = useMemo(() => {
    return (row.targets || []).reduce((sum, t) => sum + (Number(t.target_amount) || 0), 0);
  }, [row.targets]);

  const save = async () => {
    if (!row.partner_name.trim()) {
      return toast.error("Sales Partner Name wajib diisi");
    }
    if (!row.partner_type.trim()) {
      return toast.error("Partner Type wajib dipilih");
    }

    setSaving(true);
    try {
      if (!isNew && id) {
        await salesPartnerApi.update(id, row);
        toast.success(`Sales Partner "${row.partner_name}" berhasil diperbarui`);
      } else {
        await salesPartnerApi.create(row);
        toast.success(`Sales Partner "${row.partner_name}" berhasil dibuat`);
      }
      navigate("/desk/sales-partner");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menyimpan Sales Partner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    if (!confirm(`Hapus Sales Partner "${row.partner_name}"?`)) return;
    try {
      await salesPartnerApi.remove(id);
      toast.success("Sales Partner berhasil dihapus");
      navigate("/desk/sales-partner");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Gagal menghapus sales partner");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-7 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">
              Selling
            </Link>
            <span>/</span>
            <Link to="/desk/sales-partner" className="hover:text-blue-600">
              Sales Partner
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New Sales Partner" : row.partner_name}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Sales Partner" : row.partner_name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isNew ? "Not Saved" : row.disabled ? "Status: Nonaktif" : "Status: Aktif"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/desk/sales-partner")}>
            <ArrowLeft className="mr-1.5 size-4" /> Kembali
          </Button>

          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:bg-rose-50"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-4" /> Hapus
            </Button>
          )}

          <Button
            size="sm"
            disabled={saving || loading}
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Details Card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
          Sales Partner Details
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Sales Partner Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sales Partner Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={row.partner_name}
              onChange={(e) => update("partner_name", e.target.value)}
              placeholder="partner_name"
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-slate-400">Nama lengkap mitra atau perusahaan partner.</p>
          </div>

          {/* Partner Type */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Partner Type <span className="text-red-500">*</span>
            </label>
            <select
              value={row.partner_type || ""}
              onChange={(e) => update("partner_type", e.target.value)}
              className="mt-1 w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
            >
              {partnerTypes.map((pt) => (
                <option key={pt.id || pt.partner_type_name} value={pt.partner_type_name}>
                  {pt.partner_type_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Tipe kemitraan (Agent, Channel Partner, Dealer, Distributor, Implementation Partner, Reseller, Retailer).
            </p>
          </div>

          {/* Territory */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Territory
            </label>
            <div className="relative mt-1">
              <Input
                value={row.territory || ""}
                onChange={(e) => update("territory", e.target.value)}
                placeholder="Begin typing for results..."
                className="text-xs"
                list="territory-suggestions"
              />
              <datalist id="territory-suggestions">
                {territories.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Wilayah operasional partner.</p>
          </div>

          {/* Commission Rate */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Commission Rate (%)
            </label>
            <div className="relative mt-1">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={row.commission_rate}
                onChange={(e) => update("commission_rate", parseFloat(e.target.value) || 0)}
                placeholder="commission_rate"
                className="text-xs pr-8"
              />
              <Percent className="absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Persentase komisi standar untuk partner ini.</p>
          </div>
        </div>
      </div>

      {/* Sales Partner Targets Section */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Target className="size-4 text-blue-600" /> Sales Partner Target
            </h3>
            <p className="text-xs text-slate-500">
              Set Item Group-wise budgets on this Sales Partner.
            </p>
          </div>

          <Button size="sm" onClick={addTarget} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1.5 size-3.5" /> Add Row
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">No.</th>
                <th className="py-2.5 px-3 min-w-[180px]">Item Group</th>
                <th className="py-2.5 px-3 w-32">Fiscal Year</th>
                <th className="py-2.5 px-3 w-32 text-right">Target Qty</th>
                <th className="py-2.5 px-3 min-w-[160px] text-right">Target Amount (IDR)</th>
                <th className="py-2.5 px-3 min-w-[160px]">Target Distribution</th>
                <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!row.targets || row.targets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No rows. Klik <b>"+ Add Row"</b> untuk menetapkan target penjualan item group bagi partner ini.
                  </td>
                </tr>
              ) : (
                row.targets.map((t, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.item_group}
                        onChange={(e) => updateTarget(idx, { item_group: e.target.value })}
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {itemGroups.map((g) => (
                          <option key={g.id || g.item_group_name} value={g.item_group_name}>
                            {g.item_group_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.fiscal_year}
                        onChange={(e) => updateTarget(idx, { fiscal_year: e.target.value })}
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {fiscalYears.map((fy) => (
                          <option key={fy.id || fy.year_name} value={fy.year_name}>
                            {fy.year_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <Input
                        type="number"
                        step="any"
                        value={t.target_qty}
                        onChange={(e) =>
                          updateTarget(idx, { target_qty: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-xs text-right"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          step="any"
                          value={t.target_amount}
                          onChange={(e) =>
                            updateTarget(idx, { target_amount: parseFloat(e.target.value) || 0 })
                          }
                          className="h-8 text-xs text-right font-medium"
                        />
                        <div className="text-[10px] text-slate-400 text-right">
                          {formatRp(t.target_amount)}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.distribution_id || "Even"}
                        onChange={(e) =>
                          updateTarget(idx, { distribution_id: e.target.value })
                        }
                        className="w-full rounded border bg-white p-1.5 text-xs dark:bg-slate-900"
                      >
                        {distributions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:bg-rose-50"
                        onClick={() => removeTarget(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {row.targets && row.targets.length > 0 && (
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold dark:bg-slate-900/50">
                  <td colSpan={3} className="py-2.5 px-3 text-right">
                    Total:
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                    {totalQty.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                    {formatRp(totalAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Website & Tracking Section */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
          <Globe className="size-4 text-blue-600" /> Website
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Show In Website */}
          <div className="flex items-center space-x-2 pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={row.show_in_website}
                onCheckedChange={(c) => update("show_in_website", !!c)}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Show In Website
                </span>
                <p className="text-[11px] text-slate-500">
                  Tampilkan profil Sales Partner di portal atau website publik
                </p>
              </div>
            </label>
          </div>

          {/* Referral Code */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Referral Code
            </label>
            <Input
              value={row.referral_code || ""}
              onChange={(e) => update("referral_code", e.target.value)}
              placeholder="Contoh: REF-MITRA-001"
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-slate-400">To Track inbound purchase</p>
          </div>
        </div>

        {/* Status Nonaktif */}
        <div className="pt-3 border-t">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={row.disabled}
              onCheckedChange={(c) => update("disabled", !!c)}
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Nonaktifkan Sales Partner (Disabled)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
