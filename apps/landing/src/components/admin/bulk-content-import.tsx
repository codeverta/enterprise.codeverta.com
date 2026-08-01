/**
 * Bulk Content Import — admin workflow to:
 * 1) pick a content template, 2) download CSV template, 3) upload CSV,
 * 4) validate + preview, 5) inline-fix missing fields, 6) bulk-assign
 * access / level / pillar, 7) publish all imported rows.
 *
 * Designed to scale to large catalogs — never loads existing content,
 * only stages the upload in-memory before insert.
 */

import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileUp, FileText, CheckCircle2, AlertTriangle, Trash2, Upload, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CSV_TEMPLATES,
  findTemplate,
  ACCESS_ENUM,
  LEVEL_ENUM,
  type CsvTemplate,
  type ColumnSpec,
} from "@/lib/csv-templates";

/* ───────────────────────── CSV helpers ───────────────────────── */

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = []; let field = ""; let q = false;
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

function coerce(spec: ColumnSpec, raw: string): unknown {
  if (raw === "" || raw == null) return undefined;
  switch (spec.type) {
    case "number":  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    case "boolean": return raw === "true" || raw === "1";
    case "tags":    return raw.split("|").map((s) => s.trim()).filter(Boolean);
    default:        return raw;
  }
}

function validateRow(spec: CsvTemplate, row: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const c of spec.columns) {
    const v = (row[c.key] ?? "").trim();
    if (c.required && v === "") errors.push(`missing:${c.key}`);
    if (v && c.enumValues && !c.enumValues.includes(v)) errors.push(`enum:${c.key}`);
  }
  return errors;
}

