import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  BarChart3, Building2, CalendarDays, Columns3, GripVertical, Loader2,
  MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  crmApi, type CRMForecast, type CRMOpportunity, type CRMOpportunityInput,
  type CRMPipeline, type CRMPipelineStage,
} from "@/lib/crm-api";
import { CRMPageHeader } from "./shared";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";

type View = "pipeline" | "forecast";

const emptyPipeline: CRMPipeline = { stages: [], opportunities: [], accounts: [], contacts: [], sales_reps: [] };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const dateInput = (value?: string | null) => value?.slice(0, 10) || "";
const today = () => new Date().toISOString().slice(0, 10);
const plusMonths = (months: number) => { const date = new Date(); date.setMonth(date.getMonth() + months); return date.toISOString().slice(0, 10); };

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>;
}

function OpportunityForm({ open, opportunity, pipeline, initialStage, onClose, onSaved }: { open: boolean; opportunity: CRMOpportunity | null; pipeline: CRMPipeline; initialStage?: string; onClose: () => void; onSaved: () => void }) {
  const firstStage = initialStage || pipeline.stages[0]?.id || "";
  const [form, setForm] = useState({ name: "", account_id: "", contact_id: "", stage_id: firstStage, amount: 0, probability: 10, expected_close_date: plusMonths(1), owner_id: "", source: "", lost_reason: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (opportunity) setForm({ name: opportunity.name, account_id: opportunity.account_id || "", contact_id: opportunity.contact_id || "", stage_id: opportunity.stage_id, amount: opportunity.amount, probability: opportunity.probability, expected_close_date: dateInput(opportunity.expected_close_date), owner_id: opportunity.owner_id || "", source: opportunity.source || "", lost_reason: opportunity.lost_reason || "" });
    else { const stage = pipeline.stages.find((item) => item.id === firstStage) || pipeline.stages[0]; setForm({ name: "", account_id: "", contact_id: "", stage_id: stage?.id || "", amount: 0, probability: stage?.default_probability || 0, expected_close_date: plusMonths(1), owner_id: "", source: "", lost_reason: "" }); }
  }, [opportunity, open, firstStage, pipeline.stages]);
  const selectedStage = pipeline.stages.find((stage) => stage.id === form.stage_id);
  const contacts = pipeline.contacts.filter((contact) => !form.account_id || contact.account_id === form.account_id);
  const set = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const changeStage = (id: string) => { const stage = pipeline.stages.find((item) => item.id === id); setForm((current) => ({ ...current, stage_id: id, probability: stage?.default_probability ?? current.probability, lost_reason: stage?.stage_type === "lost" ? current.lost_reason : "" })); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedStage?.stage_type === "lost" && !form.lost_reason.trim()) return toast.error("Alasan kalah wajib diisi");
    setSaving(true);
    const payload: CRMOpportunityInput = { name: form.name.trim(), account_id: form.account_id || null, contact_id: form.contact_id || null, stage_id: form.stage_id || null, amount: Number(form.amount), probability: Number(form.probability), expected_close_date: form.expected_close_date ? `${form.expected_close_date}T00:00:00Z` : null, owner_id: form.owner_id || null, source: form.source.trim(), lost_reason: form.lost_reason.trim() };
    try { if (opportunity) await crmApi.updateOpportunity(opportunity.id, payload); else await crmApi.createOpportunity(payload); toast.success(opportunity ? "Deal diperbarui" : "Deal ditambahkan"); onSaved(); onClose(); }
    catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menyimpan deal"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{opportunity ? "Edit deal" : "Tambah deal"}</DialogTitle><DialogDescription>Nilai, probabilitas, owner, dan estimasi closing akan digunakan dalam forecast.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Nama deal" wide><Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Implementasi ERP PT Contoh" /></Field>
    <Field label="Perusahaan"><ERPSelect value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value, contact_id: "" })} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><ERPSelectOption value="">Tanpa perusahaan</ERPSelectOption>{pipeline.accounts.map((account) => <ERPSelectOption key={account.id} value={account.id}>{account.name}</ERPSelectOption>)}</ERPSelect></Field>
    <Field label="Kontak"><ERPSelect value={form.contact_id} onChange={(e) => set("contact_id", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><ERPSelectOption value="">Tanpa kontak</ERPSelectOption>{contacts.map((contact) => <ERPSelectOption key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</ERPSelectOption>)}</ERPSelect></Field>
    <Field label="Stage"><ERPSelect required value={form.stage_id} onChange={(e) => changeStage(e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">{pipeline.stages.map((stage) => <ERPSelectOption key={stage.id} value={stage.id}>{stage.name}</ERPSelectOption>)}</ERPSelect></Field>
    <Field label="Sales rep"><ERPSelect value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><ERPSelectOption value="">Unassigned</ERPSelectOption>{pipeline.sales_reps.map((rep) => <ERPSelectOption key={rep.id} value={rep.id}>{rep.name}</ERPSelectOption>)}</ERPSelect></Field>
    <Field label="Nilai deal (IDR)"><Input type="number" min="0" step="any" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
    <Field label="Probabilitas menang (%)"><Input type="number" min="0" max="100" step="any" value={form.probability} onChange={(e) => set("probability", Number(e.target.value))} /></Field>
    <Field label="Estimasi tanggal closing"><Input type="date" value={form.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} /></Field>
    <Field label="Sumber"><Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Referral, website, event..." /></Field>
    {selectedStage?.stage_type === "lost" && <Field label="Alasan kalah" wide><Textarea required rows={3} value={form.lost_reason} onChange={(e) => set("lost_reason", e.target.value)} placeholder="Harga, kompetitor, timing, kebutuhan berubah..." /></Field>}
  </div><div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Weighted forecast: <strong>{money(form.amount * form.probability / 100)}</strong></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{opportunity ? "Simpan" : "Tambah deal"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function StageSettings({ open, stages, onClose, onChanged }: { open: boolean; stages: CRMPipelineStage[]; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<CRMPipelineStage[]>([]);
  const [draft, setDraft] = useState({ name: "", stage_type: "open" as CRMPipelineStage["stage_type"], sort_order: 70, default_probability: 25 });
  useEffect(() => setRows(stages.map((stage) => ({ ...stage }))), [stages, open]);
  const updateRow = (index: number, patch: Partial<CRMPipelineStage>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const save = async (stage: CRMPipelineStage) => { try { await crmApi.updatePipelineStage(stage.id, { name: stage.name, stage_type: stage.stage_type, sort_order: Number(stage.sort_order), default_probability: Number(stage.default_probability) }); toast.success("Stage diperbarui"); onChanged(); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal memperbarui stage"); } };
  const remove = async (stage: CRMPipelineStage) => { if (!confirm(`Hapus stage ${stage.name}?`)) return; try { await crmApi.deletePipelineStage(stage.id); toast.success("Stage dihapus"); onChanged(); } catch (error: any) { toast.error(error?.response?.data?.error || "Stage masih digunakan"); } };
  const create = async () => { if (!draft.name.trim()) return; try { await crmApi.createPipelineStage(draft); toast.success("Stage ditambahkan"); setDraft({ name: "", stage_type: "open", sort_order: draft.sort_order + 10, default_probability: 25 }); onChanged(); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal menambah stage"); } };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Atur tahapan pipeline</DialogTitle><DialogDescription>Nama, urutan, probabilitas default, dan hasil stage dapat dikustomisasi.</DialogDescription></DialogHeader><div className="space-y-2">{rows.sort((a, b) => a.sort_order - b.sort_order).map((stage, index) => <div key={stage.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_130px_90px_120px_auto]"><Input value={stage.name} onChange={(e) => updateRow(index, { name: e.target.value })} /><ERPSelect value={stage.stage_type} onChange={(e) => updateRow(index, { stage_type: e.target.value as CRMPipelineStage["stage_type"] })} className="h-9 rounded-md border bg-white px-2 text-sm"><ERPSelectOption value="open">Open</ERPSelectOption><ERPSelectOption value="won">Closed Won</ERPSelectOption><ERPSelectOption value="lost">Closed Lost</ERPSelectOption></ERPSelect><Input type="number" value={stage.sort_order} onChange={(e) => updateRow(index, { sort_order: Number(e.target.value) })} title="Urutan" /><Input type="number" min="0" max="100" value={stage.default_probability} onChange={(e) => updateRow(index, { default_probability: Number(e.target.value) })} title="Probabilitas" /><div className="flex"><Button size="sm" variant="outline" onClick={() => save(stage)}>Simpan</Button><Button size="icon" variant="ghost" onClick={() => remove(stage)}><Trash2 className="size-4 text-red-500" /></Button></div></div>)}</div><div className="grid gap-2 rounded-xl border border-dashed bg-slate-50 p-3 sm:grid-cols-[1fr_130px_90px_120px_auto]"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Stage baru" /><ERPSelect value={draft.stage_type} onChange={(e) => setDraft({ ...draft, stage_type: e.target.value as CRMPipelineStage["stage_type"] })} className="h-9 rounded-md border bg-white px-2 text-sm"><ERPSelectOption value="open">Open</ERPSelectOption><ERPSelectOption value="won">Closed Won</ERPSelectOption><ERPSelectOption value="lost">Closed Lost</ERPSelectOption></ERPSelect><Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} /><Input type="number" min="0" max="100" value={draft.default_probability} onChange={(e) => setDraft({ ...draft, default_probability: Number(e.target.value) })} /><Button onClick={create}><Plus />Tambah</Button></div><DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter></DialogContent></Dialog>;
}

function LostReasonDialog({ deal, stage, onClose, onConfirm }: { deal: CRMOpportunity | null; stage?: CRMPipelineStage; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(deal?.lost_reason || ""), [deal]);
  return <Dialog open={Boolean(deal)} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Tandai deal sebagai kalah</DialogTitle><DialogDescription>{deal?.name} akan dipindahkan ke {stage?.name}. Alasan ini dipakai untuk analisis.</DialogDescription></DialogHeader><Field label="Alasan kalah"><Textarea autoFocus rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: kalah harga dari kompetitor" /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Simpan alasan & pindahkan</Button></DialogFooter></DialogContent></Dialog>;
}

function KanbanBoard({ pipeline, loading, onDragEnd, onAdd, onEdit, onDelete }: {
  pipeline: CRMPipeline;
  loading: boolean;
  onDragEnd: (result: DropResult) => void;
  onAdd: (stageID: string) => void;
  onEdit: (deal: CRMOpportunity) => void;
  onDelete: (deal: CRMOpportunity) => void;
}) {
  if (loading) return <div className="py-24 text-center"><Loader2 className="mx-auto size-7 animate-spin text-blue-600" /></div>;
  return <DragDropContext onDragEnd={onDragEnd}>
    <div className="flex min-h-[540px] gap-4 overflow-x-auto pb-4">
      {pipeline.stages.map((stage) => {
        const deals = pipeline.opportunities.filter((deal) => deal.stage_id === stage.id);
        const stageAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);
        return <Droppable droppableId={stage.id} key={stage.id}>
          {(provided, snapshot) => <section
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`w-[310px] shrink-0 rounded-2xl border p-3 transition ${snapshot.isDraggingOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-100/70"}`}
          >
            <header className="mb-3 flex items-start justify-between">
              <div><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${stage.stage_type === "won" ? "bg-emerald-500" : stage.stage_type === "lost" ? "bg-red-500" : "bg-blue-500"}`} /><h2 className="font-bold text-slate-800">{stage.name}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{deals.length}</span></div><p className="mt-1 pl-4 text-xs text-slate-500">{money(stageAmount)} · {stage.default_probability}% default</p></div>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => onAdd(stage.id)}><Plus className="size-4" /></Button>
            </header>
            <div className="space-y-3">
              {deals.map((deal, index) => <Draggable draggableId={deal.id} index={index} key={deal.id}>
                {(dragProvided, dragSnapshot) => <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`rounded-xl border bg-white p-4 shadow-sm ${dragSnapshot.isDragging ? "rotate-1 shadow-xl" : ""}`}>
                  <div className="flex items-start gap-2"><button {...dragProvided.dragHandleProps} className="mt-0.5 text-slate-300 hover:text-slate-500"><GripVertical className="size-4" /></button><button className="min-w-0 flex-1 text-left" onClick={() => onEdit(deal)}><h3 className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600">{deal.name}</h3><p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500"><Building2 className="size-3" />{deal.account_name || "Tanpa perusahaan"}</p></button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onEdit(deal)}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => onDelete(deal)}><Trash2 />Hapus</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
                  <div className="mt-4"><strong className="text-sm">{money(deal.amount)}</strong><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${deal.probability}%` }} /></div><div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{deal.probability}% · {money(deal.weighted_amount)}</span>{deal.expected_close_date && <span className="flex items-center gap-1"><CalendarDays className="size-3" />{dateInput(deal.expected_close_date)}</span>}</div></div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-slate-500"><span className="flex items-center gap-1"><UserRound className="size-3" />{deal.owner_name || "Unassigned"}</span>{deal.status === "lost" && deal.lost_reason && <span className="max-w-28 truncate text-red-500" title={deal.lost_reason}>{deal.lost_reason}</span>}</div>
                </article>}
              </Draggable>)}
              {provided.placeholder}
              {deals.length === 0 && <div className="rounded-xl border border-dashed p-7 text-center text-xs text-slate-400">Tarik deal ke sini</div>}
            </div>
          </section>}
        </Droppable>;
      })}
    </div>
  </DragDropContext>;
}

function ForecastView({ pipeline }: { pipeline: CRMPipeline }) {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"); const [to, setTo] = useState(plusMonths(6)); const [owner, setOwner] = useState(""); const [data, setData] = useState<CRMForecast | null>(null); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setData(await crmApi.forecast({ from, to, owner_id: owner || undefined })); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal memuat forecast"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [from, to, owner]);
  const total = (key: "pipeline" | "weighted" | "won") => (data?.periods || []).reduce((sum, row) => sum + row[key], 0);
  return <div className="space-y-5"><div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><Field label="Dari"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Sampai"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field><Field label="Sales rep"><ERPSelect value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 min-w-48 rounded-md border bg-white px-3 text-sm"><ERPSelectOption value="">Semua sales rep</ERPSelectOption>{pipeline.sales_reps.map((rep) => <ERPSelectOption key={rep.id} value={rep.id}>{rep.name}</ERPSelectOption>)}</ERPSelect></Field></div>
    <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Open pipeline</p><strong className="mt-2 block text-xl">{money(total("pipeline"))}</strong></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm text-blue-700">Weighted forecast</p><strong className="mt-2 block text-xl text-blue-900">{money(total("weighted"))}</strong></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">Closed won</p><strong className="mt-2 block text-xl text-emerald-900">{money(total("won"))}</strong></div></div>
    {loading ? <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin" /></div> : <div className="grid gap-5 xl:grid-cols-2"><section className="overflow-hidden rounded-2xl border bg-white"><h3 className="border-b p-4 font-semibold">Forecast per periode</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Periode</th><th className="p-3 text-right">Deals</th><th className="p-3 text-right">Pipeline</th><th className="p-3 text-right">Weighted</th><th className="p-3 text-right">Won</th></tr></thead><tbody className="divide-y">{data?.periods.length ? data.periods.map((row) => <tr key={row.period}><td className="p-3 font-medium">{new Date(`${row.period}-01`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</td><td className="p-3 text-right">{row.deals}</td><td className="p-3 text-right">{money(row.pipeline)}</td><td className="p-3 text-right font-semibold text-blue-700">{money(row.weighted)}</td><td className="p-3 text-right text-emerald-700">{money(row.won)}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-slate-400">Tidak ada deal pada periode ini</td></tr>}</tbody></table></div></section><section className="overflow-hidden rounded-2xl border bg-white"><h3 className="border-b p-4 font-semibold">Forecast per sales rep</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Sales rep</th><th className="p-3 text-right">Deals</th><th className="p-3 text-right">Pipeline</th><th className="p-3 text-right">Weighted</th><th className="p-3 text-right">Won</th></tr></thead><tbody className="divide-y">{data?.by_rep.length ? data.by_rep.map((row) => <tr key={row.owner_id}><td className="p-3 font-medium">{row.owner_name}</td><td className="p-3 text-right">{row.deals}</td><td className="p-3 text-right">{money(row.pipeline)}</td><td className="p-3 text-right font-semibold text-blue-700">{money(row.weighted)}</td><td className="p-3 text-right text-emerald-700">{money(row.won)}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-slate-400">Belum ada forecast sales rep</td></tr>}</tbody></table></div></section><section className="overflow-hidden rounded-2xl border bg-white xl:col-span-2"><h3 className="border-b p-4 font-semibold">Analisis alasan kalah</h3><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{data?.lost_reasons?.length ? data.lost_reasons.map((row) => <div key={row.reason} className="rounded-xl border border-red-100 bg-red-50 p-4"><strong className="text-sm text-red-900">{row.reason}</strong><div className="mt-2 flex justify-between text-xs text-red-700"><span>{row.deals} deal</span><span>{money(row.amount)}</span></div></div>) : <p className="py-5 text-sm text-slate-400">Belum ada deal kalah pada periode ini.</p>}</div></section></div>}
  </div>;
}

export default function CRMOpportunitiesPage() {
  const [view, setView] = useState<View>("pipeline"); const [pipeline, setPipeline] = useState<CRMPipeline>(emptyPipeline); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [debounced, setDebounced] = useState(""); const [owner, setOwner] = useState("");
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<CRMOpportunity | null>(null); const [initialStage, setInitialStage] = useState<string>(); const [stageOpen, setStageOpen] = useState(false); const [lostMove, setLostMove] = useState<{ deal: CRMOpportunity; stage: CRMPipelineStage } | null>(null);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(timer); }, [query]);
  const load = async () => { setLoading(true); try { setPipeline(await crmApi.pipeline({ q: debounced || undefined, owner_id: owner || undefined })); } catch { toast.error("Gagal memuat sales pipeline"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [debounced, owner]);
  const move = async (deal: CRMOpportunity, stage: CRMPipelineStage, reason = "") => { try { await crmApi.moveOpportunity(deal.id, stage.id, reason); toast.success(`Deal dipindahkan ke ${stage.name}`); setLostMove(null); await load(); } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal memindahkan deal"); } };
  const onDragEnd = (result: DropResult) => { if (!result.destination || result.destination.droppableId === result.source.droppableId) return; const deal = pipeline.opportunities.find((item) => item.id === result.draggableId); const stage = pipeline.stages.find((item) => item.id === result.destination!.droppableId); if (!deal || !stage) return; if (stage.stage_type === "lost") setLostMove({ deal, stage }); else move(deal, stage); };
  const remove = async (deal: CRMOpportunity) => { if (!confirm(`Hapus deal ${deal.name}?`)) return; try { await crmApi.deleteOpportunity(deal.id); toast.success("Deal dihapus"); load(); } catch { toast.error("Gagal menghapus deal"); } };
  const totals = useMemo(() => ({ amount: pipeline.opportunities.filter((item) => item.status === "open").reduce((sum, item) => sum + item.amount, 0), weighted: pipeline.opportunities.filter((item) => item.status === "open").reduce((sum, item) => sum + item.weighted_amount, 0) }), [pipeline.opportunities]);
  return <div className="min-h-screen bg-slate-50"><CRMPageHeader title="Peluang & Deal" description="Kelola sales pipeline, probabilitas kemenangan, closing, dan revenue forecast." actions={<><Button variant="outline" onClick={() => setStageOpen(true)}><Settings2 />Atur stage</Button><Button onClick={() => { setEditing(null); setInitialStage(undefined); setFormOpen(true); }}><Plus />Tambah deal</Button></>} />
    <main className="space-y-5 p-5 lg:p-8"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="inline-flex w-fit rounded-xl border bg-white p-1"><button onClick={() => setView("pipeline")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${view === "pipeline" ? "bg-blue-600 text-white" : "text-slate-600"}`}><Columns3 className="size-4" />Pipeline</button><button onClick={() => setView("forecast")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${view === "forecast" ? "bg-blue-600 text-white" : "text-slate-600"}`}><BarChart3 className="size-4" />Forecast</button></div>{view === "pipeline" && <div className="flex flex-wrap gap-3"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="w-72 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari deal..." /></label><ERPSelect value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm"><ERPSelectOption value="">Semua sales rep</ERPSelectOption>{pipeline.sales_reps.map((rep) => <ERPSelectOption key={rep.id} value={rep.id}>{rep.name}</ERPSelectOption>)}</ERPSelect></div>}</div>
      {view === "forecast" ? <ForecastView pipeline={pipeline} /> : <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><span className="text-xs text-slate-500">Open deals</span><strong className="mt-1 block text-xl">{pipeline.opportunities.filter((item) => item.status === "open").length}</strong></div><div className="rounded-xl border bg-white p-4"><span className="text-xs text-slate-500">Total pipeline</span><strong className="mt-1 block text-xl">{money(totals.amount)}</strong></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><span className="text-xs text-blue-700">Weighted pipeline</span><strong className="mt-1 block text-xl text-blue-900">{money(totals.weighted)}</strong></div></div>
        <KanbanBoard pipeline={pipeline} loading={loading} onDragEnd={onDragEnd} onAdd={(stageID) => { setEditing(null); setInitialStage(stageID); setFormOpen(true); }} onEdit={(deal) => { setEditing(deal); setInitialStage(undefined); setFormOpen(true); }} onDelete={remove} />
      </>}
    </main><OpportunityForm open={formOpen} opportunity={editing} pipeline={pipeline} initialStage={initialStage} onClose={() => setFormOpen(false)} onSaved={load} /><StageSettings open={stageOpen} stages={pipeline.stages} onClose={() => setStageOpen(false)} onChanged={load} /><LostReasonDialog deal={lostMove?.deal || null} stage={lostMove?.stage} onClose={() => setLostMove(null)} onConfirm={(reason) => lostMove && move(lostMove.deal, lostMove.stage, reason)} />
  </div>;
}
