import React, { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ExternalLink, Facebook, KeyRound, Loader2, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { CRMIntegration, crmApi } from "@/lib/crm-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRMPageHeader } from "./shared";
import { BASE_API_URL } from "@/lib/utils";
import { DEFAULT_TENANT_ID } from "@/lib/api";

type ProviderMeta = {
  provider: CRMIntegration["provider"];
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  docs: string;
  configFields: Array<{ key: string; label: string; placeholder: string }>;
  secretFields: Array<{ key: string; label: string; placeholder: string }>;
};

const providers: ProviderMeta[] = [
  { provider: "google_analytics", name: "Google Analytics 4", description: "Kirim event generate_lead dari CRM melalui Measurement Protocol.", icon: BarChart3, color: "bg-amber-50 text-amber-600", docs: "https://developers.google.com/analytics/devguides/collection/protocol/ga4", configFields: [{ key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX" }], secretFields: [{ key: "api_secret", label: "Measurement Protocol API secret", placeholder: "Masukkan secret baru" }] },
  { provider: "meta_ads", name: "Meta Ads", description: "Capture Meta Lead Ads dan kirim event Lead server-side dengan event ID unik.", icon: Facebook, color: "bg-blue-50 text-blue-600", docs: "https://developers.facebook.com/docs/marketing-api/conversions-api/", configFields: [{ key: "pixel_id", label: "Pixel / Dataset ID", placeholder: "1234567890" }, { key: "api_version", label: "Graph API version", placeholder: "v24.0" }], secretFields: [{ key: "access_token", label: "Lead Ads & Conversions access token", placeholder: "Masukkan token baru" }, { key: "app_secret", label: "Meta App Secret", placeholder: "Untuk validasi signature webhook" }, { key: "webhook_verify_token", label: "Webhook verify token", placeholder: "Token buatan Anda" }] },
  { provider: "tiktok_ads", name: "TikTok Ads", description: "Capture lead generation webhook dan kirim SubmitForm melalui Events API.", icon: KeyRound, color: "bg-slate-100 text-slate-800", docs: "https://business-api.tiktok.com/portal/docs/events-api-web/v1.3", configFields: [{ key: "pixel_code", label: "Pixel code", placeholder: "CXXXXXXXXXXXXXXX" }], secretFields: [{ key: "access_token", label: "Events API access token", placeholder: "Masukkan token baru" }, { key: "webhook_secret", label: "Webhook secret", placeholder: "Secret untuk X-CRM-Webhook-Secret" }] },
];

function IntegrationCard({ meta, initial, onSaved }: { meta: ProviderMeta; initial: CRMIntegration; onSaved: (value: CRMIntegration) => void }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [config, setConfig] = useState<Record<string, string>>(initial.config || {});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setEnabled(initial.enabled); setConfig(initial.config || {}); setSecrets({}); }, [initial]);
  const save = async () => {
    setSaving(true);
    try {
      const cleanSecrets = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value.trim()));
      const result = await crmApi.saveIntegration(meta.provider, { enabled, config, secrets: cleanSecrets });
      onSaved(result); setSecrets({}); toast.success(`${meta.name} berhasil disimpan`);
    } catch (error: any) { toast.error(error?.response?.data?.error || `Gagal menyimpan ${meta.name}`); } finally { setSaving(false); }
  };
  const Icon = meta.icon;
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-4 border-b border-slate-100 p-5"><span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${meta.color}`}><Icon className="size-6" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{meta.name}</h2><label className="relative inline-flex cursor-pointer items-center"><input type="checkbox" className="peer sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><span className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5" /></label></div><p className="mt-1 text-sm leading-5 text-slate-500">{meta.description}</p></div></div><div className="flex-1 space-y-4 p-5">{meta.configFields.map((field) => <div key={field.key} className="space-y-2"><Label>{field.label}</Label><Input value={config[field.key] || ""} onChange={(e) => setConfig((current) => ({ ...current, [field.key]: e.target.value }))} placeholder={field.placeholder} /></div>)}{meta.secretFields.map((field) => <div key={field.key} className="space-y-2"><div className="flex justify-between"><Label>{field.label}</Label>{initial.has_secrets && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="size-3.5" />Tersimpan</span>}</div><Input type="password" autoComplete="new-password" value={secrets[field.key] || ""} onChange={(e) => setSecrets((current) => ({ ...current, [field.key]: e.target.value }))} placeholder={initial.has_secrets ? "Kosongkan untuk mempertahankan credential" : field.placeholder} /></div>)}{initial.last_error && <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"><TriangleAlert className="size-4 shrink-0" /><span>{initial.last_error}</span></div>}</div><div className="flex items-center justify-between border-t border-slate-100 p-4"><a href={meta.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600">Dokumentasi resmi <ExternalLink className="size-3.5" /></a><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Simpan</Button></div></article>;
}

export default function CRMIntegrationsPage() {
  const [items, setItems] = useState<CRMIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { crmApi.integrations().then(setItems).catch(() => toast.error("Gagal memuat integrations")).finally(() => setLoading(false)); }, []);
  const update = (value: CRMIntegration) => setItems((current) => current.map((item) => item.provider === value.provider ? value : item));
  const tenant = (() => { try { return JSON.parse(localStorage.getItem("user") || "null")?.tenant_id || DEFAULT_TENANT_ID; } catch { return DEFAULT_TENANT_ID; } })();
  const webhookBase = `${BASE_API_URL}/api/crm/webhooks`;
  return <div className="min-h-screen bg-slate-50"><CRMPageHeader title="Analytics & Ads Integrations" description="Hubungkan lifecycle lead dengan analytics dan platform iklan melalui server-side events." />
    <main className="space-y-6 p-6 lg:p-8">
      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="size-7 animate-spin text-blue-600" /></div> : <section className="grid gap-5 xl:grid-cols-3">{providers.map((meta) => <IntegrationCard key={meta.provider} meta={meta} initial={items.find((item) => item.provider === meta.provider) || { provider: meta.provider, enabled: false, config: {}, has_secrets: false }} onSaved={update} />)}</section>}<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Inbound Lead Ads webhooks</h2><p className="mt-1 text-sm text-slate-500">Daftarkan URL berikut di aplikasi ads. Parameter tenant diperlukan untuk routing data.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-slate-950 p-4 text-slate-200"><p className="text-xs font-semibold text-blue-300">Meta Lead Ads callback URL</p><code className="mt-2 block break-all text-xs">{webhookBase}/meta_ads?tenant_id={tenant}</code></div><div className="rounded-xl bg-slate-950 p-4 text-slate-200"><p className="text-xs font-semibold text-pink-300">TikTok Lead Generation webhook</p><code className="mt-2 block break-all text-xs">{webhookBase}/tiktok_ads?tenant_id={tenant}</code></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Alur sistem yang digunakan</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">1 · Capture</p><p className="mt-2 text-sm text-slate-700">Landing page atau Lead Ads mengirim profil, UTM, GCLID, FBCLID, TTCLID, dan GA client ID.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">2 · CRM</p><p className="mt-2 text-sm text-slate-700">Lead dinilai, diberi source, di-deduplikasi, dan di-assign ke sales.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">3 · Server event</p><p className="mt-2 text-sm text-slate-700">Backend mengirim generate_lead / Lead / SubmitForm dengan event ID unik untuk optimasi iklan.</p></div></div></section></main>
  </div>;
}
