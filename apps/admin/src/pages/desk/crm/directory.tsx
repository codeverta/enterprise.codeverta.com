import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, Mail, MapPin, MessageSquarePlus, MoreHorizontal,
  Pencil, Phone, Plus, Search, Tags, Trash2, UserRound, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  crmApi, type CRMAccount, type CRMAccountInput, type CRMContact,
  type CRMContactInput, type CRMInteraction,
} from "@/lib/crm-api";
import { CRMPageHeader } from "./shared";

type DirectoryTab = "accounts" | "contacts";
type Selection = { kind: DirectoryTab; record: CRMAccount | CRMContact } | null;

const sizes = ["micro", "small", "medium", "large", "enterprise"] as const;
const accountStatuses = ["prospect", "customer", "churned"] as const;
const interactionTypes = ["call", "email", "meeting", "task"] as const;

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>;
}

function TagList({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return <span className="text-xs text-slate-400">Tanpa tag</span>;
  return <div className="flex flex-wrap gap-1">{tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{tag}</span>)}</div>;
}

function AccountForm({ open, account, accounts, onClose, onSaved }: { open: boolean; account: CRMAccount | null; accounts: CRMAccount[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", industry: "", company_size: "" as CRMAccount["company_size"], region: "", website: "", phone: "", address: "", parent_account_id: "", status: "prospect" as CRMAccount["status"], tags: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(account ? { ...account, parent_account_id: account.parent_account_id || "", tags: (account.tags || []).join(", ") } : { name: "", industry: "", company_size: "", region: "", website: "", phone: "", address: "", parent_account_id: "", status: "prospect", tags: "" }), [account, open]);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const payload: CRMAccountInput = {
      name: form.name.trim(), industry: form.industry.trim(), company_size: form.company_size,
      region: form.region.trim(), website: form.website.trim(), phone: form.phone.trim(), address: form.address.trim(),
      parent_account_id: form.parent_account_id || null, status: form.status,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      if (account) await crmApi.updateAccount(account.id, payload); else await crmApi.createAccount(payload);
      toast.success(account ? "Perusahaan diperbarui" : "Perusahaan ditambahkan"); onSaved(); onClose();
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menyimpan perusahaan"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{account ? "Edit perusahaan" : "Tambah perusahaan"}</DialogTitle><DialogDescription>Data account, hierarki induk, dan dimensi segmentasi.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Nama perusahaan"><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
    <Field label="Perusahaan induk"><select value={form.parent_account_id} onChange={(e) => set("parent_account_id", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">Tidak ada (root)</option>{accounts.filter((item) => item.id !== account?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Industri"><Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Teknologi, Retail, Manufaktur..." /></Field>
    <Field label="Ukuran perusahaan"><select value={form.company_size} onChange={(e) => set("company_size", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">Belum ditentukan</option>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></Field>
    <Field label="Wilayah"><Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Jakarta / Indonesia Barat" /></Field>
    <Field label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">{accountStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
    <Field label="Website"><Input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" /></Field>
    <Field label="Telepon"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
    <Field label="Tags" wide><Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="enterprise, priority, partner (pisahkan dengan koma)" /></Field>
    <Field label="Alamat" wide><Textarea rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
  </div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ContactForm({ open, contact, accounts, presetAccountID, onClose, onSaved }: { open: boolean; contact: CRMContact | null; accounts: CRMAccount[]; presetAccountID?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", account_id: "", position: "", email: "", phone: "", tags: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(contact ? { first_name: contact.first_name, last_name: contact.last_name, account_id: contact.account_id || "", position: contact.position, email: contact.email, phone: contact.phone, tags: (contact.tags || []).join(", ") } : { first_name: "", last_name: "", account_id: presetAccountID || "", position: "", email: "", phone: "", tags: "" }), [contact, open, presetAccountID]);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const payload: CRMContactInput = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), account_id: form.account_id || null, position: form.position.trim(), email: form.email.trim(), phone: form.phone.trim(), tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
    try { if (contact) await crmApi.updateContact(contact.id, payload); else await crmApi.createContact(payload); toast.success(contact ? "Kontak diperbarui" : "Kontak ditambahkan"); onSaved(); onClose(); }
    catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menyimpan kontak"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{contact ? "Edit kontak" : "Tambah kontak"}</DialogTitle><DialogDescription>Profil individu dan perusahaan tempat kontak bekerja.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Nama depan"><Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field><Field label="Nama belakang"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
    <Field label="Perusahaan"><select value={form.account_id} onChange={(e) => set("account_id", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">Independen</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Jabatan"><Input value={form.position} onChange={(e) => set("position", e.target.value)} /></Field>
    <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Telepon"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
    <Field label="Tags" wide><Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="decision-maker, finance, technical (pisahkan dengan koma)" /></Field>
  </div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function InteractionDialog({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const [rows, setRows] = useState<CRMInteraction[]>([]);
  const [form, setForm] = useState({ type: "call" as CRMInteraction["type"], subject: "", description: "", status: "completed" as CRMInteraction["status"], due_date: "" });
  const [saving, setSaving] = useState(false);
  const load = async () => { if (!selection) return; try { setRows(await crmApi.interactions(selection.kind, selection.record.id)); } catch { toast.error("Gagal memuat riwayat interaksi"); } };
  useEffect(() => { if (selection) load(); else setRows([]); }, [selection?.record.id, selection?.kind]);
  if (!selection) return null;
  const name = selection.kind === "accounts" ? (selection.record as CRMAccount).name : `${(selection.record as CRMContact).first_name} ${(selection.record as CRMContact).last_name}`.trim();
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await crmApi.createInteraction(selection.kind, selection.record.id, { ...form, due_date: form.due_date ? `${form.due_date}T00:00:00Z` : null }); toast.success("Interaksi dicatat"); setForm({ type: "call", subject: "", description: "", status: "completed", due_date: "" }); await load(); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal mencatat interaksi"); } finally { setSaving(false); } };
  return <Dialog open onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Riwayat interaksi — {name}</DialogTitle><DialogDescription>Panggilan, email, meeting, dan task tersimpan sebagai timeline.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="rounded-xl border bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Tipe"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CRMInteraction["type"] })} className="h-9 rounded-md border bg-white px-3 text-sm">{interactionTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CRMInteraction["status"] })} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="completed">completed</option><option value="pending">pending</option><option value="cancelled">cancelled</option></select></Field><Field label="Subjek" wide><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Follow up proposal" /></Field><Field label="Jatuh tempo"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Catatan"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div></div><div className="mt-3 flex justify-end"><Button type="submit" size="sm" disabled={saving}><MessageSquarePlus />{saving ? "Menyimpan..." : "Catat interaksi"}</Button></div></form>
    <div className="relative ml-3 space-y-5 border-l border-slate-200 pl-6">{rows.length ? rows.map((row) => <article key={row.id} className="relative"><span className="absolute -left-[31px] top-1 flex size-3 rounded-full border-2 border-white bg-blue-600" /><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{row.subject}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{row.type}</span><span className={`text-xs ${row.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{row.status}</span></div><p className="mt-1 text-sm text-slate-600">{row.description || "Tanpa catatan"}</p><p className="mt-1 text-xs text-slate-400">{new Date(row.created_at).toLocaleString("id-ID")}</p></article>) : <div className="py-6 text-sm text-slate-400">Belum ada riwayat interaksi.</div>}</div>
  </DialogContent></Dialog>;
}

export default function CRMDirectoryPage() {
  const [tab, setTab] = useState<DirectoryTab>("accounts");
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [query, setQuery] = useState(""); const [debounced, setDebounced] = useState("");
  const [industry, setIndustry] = useState(""); const [size, setSize] = useState(""); const [region, setRegion] = useState(""); const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true); const [accountOpen, setAccountOpen] = useState(false); const [contactOpen, setContactOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CRMAccount | null>(null); const [editingContact, setEditingContact] = useState<CRMContact | null>(null); const [selection, setSelection] = useState<Selection>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query), 300); return () => clearTimeout(timer); }, [query]);
  const loadAccounts = async (filtered = true) => { const result = await crmApi.accounts(filtered ? { page_size: 100, q: debounced || undefined, industry: industry || undefined, company_size: size || undefined, region: region || undefined, tag: tag || undefined } : { page_size: 100 }); setAccounts(result.data || []); };
  const loadContacts = async () => { const result = await crmApi.contacts({ page_size: 100, q: debounced || undefined, tag: tag || undefined }); setContacts(result.data || []); };
  const load = async () => { setLoading(true); try { if (tab === "accounts") await loadAccounts(); else await loadContacts(); } catch { toast.error("Gagal memuat directory CRM"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [tab, debounced, industry, size, region, tag]);
  useEffect(() => { crmApi.accounts({ page_size: 100 }).then((result) => { if (tab !== "accounts") setAccounts(result.data || []); }).catch(() => undefined); }, [tab]);
  const industries = useMemo(() => [...new Set(accounts.map((item) => item.industry).filter(Boolean))].sort(), [accounts]);
  const regions = useMemo(() => [...new Set(accounts.map((item) => item.region).filter(Boolean))].sort(), [accounts]);
  const removeAccount = async (record: CRMAccount) => { if (!confirm(`Hapus perusahaan ${record.name}? Kontak akan menjadi independen.`)) return; try { await crmApi.deleteAccount(record.id); toast.success("Perusahaan dihapus"); load(); } catch { toast.error("Gagal menghapus perusahaan"); } };
  const removeContact = async (record: CRMContact) => { if (!confirm(`Hapus kontak ${record.first_name}?`)) return; try { await crmApi.deleteContact(record.id); toast.success("Kontak dihapus"); load(); } catch { toast.error("Gagal menghapus kontak"); } };
  return <div className="min-h-screen bg-slate-50"><CRMPageHeader title="Kontak & Perusahaan" description="Kelola individu, account perusahaan, hierarki organisasi, segmentasi, dan seluruh riwayat interaksi." actions={<Button onClick={() => tab === "accounts" ? (setEditingAccount(null), setAccountOpen(true)) : (setEditingContact(null), setContactOpen(true))}><Plus />Tambah {tab === "accounts" ? "perusahaan" : "kontak"}</Button>} />
    <main className="space-y-5 p-6 lg:p-8"><div className="inline-flex rounded-xl border bg-white p-1"><button onClick={() => setTab("accounts")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === "accounts" ? "bg-blue-600 text-white" : "text-slate-600"}`}><Building2 className="size-4" />Perusahaan</button><button onClick={() => setTab("contacts")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === "contacts" ? "bg-blue-600 text-white" : "text-slate-600"}`}><UsersRound className="size-4" />Kontak</button></div>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b p-4"><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "accounts" ? "Cari perusahaan, industri, wilayah..." : "Cari nama, email, telepon, jabatan..."} /></label>{tab === "accounts" && <><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="">Semua industri</option>{industries.map((value) => <option key={value}>{value}</option>)}</select><select value={size} onChange={(e) => setSize(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="">Semua ukuran</option>{sizes.map((value) => <option key={value}>{value}</option>)}</select><select value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="">Semua wilayah</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></>}<div className="relative"><Tags className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="w-44 pl-9" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Filter tag" /></div></div>
        {tab === "accounts" ? <Table><TableHeader><TableRow><TableHead>Perusahaan</TableHead><TableHead>Hierarki</TableHead><TableHead>Segmentasi</TableHead><TableHead>Kontak</TableHead><TableHead>Tag</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-36 text-center">Memuat...</TableCell></TableRow> : accounts.length ? accounts.map((record) => <TableRow key={record.id}><TableCell><button className="text-left" onClick={() => setSelection({ kind: "accounts", record })}><strong className="block hover:text-blue-600">{record.name}</strong><span className="text-xs text-slate-500">{record.status} · {record.phone || record.website || "tanpa kontak"}</span></button></TableCell><TableCell><span className="text-sm">{record.parent_name ? `↳ ${record.parent_name}` : "Root company"}</span></TableCell><TableCell><div className="flex gap-1.5"><span className="rounded bg-violet-50 px-2 py-1 text-xs text-violet-700">{record.industry || "Industri—"}</span><span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{record.company_size || "Ukuran—"}</span></div>{record.region && <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="size-3" />{record.region}</span>}</TableCell><TableCell><span className="flex items-center gap-2"><UsersRound className="size-4 text-slate-400" />{record.contact_count}</span></TableCell><TableCell><TagList tags={record.tags} /></TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setSelection({ kind: "accounts", record })}><CalendarClock />Riwayat interaksi</DropdownMenuItem><DropdownMenuItem onClick={() => { setEditingAccount(record); setAccountOpen(true); }}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => removeAccount(record)}><Trash2 />Hapus</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400"><Building2 className="mx-auto mb-2 size-9" />Belum ada perusahaan</TableCell></TableRow>}</TableBody></Table>
        : <Table><TableHeader><TableRow><TableHead>Kontak</TableHead><TableHead>Perusahaan</TableHead><TableHead>Jabatan</TableHead><TableHead>Informasi kontak</TableHead><TableHead>Tag</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-36 text-center">Memuat...</TableCell></TableRow> : contacts.length ? contacts.map((record) => <TableRow key={record.id}><TableCell><button className="text-left" onClick={() => setSelection({ kind: "contacts", record })}><strong className="hover:text-blue-600">{record.first_name} {record.last_name}</strong></button></TableCell><TableCell>{record.account_name || <span className="text-slate-400">Independen</span>}</TableCell><TableCell>{record.position || "—"}</TableCell><TableCell><div className="space-y-1 text-xs text-slate-600">{record.email && <span className="flex items-center gap-1"><Mail className="size-3" />{record.email}</span>}{record.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{record.phone}</span>}</div></TableCell><TableCell><TagList tags={record.tags} /></TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setSelection({ kind: "contacts", record })}><CalendarClock />Riwayat interaksi</DropdownMenuItem><DropdownMenuItem onClick={() => { setEditingContact(record); setContactOpen(true); }}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => removeContact(record)}><Trash2 />Hapus</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400"><UserRound className="mx-auto mb-2 size-9" />Belum ada kontak</TableCell></TableRow>}</TableBody></Table>}
      </section></main>
    <AccountForm open={accountOpen} account={editingAccount} accounts={accounts} onClose={() => setAccountOpen(false)} onSaved={load} />
    <ContactForm open={contactOpen} contact={editingContact} accounts={accounts} onClose={() => setContactOpen(false)} onSaved={load} />
    <InteractionDialog selection={selection} onClose={() => setSelection(null)} />
  </div>;
}
