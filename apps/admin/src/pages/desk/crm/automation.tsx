import React, { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Code2, Loader2, RotateCcw, Save, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import api, { DEFAULT_TENANT_ID } from "@/lib/api";
import { BASE_API_URL } from "@/lib/utils";
import { CRMAutomation, crmApi } from "@/lib/crm-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CRMPageHeader } from "./shared";

type UserOption = { id: string; display_name?: string; username?: string; email?: string; role?: number };
const defaults: CRMAutomation = { assignment_method: "round_robin", sales_rep_ids: [], territory_rules: {}, product_rules: {}, scoring_rules: {}, capture_enabled: true };
const defaultScores: Record<string, number> = { email: 20, phone: 15, company: 10, product: 10, tracking: 10, "source:referral": 25, "source:event": 20, "source:meta_ads": 15, "source:tiktok_ads": 15, "source:google_ads": 15, "source:organic": 10, "source:website": 10, "source:cold_call": 5 };

const rulesToText = (rules: Record<string, string> | null | undefined) => Object.entries(rules || {}).map(([key, value]) => `${key}=${value}`).join("\n");
const textToRules = (text: string) => text.split("\n").reduce<Record<string, string>>((result, row) => { const [key, value] = row.split("=").map((part) => part.trim()); if (key && value) result[key] = value; return result; }, {});

export default function CRMAutomationPage() {
  const [config, setConfig] = useState<CRMAutomation>(defaults);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [territoryText, setTerritoryText] = useState("");
  const [productText, setProductText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    Promise.all([crmApi.automation(), api.get("/users", { params: { page: 1, limit: 100 } })]).then(([automation, userResponse]) => {
      const normalized = { ...defaults, ...automation, sales_rep_ids: automation.sales_rep_ids || [], territory_rules: automation.territory_rules || {}, product_rules: automation.product_rules || {}, scoring_rules: automation.scoring_rules || {} };
      setConfig(normalized); setTerritoryText(rulesToText(normalized.territory_rules)); setProductText(rulesToText(normalized.product_rules)); setUsers(userResponse.data?.data || []);
    }).catch(() => toast.error("Gagal memuat konfigurasi automation")).finally(() => setLoading(false));
  }, []);
  const reps = config.sales_rep_ids || [];
  const scores = useMemo(() => ({ ...defaultScores, ...(config.scoring_rules || {}) }), [config.scoring_rules]);
  const toggleRep = (id: string) => setConfig((current) => ({ ...current, sales_rep_ids: reps.includes(id) ? reps.filter((value) => value !== id) : [...reps, id] }));
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...config, territory_rules: textToRules(territoryText), product_rules: textToRules(productText), scoring_rules: scores };
      await crmApi.saveAutomation(payload); setConfig(payload); toast.success("Automation lead berhasil disimpan");
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menyimpan automation"); } finally { setSaving(false); }
  };
  const tenant = (() => { try { return JSON.parse(localStorage.getItem("user") || "null")?.tenant_id || DEFAULT_TENANT_ID; } catch { return DEFAULT_TENANT_ID; } })();
  const endpoint = `${BASE_API_URL}/api/crm/capture`;
  const snippet = `fetch("${endpoint}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "X-Tenant-ID": "${tenant}"\n  },\n  body: JSON.stringify({\n    name, email, phone, source: "website",\n    utm_source, utm_medium, utm_campaign,\n    gclid, fbclid, ttclid, analytics_client_id\n  })\n});`;
  const copySnippet = async () => { await navigator.clipboard.writeText(snippet); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="size-7 animate-spin text-blue-600" /></div>;
  return <div className="min-h-screen bg-slate-50"><CRMPageHeader title="Lead Automation" description="Atur scoring, routing sales, dan capture form tanpa mengubah kode workflow." actions={<Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Simpan automation</Button>} />
    <main className="grid gap-6 p-6 lg:p-8 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UsersRound className="size-5" /></span><div><h2 className="font-bold text-slate-900">Auto-assignment</h2><p className="mt-1 text-sm text-slate-500">Tentukan cara lead baru dibagikan ke sales rep.</p></div></div><div className="mt-6 space-y-5"><div className="space-y-2"><Label>Metode assignment</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={config.assignment_method} onChange={(e) => setConfig((current) => ({ ...current, assignment_method: e.target.value as CRMAutomation["assignment_method"] }))}><option value="round_robin">Round robin</option><option value="territory">Berdasarkan wilayah</option><option value="product">Berdasarkan produk</option><option value="manual">Manual</option></select></div><div><Label>Sales rep aktif</Label><div className="mt-2 grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">{users.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50"><input type="checkbox" checked={reps.includes(user.id)} onChange={() => toggleRep(user.id)} className="size-4 rounded border-slate-300" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{user.display_name || user.username || user.email}</span><span className="block truncate text-xs text-slate-400">{user.email}</span></span></label>)}</div></div>{config.assignment_method === "territory" && <div className="space-y-2"><Label>Mapping wilayah</Label><Textarea rows={5} value={territoryText} onChange={(e) => setTerritoryText(e.target.value)} placeholder={`jakarta=${users[0]?.id || "USER_UUID"}\nbandung=USER_UUID`} /><p className="text-xs text-slate-500">Satu aturan per baris: wilayah=UUID sales rep. Jika tidak cocok, sistem fallback ke round robin.</p></div>}{config.assignment_method === "product" && <div className="space-y-2"><Label>Mapping produk</Label><Textarea rows={5} value={productText} onChange={(e) => setProductText(e.target.value)} placeholder={`erp enterprise=${users[0]?.id || "USER_UUID"}\nconsulting=USER_UUID`} /><p className="text-xs text-slate-500">Satu aturan per baris: produk=UUID sales rep.</p></div>}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Sparkles className="size-5" /></span><div><h2 className="font-bold text-slate-900">Lead scoring</h2><p className="mt-1 text-sm text-slate-500">Bobot dijumlahkan otomatis hingga maksimal 100.</p></div></div><Button variant="ghost" size="sm" onClick={() => setConfig((current) => ({ ...current, scoring_rules: { ...defaultScores } }))}><RotateCcw />Reset</Button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{Object.entries(scores).map(([key, value]) => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"><span className="truncate text-sm capitalize text-slate-600">{key.replace("source:", "Source · ").replaceAll("_", " ")}</span><Input type="number" min={0} max={100} className="w-20" value={value} onChange={(e) => setConfig((current) => ({ ...current, scoring_rules: { ...scores, [key]: Number(e.target.value) } }))} /></label>)}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm xl:col-span-2"><div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-xl"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Code2 className="size-5" /></span><div><h2 className="font-bold">Website & landing page capture</h2><p className="mt-1 text-sm text-slate-400">POST form ke endpoint publik berikut. Sertakan UTM dan click ID agar atribusi iklan tidak hilang.</p></div></div><label className="mt-5 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={config.capture_enabled} onChange={(e) => setConfig((current) => ({ ...current, capture_enabled: e.target.checked }))} className="size-4" />Aktifkan public lead capture</label></div><Button variant="secondary" onClick={copySnippet}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy snippet"}</Button></div><pre className="mt-6 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-sky-200"><code>{snippet}</code></pre></section>
    </main>
  </div>;
}