function downloadFile(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function templateToCsv(t: CsvTemplate, includeSamples: boolean): string {
  const head = t.columns.map((c) => c.key).join(",");
  if (!includeSamples) return `${head}\n`;
  const body = t.samples.map((row) =>
    t.columns.map((c) => escapeCsv((row as Record<string, unknown>)[c.key] ?? "")).join(","),
  ).join("\n");
  return `${head}\n${body}\n`;
}

/* ───────────────────────── Component ───────────────────────── */

interface StagedRow {
  data: Record<string, string>;
  errors: string[];
}

export function BulkContentImport() {
  const [templateId, setTemplateId] = useState<string>(CSV_TEMPLATES[0].id);
  const template = useMemo(() => findTemplate(templateId)!, [templateId]);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const onPickFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) return toast.error("CSV kosong / tidak valid");
    setRows(parsed.map((d) => ({ data: d, errors: validateRow(template, d) })));
    toast.success(`${parsed.length} baris dimuat — siap divalidasi`);
  };

  const loadSamples = () => {
    setRows(template.samples.map((s) => {
      const data: Record<string, string> = {};
      for (const c of template.columns) {
        const v = (s as Record<string, unknown>)[c.key];
        data[c.key] = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
      }
      return { data, errors: validateRow(template, data) };
    }));
    toast.success(`${template.samples.length} contoh dimuat`);
  };

  const updateCell = (idx: number, key: string, value: string) => {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], data: { ...next[idx].data, [key]: value } };
      next[idx].errors = validateRow(template, next[idx].data);
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const bulkSet = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => {
      const data = { ...r.data, [key]: value };
      return { data, errors: validateRow(template, data) };
    }));
    toast.success(`Set ${key} = ${value} pada semua baris`);
  };

  const publishAll = async (statusValue: string) => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (!valid.length) return toast.error("Tidak ada baris valid untuk diimport");
    setBusy(true);
    const payload = valid.map((r) => {
      const o: Record<string, unknown> = { ...(template.fixed ?? {}) };
      for (const c of template.columns) {
        const raw = r.data[c.key];
        if (raw !== undefined && raw !== "") o[c.key] = coerce(c, raw);
      }
      if (template.columns.some((c) => c.key === "status")) o.status = statusValue;
      if (template.columns.some((c) => c.key === "published")) {
        o.published = statusValue === "published";
      }
      return o;
    });
    // @ts-expect-error dynamic table name
    const { error } = await supabase.from(template.table).insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Berhasil import ${payload.length} baris ke ${template.table}`);
    setRows([]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rounded-2xl border-primary/30 bg-primary/[0.04]">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Bulk Content Import</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilih template → unduh CSV → unggah → validasi → perbaiki kolom kosong → import & publikasikan.
              Mendukung 11 jenis konten dengan dukungan bilingual ID/EN, level, pillar, akses, dan media URL.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setRows([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CSV_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => downloadFile(`${template.id}-template.csv`, templateToCsv(template, false))}>
              <FileText className="mr-1.5 h-4 w-4" /> Template kosong
            </Button>
            <Button variant="outline" onClick={() => downloadFile(`${template.id}-samples.csv`, templateToCsv(template, true))}>
              <Download className="mr-1.5 h-4 w-4" /> Template + 5 contoh
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-1.5 h-4 w-4" /> Upload CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); e.target.value = ""; }}
            />
          </div>

          <p className="text-xs text-muted-foreground">{template.description}</p>

          {/* Required columns list */}
          <div className="flex flex-wrap gap-1">
            {template.columns.filter((c) => c.required).map((c) => (
              <Badge key={c.key} variant="outline" className="text-[10px]">
                wajib: {c.key}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={loadSamples}>
              <Wand2 className="mr-1 h-3.5 w-3.5" /> Muat 5 contoh dari template
            </Button>
            {rows.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setRows([])}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Bersihkan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview + validation */}
      {rows.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="rounded-full">{rows.length} baris</Badge>
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> {errorCount} perlu diperbaiki
                  </span>
                )}
              </div>

              {/* Bulk assign actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={(v) => bulkSet("access_type", v)}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Bulk assign access" /></SelectTrigger>
                  <SelectContent>
                    {ACCESS_ENUM.map((v) => <SelectItem key={v} value={v}>access: {v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => bulkSet("level", v)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Bulk assign level" /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_ENUM.map((v) => <SelectItem key={v} value={v}>level: {v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Bulk pillar id"
                  className="h-8 w-[150px] text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      bulkSet("pillar", (e.target as HTMLInputElement).value.trim());
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button size="sm" variant="outline" disabled={busy || !validCount} onClick={() => publishAll("draft")}>
                  Simpan sebagai Draft
                </Button>
                <Button size="sm" disabled={busy || !validCount} onClick={() => publishAll("published")}>
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  Import & Publish ({validCount})
                </Button>
              </div>
            </div>

            {/* Editable preview */}
            <div className="max-h-[480px] overflow-auto rounded-xl border">
              <table className="w-full min-w-[800px] text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="w-8 p-2 text-left">#</th>
                    {template.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap p-2 text-left">
                        {c.label}
                        {c.required && <span className="ml-0.5 text-destructive">*</span>}
                      </th>
                    ))}
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className={r.errors.length ? "bg-destructive/5" : ""}>
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      {template.columns.map((c) => {
                        const missing = r.errors.includes(`missing:${c.key}`);
                        const badEnum = r.errors.includes(`enum:${c.key}`);
                        const cls = `h-7 text-xs ${missing ? "border-destructive bg-destructive/10" : badEnum ? "border-amber-500 bg-amber-500/10" : ""}`;
                        if (c.enumValues) {
                          return (
                            <td key={c.key} className="p-1 align-top">
                              <Select value={r.data[c.key] ?? ""} onValueChange={(v) => updateCell(idx, c.key, v)}>
                                <SelectTrigger className={cls}><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {c.enumValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} className="p-1 align-top">
                            <Input
                              value={r.data[c.key] ?? ""}
                              onChange={(e) => updateCell(idx, c.key, e.target.value)}
                              className={cls}
                              placeholder={c.hint ?? c.type}
                            />
                          </td>
                        );
                      })}
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
