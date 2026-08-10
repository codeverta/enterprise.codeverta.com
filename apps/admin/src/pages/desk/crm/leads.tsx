import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import { CRMLead, crmApi, LeadStatus } from "@/lib/crm-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CRMPageHeader, emptyLead, leadStatuses, ScoreBadge, StatusBadge } from "./shared";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";

const sources = ["website", "organic", "google_ads", "meta_ads", "tiktok_ads", "referral", "event", "cold_call", "csv_import"];

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}

function LeadForm({ open, lead, onClose, onSaved }: { open: boolean; lead: CRMLead | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<CRMLead>>(emptyLead);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(lead ? { ...lead } : { ...emptyLead }), [lead, open]);
  const set = (name: keyof CRMLead, value: string) => setForm((current) => ({ ...current, [name]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (lead) await crmApi.updateLead(lead.id, form);
      else await crmApi.createLead(form);
      toast.success(lead ? "Lead berhasil diperbarui" : "Lead baru berhasil ditambahkan");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan lead");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{lead ? "Edit lead" : "Tambah lead"}</DialogTitle><DialogDescription>Skor dihitung otomatis dari kelengkapan profil, sumber, dan atribut tracking.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap"><Input required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Nama prospek" /></Field>
            <Field label="Perusahaan"><Input value={form.company_name || ""} onChange={(e) => set("company_name", e.target.value)} placeholder="PT Contoh Indonesia" /></Field>
            <Field label="Email"><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="nama@perusahaan.com" /></Field>
            <Field label="Nomor telepon"><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+62 812..." /></Field>
            <Field label="Sumber lead"><ERPSelect className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.source || "website"} onChange={(e) => set("source", e.target.value)}>{sources.map((source) => <ERPSelectOption key={source} value={source}>{source.replaceAll("_", " ")}</ERPSelectOption>)}</ERPSelect></Field>
            <Field label="Detail sumber"><Input value={form.source_detail || ""} onChange={(e) => set("source_detail", e.target.value)} placeholder="Nama form, event, atau campaign" /></Field>
            <Field label="Wilayah"><Input value={form.region || ""} onChange={(e) => set("region", e.target.value)} placeholder="Jakarta" /></Field>
            <Field label="Produk diminati"><Input value={form.product_interest || ""} onChange={(e) => set("product_interest", e.target.value)} placeholder="ERP Enterprise" /></Field>
            <Field label="Status"><ERPSelect className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.status || "new"} onChange={(e) => set("status", e.target.value)}>{leadStatuses.map((status) => <ERPSelectOption key={status.value} value={status.value}>{status.label}</ERPSelectOption>)}</ERPSelect></Field>
            <Field label="UTM campaign"><Input value={form.utm_campaign || ""} onChange={(e) => set("utm_campaign", e.target.value)} placeholder="ramadan_2026" /></Field>
            <Field label="UTM source"><Input value={form.utm_source || ""} onChange={(e) => set("utm_source", e.target.value)} placeholder="google / facebook / tiktok" /></Field>
            <Field label="UTM medium"><Input value={form.utm_medium || ""} onChange={(e) => set("utm_medium", e.target.value)} placeholder="cpc / social / referral" /></Field>
            <Field label="GCLID"><Input value={form.gclid || ""} onChange={(e) => set("gclid", e.target.value)} /></Field>
            <Field label="FBCLID"><Input value={form.fbclid || ""} onChange={(e) => set("fbclid", e.target.value)} /></Field>
            <Field label="TTCLID"><Input value={form.ttclid || ""} onChange={(e) => set("ttclid", e.target.value)} /></Field>
            <Field label="Google Analytics client ID"><Input value={form.analytics_client_id || ""} onChange={(e) => set("analytics_client_id", e.target.value)} placeholder="123456.789012" /></Field>
            <Field label="Catatan" className="sm:col-span-2"><Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Konteks kebutuhan dan hasil komunikasi awal..." /></Field>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{lead ? "Simpan perubahan" : "Tambah lead"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const downloadTemplate = () => {
    const csv = "name,email,phone,company_name,source,source_detail,region,product_interest,utm_source,utm_medium,utm_campaign,gclid,fbclid,ttclid,notes\nBudi,budi@example.com,+628123456789,PT Contoh,referral,Partner A,Jakarta,ERP Enterprise,,,,,,Prospek prioritas\n";
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "crm-lead-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  };
  const submit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await crmApi.importLeads(file);
      toast.success(`${result.created} lead berhasil diimpor${result.failed ? `, ${result.failed} gagal` : ""}`);
      onImported(); onClose(); setFile(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Import CSV gagal");
    } finally { setUploading(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Import leads dari CSV</DialogTitle><DialogDescription>Maksimum 10 MB. Kolom wajib hanya <code>name</code>; scoring dan assignment dijalankan otomatis.</DialogDescription></DialogHeader><div className="space-y-4"><button type="button" onClick={downloadTemplate} className="flex w-full items-center justify-between rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-left text-sm text-blue-700"><span><strong>Download template CSV</strong><br /><span className="text-blue-600">Format siap diisi dan diunggah kembali.</span></span><Download className="size-5" /></button><Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div><DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={!file || uploading}>{uploading ? <Loader2 className="animate-spin" /> : <FileUp />}Import CSV</Button></DialogFooter></DialogContent></Dialog>;
}

export default function CRMLeadsPage() {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [meta, setMeta] = useState({ page: 1, page_size: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CRMLead | null>(null);
  const requestRef = useRef(0);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query), 300); return () => window.clearTimeout(timer); }, [query]);
  const load = async (page = meta.page) => {
    const request = ++requestRef.current; setLoading(true);
    try { const result = await crmApi.leads({ page, page_size: 20, q: debouncedQuery || undefined, status: status || undefined }); if (request === requestRef.current) { setLeads(result.data); setMeta(result.meta); } }
    catch { toast.error("Gagal memuat daftar lead"); } finally { if (request === requestRef.current) setLoading(false); }
  };
  useEffect(() => { load(1); }, [debouncedQuery, status]);
  const changeStatus = async (lead: CRMLead, next: LeadStatus) => { try { await crmApi.updateLead(lead.id, { status: next }); toast.success("Status lead diperbarui"); load(); } catch { toast.error("Gagal memperbarui status"); } };
  const remove = async (lead: CRMLead) => { if (!window.confirm(`Hapus lead ${lead.name}?`)) return; try { await crmApi.deleteLead(lead.id); toast.success("Lead dihapus"); load(); } catch { toast.error("Gagal menghapus lead"); } };
  return <div className="min-h-screen bg-slate-50"><CRMPageHeader title="Lead & Prospek" description="Capture, nilai, distribusikan, dan tindak lanjuti seluruh prospek dalam satu pipeline." actions={<><Button variant="outline" onClick={() => setImportOpen(true)}><FileUp />Import CSV</Button><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus />Tambah lead</Button></>} />
    <main className="p-6 lg:p-8"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, email, perusahaan, wilayah, campaign..." /></label><ERPSelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><ERPSelectOption value="">Semua status</ERPSelectOption>{leadStatuses.map((item) => <ERPSelectOption key={item.value} value={item.value}>{item.label}</ERPSelectOption>)}</ERPSelect><Button variant="ghost" size="icon" onClick={() => load()} title="Refresh"><RefreshCw className={loading ? "animate-spin" : ""} /></Button></div>
      <Table><TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>Owner</TableHead><TableHead>Dibuat</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow> : leads.length ? leads.map((lead) => <TableRow key={lead.id}><TableCell><button className="text-left" onClick={() => { setEditing(lead); setFormOpen(true); }}><span className="block font-semibold text-slate-900 hover:text-blue-600">{lead.name}</span><span className="block max-w-64 truncate text-xs text-slate-500">{lead.company_name || lead.email || lead.phone || "Tanpa detail kontak"}</span></button></TableCell><TableCell><span className="capitalize text-slate-700">{(lead.source || "-").replaceAll("_", " ")}</span>{lead.utm_campaign && <span className="block max-w-40 truncate text-xs text-slate-400">{lead.utm_campaign}</span>}</TableCell><TableCell><ERPSelect aria-label={`Status ${lead.name}`} value={lead.status} onChange={(e) => changeStatus(lead, e.target.value as LeadStatus)} className="rounded-lg border-0 bg-transparent p-0 text-xs outline-none"><ERPSelectOption value={lead.status}>{leadStatuses.find((item) => item.value === lead.status)?.label}</ERPSelectOption>{leadStatuses.filter((item) => item.value !== lead.status).map((item) => <ERPSelectOption key={item.value} value={item.value}>{item.label}</ERPSelectOption>)}</ERPSelect><div className="mt-1"><StatusBadge status={lead.status} /></div></TableCell><TableCell><ScoreBadge score={lead.score} /></TableCell><TableCell><span className="text-xs text-slate-500">{lead.assigned_to ? `${lead.assigned_to.slice(0, 8)}…` : "Unassigned"}</span></TableCell><TableCell className="text-xs text-slate-500">{new Date(lead.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setEditing(lead); setFormOpen(true); }}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => remove(lead)}><Trash2 />Hapus</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-56 text-center"><UserRoundSearch className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-medium text-slate-600">Belum ada lead</p><p className="mt-1 text-sm text-slate-400">Tambahkan manual, import CSV, atau gunakan capture API.</p></TableCell></TableRow>}</TableBody></Table>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm"><span className="text-slate-500">{meta.total} lead</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={meta.page <= 1 || loading} onClick={() => load(meta.page - 1)}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={meta.page * meta.page_size >= meta.total || loading} onClick={() => load(meta.page + 1)}>Berikutnya</Button></div></div></section></main>
    <LeadForm open={formOpen} lead={editing} onClose={() => setFormOpen(false)} onSaved={() => load()} /><ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => load(1)} />
  </div>;
}

