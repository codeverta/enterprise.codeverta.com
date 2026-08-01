import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FieldKind = "text" | "textarea" | "number" | "boolean" | "json";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  fullWidth?: boolean;
}

interface Props {
  table: string;
  fields: FieldDef[];
  orderBy?: string;
  defaults?: Record<string, unknown>;
  titleField: string; // field to show as row heading
}

type Row = Record<string, unknown> & { id?: string };

export function GenericTableEditor({ table, fields, orderBy = "sort_order", defaults = {}, titleField }: Props) {
  const empty: Row = { ...defaults, ...Object.fromEntries(fields.map((f) => [f.key, defaultForKind(f.kind)])) };
  const [items, setItems] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Row>(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // @ts-expect-error dynamic table name
    const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as Row[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [table]);

  const add = async () => {
    for (const f of fields) {
      if (f.required && !draft[f.key]) { toast.error(`${f.label} is required`); return; }
    }
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).insert(stripUndefined(draft));
    if (error) return toast.error(error.message);
    toast.success("Added"); setDraft(empty); void load();
  };

  const update = async (row: Row) => {
    const payload = Object.fromEntries(fields.map((f) => [f.key, row[f.key]]));
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).update(payload).eq("id", row.id!);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); void load();
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Add new entry</div>
          <FieldGrid fields={fields} row={draft} onChange={setDraft} />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
          {items.map((row, i) => (
            <Card key={String(row.id)} className="rounded-2xl">
              <CardContent className="space-y-3 p-5">
                <div className="text-sm font-semibold text-muted-foreground">{String(row[titleField] ?? "Untitled")}</div>
                <FieldGrid
                  fields={fields}
                  row={row}
                  onChange={(next) => { const c = [...items]; c[i] = next; setItems(c); }}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => update(items[i])}><Save className="mr-1 h-4 w-4" /> Save</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(String(row.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldGrid({ fields, row, onChange }: { fields: FieldDef[]; row: Row; onChange: (next: Row) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={`space-y-1.5 ${f.fullWidth ? "md:col-span-2" : ""}`}>
          <Label className="text-xs">{f.label}</Label>
          {renderField(f, row, onChange)}
        </div>
      ))}
    </div>
  );
}

function renderField(f: FieldDef, row: Row, onChange: (next: Row) => void) {
  const v = row[f.key];
  const set = (val: unknown) => onChange({ ...row, [f.key]: val });
  switch (f.kind) {
    case "textarea":
      return <Textarea rows={f.rows ?? 2} placeholder={f.placeholder} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />;
    case "number":
      return <Input type="number" placeholder={f.placeholder} value={Number(v ?? 0)} onChange={(e) => set(Number(e.target.value))} />;
    case "boolean":
      return (
        <div className="flex h-9 items-center gap-2">
          <Switch checked={Boolean(v)} onCheckedChange={set} />
          <span className="text-xs text-muted-foreground">{v ? "Yes" : "No"}</span>
        </div>
      );
    case "json": {
      const text = Array.isArray(v) ? (v as unknown[]).join("\n") : "";
      return (
        <Textarea
          rows={f.rows ?? 4}
          placeholder={f.placeholder ?? "One item per line"}
          value={text}
          onChange={(e) => set(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        />
      );
    }
    default:
      return <Input placeholder={f.placeholder} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />;
  }
}

function defaultForKind(kind: FieldKind): unknown {
  switch (kind) {
    case "number": return 0;
    case "boolean": return true;
    case "json": return [];
    default: return "";
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}
