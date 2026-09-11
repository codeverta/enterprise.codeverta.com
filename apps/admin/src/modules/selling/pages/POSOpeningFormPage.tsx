import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, Trash2, Save, Store, User, Building2, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompanySelect } from "@/components/CompanySelect";
import { warehouseApi, type CompanyOption } from "@/modules/stock/warehouseApi";
import { posProfileApi, type POSProfile } from "../posProfileApi";
import { posApi, type PaymentBalance, type POSOpeningEntry } from "../posApi";

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export default function POSOpeningFormPage() {
  const params = useParams();
  const id = params.id || params["*"]?.split("/").filter(Boolean)[0];
  const navigate = useNavigate();
  const isNew = !id || id === "new" || id.startsWith("new-pos-opening-entry");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<POSOpeningEntry | null>(null);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [posProfiles, setPOSProfiles] = useState<POSProfile[]>([]);
  const [cashierUsers, setCashierUsers] = useState<string[]>([]);

  const [form, setForm] = useState({
    period_start_date: localDateTime(),
    posting_date: new Date().toISOString().slice(0, 10),
    company: "",
    pos_profile: "",
    user: "Administrator",
  });

  const [balances, setBalances] = useState<PaymentBalance[]>([
    { mode_of_payment: "Cash", opening_amount: 0 },
    { mode_of_payment: "Bank Transfer", opening_amount: 0 },
  ]);

  // Load companies, pos profiles, and active opening
  useEffect(() => {
    const loadMasterData = async () => {
      setLoading(true);
      try {
        const [compList, profilesData, profileOpts] = await Promise.all([
          warehouseApi.listCompanies(),
          posProfileApi.list(),
          posProfileApi.options(),
        ]);

        if (compList && compList.length > 0) setCompanies(compList);
        if (profilesData && profilesData.length > 0) setPOSProfiles(profilesData);
        if (profileOpts?.users) setCashierUsers(profileOpts.users);

        if (!isNew && id) {
          const entry = await posApi.getOpening(id);
          if (entry) {
            setExisting(entry);
            setForm({
              period_start_date: entry.period_start_date
                ? new Date(new Date(entry.period_start_date).getTime() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                : localDateTime(),
              posting_date: entry.posting_date ? entry.posting_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
              company: entry.company,
              pos_profile: entry.pos_profile,
              user: entry.user,
            });
            setBalances(entry.balance_details || []);
          }
        } else {
          const defaultComp = compList?.[0]?.name || "";
          const defaultProfile = profilesData?.[0]?.name || "";
          setForm((prev) => ({
            ...prev,
            company: prev.company || defaultComp,
            pos_profile: prev.pos_profile || defaultProfile,
          }));
          if (profilesData?.[0]?.payments?.length) {
            setBalances(
              profilesData[0].payments.map((p) => ({
                mode_of_payment: p.mode_of_payment,
                opening_amount: 0,
              }))
            );
          }
          // If creating new, check if active opening exists
          const current = await posApi.currentOpening();
          if (current?.data) {
            toast.warning(`Masih ada POS Opening aktif (${current.data.id}). Anda dapat menutupnya di POS Closing Entry.`);
          }
        }
      } catch {
        toast.error("Gagal memuat data master");
      } finally {
        setLoading(false);
      }
    };
    loadMasterData();
  }, [id, isNew]);

  // When POS Profile changes, automatically update Payment Methods from that profile
  const handleSelectPOSProfile = (profileName: string) => {
    setForm((prev) => ({ ...prev, pos_profile: profileName }));
    const match = posProfiles.find((p) => p.name === profileName);
    if (match) {
      if (match.company) {
        setForm((prev) => ({ ...prev, pos_profile: profileName, company: match.company }));
      }
      if (match.payments && match.payments.length > 0) {
        setBalances(
          match.payments.map((p) => ({
            mode_of_payment: p.mode_of_payment,
            opening_amount: 0,
          }))
        );
      }
      if (match.applicable_for_users && match.applicable_for_users.length > 0) {
        const defaultUser = match.applicable_for_users.find((u) => u.default)?.user || match.applicable_for_users[0].user;
        if (defaultUser) {
          setForm((prev) => ({ ...prev, user: defaultUser }));
        }
      }
    }
  };

  const total = useMemo(
    () => balances.reduce((sum, row) => sum + Number(row.opening_amount || 0), 0),
    [balances]
  );

  const isReadonly = !isNew && existing?.status === "Closed";

  const submit = async () => {
    if (!form.company || !form.pos_profile || !form.user) {
      return toast.error("Lengkapi Company, POS Profile, dan Cashier");
    }
    if (balances.some((row) => !row.mode_of_payment)) {
      return toast.error("Mode of Payment tidak boleh kosong");
    }
    setSaving(true);
    try {
      const created = await posApi.createOpening({
        ...form,
        period_start_date: new Date(form.period_start_date).toISOString(),
        posting_date: new Date(`${form.posting_date}T00:00:00`).toISOString(),
        balance_details: balances,
      });
      toast.success("POS Opening Entry berhasil dibuat");
      navigate(`/desk/pos-opening-entry`);
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat opening entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/desk/selling" className="hover:text-blue-600">Selling</Link>
            <span>/</span>
            <Link to="/desk/pos-opening-entry" className="hover:text-blue-600">POS Opening Entry</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {isNew ? "New POS Opening Entry" : existing?.id || id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New POS Opening Entry" : existing?.id || "POS Opening Entry"}
            </h1>
            <Badge variant={existing?.status === "Closed" ? "outline" : "default"}>
              {isNew ? "Not Saved" : existing?.status || "Open"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/desk/pos-opening-entry">
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Link>
          </Button>
          {!isReadonly && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={submit}
              disabled={saving}
            >
              <Save className="mr-2 size-4" />
              {saving ? "Menyimpan..." : "Save & Open POS"}
            </Button>
          )}
        </div>
      </div>

      {/* Period & User Details */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:bg-slate-950">
        <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 border-b pb-2">
          Period Details & User Details
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Period Start Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={form.period_start_date}
              disabled={isReadonly}
              onChange={(e) => setForm({ ...form, period_start_date: e.target.value })}
              className="mt-1 font-mono text-xs"
            />
            <span className="mt-0.5 block text-[10px] text-slate-400">Asia/Jakarta</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Posting Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={form.posting_date}
              disabled={isReadonly}
              onChange={(e) => setForm({ ...form, posting_date: e.target.value })}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Company <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <CompanySelect
                value={form.company}
                disabled={isReadonly}
                onChange={(company) => setForm((current) => ({ ...current, company }))}
                placeholder="Pilih Company..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              POS Profile <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <SearchableSelect
                value={form.pos_profile}
                disabled={isReadonly}
                options={(posProfiles.length > 0
                  ? posProfiles
                  : [{ name: "Usaha Jualan Lilin" }, { name: "Default POS Profile" }]
                ).map((p) => ({
                  value: p.name,
                  label: p.name,
                  sublabel: p.warehouse ? `Warehouse: ${p.warehouse}` : undefined,
                }))}
                onChange={(val) => handleSelectPOSProfile(val)}
                placeholder="Pilih POS Profile..."
                searchPlaceholder="Cari POS Profile..."
                addNewLabel="Buat POS Profile Baru"
                addNewHref="/desk/pos-profile/new"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cashier <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <SearchableSelect
                value={form.user}
                disabled={isReadonly}
                options={(cashierUsers.length > 0
                  ? cashierUsers
                  : ["Administrator", "Kasir 1"]
                ).map((u) => ({
                  value: u,
                  label: u,
                }))}
                onChange={(val) => setForm({ ...form, user: val })}
                placeholder="Pilih Kasir..."
                searchPlaceholder="Cari nama kasir / user..."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Opening Balance Details */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
              Opening Balance Details
            </h3>
            <p className="text-xs text-slate-500">
              Masukkan kas awal fisik per metode pembayaran sebelum memulai shift kasir.
            </p>
          </div>
          {!isReadonly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBalances([...balances, { mode_of_payment: "Cash", opening_amount: 0 }])
              }
            >
              <Plus className="mr-1.5 size-3.5" /> Tambah Baris
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-600 font-semibold dark:bg-slate-900">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">No.</th>
                <th className="py-2.5 px-3 min-w-[200px]">Mode of Payment</th>
                <th className="py-2.5 px-3 min-w-[220px]">Opening Amount</th>
                {!isReadonly && <th className="py-2.5 px-3 w-12 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {balances.map((row, index) => (
                <tr key={index}>
                  <td className="py-2.5 px-3 text-center text-slate-400">{index + 1}</td>
                  <td className="py-2.5 px-3">
                    <select
                      value={row.mode_of_payment}
                      disabled={isReadonly}
                      onChange={(e) =>
                        setBalances(
                          balances.map((item, i) =>
                            i === index ? { ...item, mode_of_payment: e.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded-md border bg-white p-2 text-xs dark:bg-slate-900"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex h-8 items-center rounded-md border px-2.5 bg-white dark:bg-slate-900">
                      <span className="mr-1.5 text-slate-400 font-medium">Rp</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.opening_amount}
                        disabled={isReadonly}
                        onChange={(e) =>
                          setBalances(
                            balances.map((item, i) =>
                              i === index ? { ...item, opening_amount: Number(e.target.value) } : item
                            )
                          )
                        }
                        className="w-full text-xs font-semibold outline-none bg-transparent"
                      />
                    </div>
                  </td>
                  {!isReadonly && (
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-rose-500 hover:bg-rose-50"
                        disabled={balances.length === 1}
                        onClick={() => setBalances(balances.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold dark:bg-slate-900/50">
                <td colSpan={2} className="py-3 px-3 text-right">
                  Total Opening Balance
                </td>
                <td className="py-3 px-3 text-sm font-bold text-blue-600">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(total)}
                </td>
                {!isReadonly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
