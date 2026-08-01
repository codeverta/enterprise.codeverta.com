/**
 * Reusable CSV import/export + bulk-action toolbar for any CMS table.
 * Used for: courses, modules, lessons, learning_assets, digital_library,
 * audio_items (asset_type=audio_*), video_items (asset_type=short_video).
 */

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileUp, FileText, CheckCircle2, Lock, Unlock, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  table: string;
  columns: string[];
  /** Example row used for the downloadable CSV template. */
  templateRow: Record<string, string | number | boolean | string[]>;
  /** Optional preset bulk actions. */
  bulkActions?: {
    publish?: { column: string }; // e.g. { column: "status" } => set "published"
    accessType?: boolean;
    levelPillar?: boolean;
  };
}

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += c;
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const filtered = rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
  const [head, ...rest] = filtered;
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function coerce(v: string): string | number | boolean | string[] {
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.includes("|")) return v.split("|").map((s) => s.trim()).filter(Boolean);
  return v;
}

export function CsvBulkTools({ table, columns, templateRow, bulkActions }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const download = (name: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    setBusy(true);
    // @ts-expect-error dynamic table name
    const { data, error } = await supabase.from(table).select(columns.join(","));
    setBusy(false);
    if (error) return toast.error(error.message);
    const rows = (data as unknown as Record<string, unknown>[] | null) ?? [];
    const head = columns.join(",");
    const body = rows.map((r) => columns.map((c) => escapeCsv(r[c])).join(",")).join("\n");
    download(`${table}-export-${new Date().toISOString().slice(0, 10)}.csv`, `${head}\n${body}`);
    toast.success(`Exported ${rows.length} row(s)`);
  };

  const downloadTemplate = () => {
    const head = columns.join(",");
    const sample = columns.map((c) => escapeCsv(templateRow[c] ?? "")).join(",");
    download(`${table}-import-template.csv`, `${head}\n${sample}\n`);
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { setBusy(false); return toast.error("CSV empty / invalid"); }
    const cleaned = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of columns) {
        if (r[c] !== undefined && r[c] !== "") o[c] = coerce(r[c]);
      }
      return o;
    });
    // @ts-expect-error dynamic table name
    const { error } = await supabase.from(table).insert(cleaned);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${cleaned.length} row(s) into ${table}`);
  };

  const bulkPublish = async () => {
    if (!bulkActions?.publish) return;
    if (!confirm(`Publish ALL ${table} items?`)) return;
    setBusy(true);
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).update({ [bulkActions.publish.column]: "published" }).neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bulk published");
  };

  const bulkSetAccess = async (access: string) => {
    if (!confirm(`Set ALL ${table} items access_type = ${access}?`)) return;
    setBusy(true);
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).update({ access_type: access }).neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Bulk set access = ${access}`);
  };

  const bulkSetLevelPillar = async () => {
    const level = prompt("Set level for ALL rows (early|elementary|middle|high):");
    if (!level) return;
    const pillar = prompt("Set pillar id (e.g. el_baca):") ?? "";
    if (!pillar) return;
    setBusy(true);
    // @ts-expect-error dynamic
    const { error } = await supabase.from(table).update({ level, pillar }).neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bulk assigned level & pillar");
  };

  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <FileUp className="mr-1 h-4 w-4" /> Import CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importCsv(f);
            e.target.value = "";
          }}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={downloadTemplate}>
          <FileText className="mr-1 h-4 w-4" /> CSV Template
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1 border-l pl-2 text-xs">
          <span className="text-muted-foreground">Bulk:</span>
          {bulkActions?.publish && (
            <Button size="sm" variant="outline" onClick={bulkPublish}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Publish All
            </Button>
          )}
          {bulkActions?.accessType && (
            <>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess("included")}>
                <Unlock className="mr-1 h-3.5 w-3.5" /> Set Included
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess("premium_addon")}>
                <Lock className="mr-1 h-3.5 w-3.5" /> Set Premium
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess("free_preview")}>
                Set Free Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess("level_locked")}>
                Set Level Locked
              </Button>
            </>
          )}
          {bulkActions?.levelPillar && (
            <Button size="sm" variant="outline" onClick={bulkSetLevelPillar}>
              <Tag className="mr-1 h-3.5 w-3.5" /> Assign Level + Pillar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
