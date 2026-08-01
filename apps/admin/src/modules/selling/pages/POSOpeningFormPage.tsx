import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { posApi, type PaymentBalance } from "../posApi";

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function POSOpeningFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    period_start_date: localDateTime(),
    posting_date: new Date().toISOString().slice(0, 10),
    company: "PT ZENIT TECHNOLOGY SOLUTION",
    pos_profile: "Usaha Jualan Lilin",
    user: "Administrator",
  });
  const [balances, setBalances] = useState<PaymentBalance[]>([
    { mode_of_payment: "Cash", opening_amount: 0 },
    { mode_of_payment: "QRIS", opening_amount: 0 },
  ]);

  useEffect(() => {
    posApi.currentOpening().then(({ data }) => {
      if (data) {
        toast.error("Masih ada opening aktif. Tutup shift lama terlebih dahulu.");
        navigate("/desk/pos-opening-entry", { replace: true });
      }
    });
  }, [navigate]);

  const total = useMemo(() => balances.reduce((sum, row) => sum + Number(row.opening_amount || 0), 0), [balances]);

  const submit = async () => {
    if (!form.company || !form.pos_profile || !form.user) return toast.error("Lengkapi Company, POS Profile, dan Cashier");
    if (balances.some((row) => !row.mode_of_payment)) return toast.error("Mode of Payment tidak boleh kosong");
    setSaving(true);
    try {
      await posApi.createOpening({
        ...form,
        period_start_date: new Date(form.period_start_date).toISOString(),
        posting_date: new Date(`${form.posting_date}T00:00:00`).toISOString(),
        balance_details: balances,
      });
      toast.success("POS Opening Entry berhasil dibuat");
      navigate("/desk/point-of-sale");
    } catch (error: any) { toast.error(error?.message || "Gagal membuat opening"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-full bg-slate-50/60 p-5 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Button variant="outline" size="icon" onClick={() => navigate("/desk/pos-opening-entry")}><ArrowLeft /></Button><div><p className="text-xs font-medium text-slate-500">Not Saved</p><h1 className="text-2xl font-semibold">New POS Opening Entry</h1></div></div>
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Save & Open POS"}</Button>
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm lg:p-7">
          <h2 className="border-b pb-3 font-semibold">Period Details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Period Start Date<input type="datetime-local" value={form.period_start_date} onChange={(e) => setForm({ ...form, period_start_date: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-slate-300" /><span className="block text-xs font-normal text-slate-400">Asia/Jakarta</span></label>
            <label className="space-y-2 text-sm font-medium">Posting Date<input type="date" value={form.posting_date} onChange={(e) => setForm({ ...form, posting_date: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-slate-300" /></label>
            <label className="space-y-2 text-sm font-medium">Company<select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 font-normal"><option>PT ZENIT TECHNOLOGY SOLUTION</option></select></label>
            <label className="space-y-2 text-sm font-medium">POS Profile<select value={form.pos_profile} onChange={(e) => setForm({ ...form, pos_profile: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 font-normal"><option>Usaha Jualan Lilin</option><option>Default POS Profile</option></select></label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">Cashier<select value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 font-normal"><option>Administrator</option><option>Kasir 1</option></select></label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Opening Balance Details</h2><p className="text-sm text-slate-500">Masukkan kas awal per metode pembayaran.</p></div><Button variant="outline" size="sm" onClick={() => setBalances([...balances, { mode_of_payment: "", opening_amount: 0 }])}><Plus /> Add Row</Button></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="w-16 px-5 py-3">No.</th><th className="px-5 py-3">Mode of Payment</th><th className="px-5 py-3">Opening Amount</th><th className="w-16 px-5 py-3" /></tr></thead>
              <tbody className="divide-y">{balances.map((row, index) => <tr key={`${row.mode_of_payment}-${index}`}><td className="px-5 py-3 text-slate-500">{index + 1}</td><td className="px-5 py-3"><select value={row.mode_of_payment} onChange={(e) => setBalances(balances.map((item, i) => i === index ? { ...item, mode_of_payment: e.target.value } : item))} className="h-10 w-full min-w-44 rounded-md border bg-white px-3"><option value="">Pilih metode</option><option>Cash</option><option>QRIS</option><option>Bank Transfer</option><option>Credit Card</option></select></td><td className="px-5 py-3"><div className="flex h-10 min-w-48 items-center rounded-md border px-3"><span className="mr-2 text-slate-400">Rp</span><input type="number" min="0" value={row.opening_amount} onChange={(e) => setBalances(balances.map((item, i) => i === index ? { ...item, opening_amount: Number(e.target.value) } : item))} className="w-full outline-none" /></div></td><td className="px-5 py-3"><Button variant="ghost" size="icon" disabled={balances.length === 1} onClick={() => setBalances(balances.filter((_, i) => i !== index))}><Trash2 className="text-slate-400" /></Button></td></tr>)}</tbody>
              <tfoot><tr className="border-t bg-slate-50"><td colSpan={2} className="px-5 py-4 text-right font-semibold">Total Opening Balance</td><td className="px-5 py-4 text-base font-semibold">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total)}</td><td /></tr></tfoot>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
