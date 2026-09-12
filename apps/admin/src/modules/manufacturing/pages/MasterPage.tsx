import React, { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ERPPage, ERPPageHeader } from "@/components/erp-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { manufacturingApi, type NamedMaster, type Workstation } from "../api";

export default function MasterPage({ kind }: { kind: "operations" | "workstation-types" | "workstations" }) {
  const isStation = kind === "workstations";
  const title = kind === "operations" ? "Operation" : kind === "workstation-types" ? "Workstation Type" : "Workstation";
  const [rows, setRows] = useState<Array<NamedMaster | Workstation>>([]);
  const [types, setTypes] = useState<NamedMaster[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(""); const [typeID, setTypeID] = useState(""); const [capacity, setCapacity] = useState(1); const [saving, setSaving] = useState(false);
  const load = async () => { try { setRows(await manufacturingApi.listMaster(kind)); if (isStation) setTypes(await manufacturingApi.listMaster("workstation-types")); } catch { toast.error(`Gagal memuat ${title}`); } };
  useEffect(() => { void load(); }, [kind]);
  const reset = () => { setEditing(null); setName(""); setTypeID(""); setCapacity(1); };
  const edit = (row: NamedMaster | Workstation) => { setEditing(row.id); setName("workstation_name" in row ? row.workstation_name : row.name); if ("workstation_type_id" in row) { setTypeID(row.workstation_type_id); setCapacity(row.job_capacity); } };
  const save = async () => { if (!name.trim()) return toast.error(`${title} Name wajib diisi`); setSaving(true); try { const payload = isStation ? { workstation_name:name.trim(), workstation_type_id:typeID, job_capacity:capacity } : { name:name.trim() }; editing ? await manufacturingApi.updateMaster(kind, editing, payload) : await manufacturingApi.createMaster(kind, payload); toast.success(`${title} disimpan`); reset(); await load(); } catch { toast.error(`Gagal menyimpan ${title}`); } finally { setSaving(false); } };
  const remove = async (id:string) => { if (!confirm(`Hapus ${title}?`)) return; await manufacturingApi.deleteMaster(kind,id); await load(); };
  return <ERPPage><ERPPageHeader title={title} description={`Kelola master ${title.toLowerCase()} untuk proses produksi.`} breadcrumbs={[{label:"Manufacturing",href:"/desk/manufacturing"},{label:title}]} actions={<Button onClick={reset}><Plus/>New {title}</Button>}/>
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]"><section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">{title} Name</th>{isStation&&<th className="px-5 py-3">Job Capacity</th>}<th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{rows.map((row)=><tr key={row.id}><td className="px-5 py-4 font-mono text-xs">{row.id}</td><td className="px-5 py-4 font-medium">{"workstation_name" in row?row.workstation_name:row.name}</td>{isStation&&<td className="px-5 py-4">{(row as Workstation).job_capacity}</td>}<td className="px-5 py-4 text-right"><Button variant="ghost" size="icon" onClick={()=>edit(row)}><Pencil/></Button><Button variant="ghost" size="icon" onClick={()=>remove(row.id)}><Trash2 className="text-red-500"/></Button></td></tr>)}</tbody></table></section>
    <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">{editing?`Edit ${title}`:`New ${title}`}</h2><div className="space-y-2"><Label>{isStation?"Workstation Name":"Name"}</Label><Input value={name} onChange={(e)=>setName(e.target.value)}/></div>{isStation&&<><div className="space-y-2"><Label>Workstation Type</Label><SearchableSelect value={typeID} onChange={setTypeID} options={types.map(v=>({value:v.id,label:v.name}))} placeholder="Begin typing for results."/></div><div className="space-y-2"><Label>Job Capacity</Label><Input type="number" min={1} value={capacity} onChange={(e)=>setCapacity(Number(e.target.value)||1)}/><p className="text-xs text-slate-500">Run parallel job cards in a workstation</p></div></>}<Button className="w-full" onClick={save} disabled={saving}><Save/>{saving?"Saving...":"Save"}</Button></section></div>
  </ERPPage>;
}
