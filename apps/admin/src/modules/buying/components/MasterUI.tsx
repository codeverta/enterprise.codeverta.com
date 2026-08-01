import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ label, name, children, required }: { label: string; name?: string; children: React.ReactNode; required?: boolean }) {
  return <div className="space-y-1.5"><Label>{label}{required && <span className="text-red-500"> *</span>}</Label>{children}{name && <p className="text-[11px] text-slate-400">{name}</p>}</div>;
}
export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-t pt-6 first:border-0 first:pt-0"><div><h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>{children}</section>;
}
export function Combo({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  const id = useMemo(() => `buying-${Math.random().toString(36).slice(2)}`, []);
  return <><Input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Begin typing for results." /><datalist id={id}>{values.map((v) => <option key={v} value={v} />)}</datalist></>;
}
export function Check({ checked, onChange, label, name, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; name: string; description?: string }) {
  return <div className="flex items-start gap-2 pt-2"><Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} /><div><Label>{label}</Label>{description && <p className="max-w-xl text-xs text-slate-500">{description}</p>}<p className="text-[11px] text-slate-400">{name}</p></div></div>;
}
