import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Trash2,
  Plus,
  Upload,
  Download,
  FileUp,
  Lock,
  Unlock,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ----------------------------- Types ----------------------------- */

type LibraryRow = {
  id?: string;
  title_id: string;
  title_en: string;
  description_id: string;
  description_en: string;
  audience: string; // early|elementary|middle|high|parent
  type: string; // category
  language: string; // id|en|bilingual
  format: string; // pdf|video|audio|interactive|text
  reading_time_minutes: number;
  premium: boolean; // false = included, true = premium add-on
  price_addon_idr: number;
  thumbnail_url: string | null;
  resource_url: string | null;
  tags: string[];
  published: boolean;
  sort_order: number;
};

const empty: LibraryRow = {
  title_id: "",
  title_en: "",
  description_id: "",
  description_en: "",
  audience: "elementary",
  type: "worksheet",
  language: "id",
  format: "pdf",
  reading_time_minutes: 10,
  premium: false,
  price_addon_idr: 0,
  thumbnail_url: "",
  resource_url: "",
  tags: [],
  published: true,
  sort_order: 0,
};

/* ----------------------------- CSV helpers ----------------------------- */

const CSV_HEADERS = [
  "title_id",
  "title_en",
  "level",
  "category",
  "language",
  "format",
  "reading_time",
  "access_type",
  "price_addon",
  "description_id",
  "description_en",
  "status",
  "file_url",
  "thumbnail_url",
  "tags",
] as const;

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: LibraryRow[]): string {
  const head = CSV_HEADERS.join(",");
  const body = rows
    .map((r) =>
      [
        r.title_id,
        r.title_en,
        r.audience,
        r.type,
        r.language,
        r.format,
        r.reading_time_minutes,
        r.premium ? "premium" : "included",
        r.price_addon_idr,
        r.description_id,
        r.description_en,
        r.published ? "published" : "draft",
        r.resource_url ?? "",
        r.thumbnail_url ?? "",
        (r.tags ?? []).join("|"),
      ]
        .map(escapeCsv)
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  const [header, ...rest] = rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function csvRowToLibrary(r: Record<string, string>): Partial<LibraryRow> {
  const access = (r.access_type ?? "included").toLowerCase();
  const status = (r.status ?? "published").toLowerCase();
  return {
    title_id: r.title_id ?? "",
    title_en: r.title_en ?? "",
    audience: r.level ?? "elementary",
    type: r.category ?? "worksheet",
    language: r.language ?? "id",
    format: r.format ?? "pdf",
    reading_time_minutes: Number(r.reading_time) || 10,
    premium: access === "premium",
    price_addon_idr: Number(r.price_addon) || 0,
    description_id: r.description_id ?? "",
    description_en: r.description_en ?? "",
    published: status === "published",
    resource_url: r.file_url || null,
    thumbnail_url: r.thumbnail_url || null,
    tags: (r.tags ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

const CSV_TEMPLATE = `${CSV_HEADERS.join(",")}
"Sample Reading","Sample Reading","elementary","worksheet","id","pdf","10","included","0","Deskripsi singkat ID","Short description EN","published","","","math|early"
"Premium AI Guide","Premium AI Guide","high","ai_literacy","bilingual","pdf","20","premium","29000","Panduan premium","Premium guide","published","","","ai|teen"
`;

/* ----------------------------- Component ----------------------------- */

export function LibraryEditor() {
  const [items, setItems] = useState<LibraryRow[]>([]);
  const [draft, setDraft] = useState<LibraryRow>(empty);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAccess, setFilterAccess] = useState<"all" | "included" | "premium">("all");
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("library_items")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setItems(((data as LibraryRow[] | null) ?? []).map(normalize));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((r) => {
      if (filterAccess === "included" && r.premium) return false;
      if (filterAccess === "premium" && !r.premium) return false;
      if (!needle) return true;
      return `${r.title_id} ${r.title_en} ${r.type} ${r.audience}`.toLowerCase().includes(needle);
    });
  }, [items, search, filterAccess]);

  /* -------- CRUD -------- */
  const add = async () => {
    if (!draft.title_id || !draft.title_en) {
      toast.error("Title (ID & EN) required");
      return;
    }
    const { error } = await supabase.from("library_items").insert(toPayload(draft));
    if (error) return toast.error(error.message);
    toast.success("Library item added");
    setDraft(empty);
    void load();
  };

  const update = async (row: LibraryRow) => {
    if (!row.id) return;
    const { error } = await supabase
      .from("library_items")
      .update(toPayload(row))
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this library item?")) return;
    const { error } = await supabase.from("library_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  /* -------- Storage uploads -------- */
  const uploadFile = async (
    bucket: "library-thumbnails" | "library-files",
    file: File,
  ): Promise<string | null> => {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      return null;
    }
    // Thumbnails bucket stays public; files bucket is private — issue a
    // long-lived signed URL so the link continues to resolve for authorized viewers.
    if (bucket === "library-thumbnails") {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    }
    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    if (signErr || !data?.signedUrl) {
      toast.error(signErr?.message ?? "Could not generate signed URL");
      return null;
    }
    return data.signedUrl;
  };

  /* -------- CSV import/export -------- */
  const exportCsv = () => {
    const csv = rowsToCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "library-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("CSV is empty or invalid");
      return;
    }
    const rows = parsed
      .map(csvRowToLibrary)
      .filter((r): r is LibraryRow => Boolean(r.title_id && r.title_en))
      .map((r) => ({ ...empty, ...r }));
    if (rows.length === 0) {
      toast.error("No valid rows (need title_id & title_en)");
      return;
    }
    const { error } = await supabase.from("library_items").insert(rows.map(toPayload));
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} item(s)`);
    void load();
  };

  /* -------- Bulk Manage Access -------- */
  const bulkSetAccess = async (premium: boolean) => {
    const ids = visible.map((r) => r.id!).filter(Boolean);
    if (ids.length === 0) return toast.error("No items in current filter");
    if (!confirm(`Set ${ids.length} item(s) as ${premium ? "Premium" : "Included"}?`)) return;
    const { error } = await supabase
      .from("library_items")
      .update({ premium })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${ids.length} item(s)`);
    void load();
  };

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card className="rounded-2xl">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button size="sm" onClick={() => document.getElementById("lib-add-form")?.scrollIntoView({ behavior: "smooth" })}>
            <Plus className="mr-1 h-4 w-4" /> Add Library Item
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => csvFileRef.current?.click()}
          >
            <FileUp className="mr-1 h-4 w-4" /> Import CSV
          </Button>
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadTemplate}>
            <FileText className="mr-1 h-4 w-4" /> CSV Template
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48"
            />
            <div className="flex items-center gap-1 rounded-full border p-1 text-xs">
              {(["all", "included", "premium"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterAccess(k)}
                  className={`rounded-full px-2 py-1 transition-colors ${
                    filterAccess === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 border-l pl-2">
              <span className="text-xs text-muted-foreground">Manage Access:</span>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess(false)}>
                <Unlock className="mr-1 h-3.5 w-3.5" /> Mark Included
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetAccess(true)}>
                <Lock className="mr-1 h-3.5 w-3.5" /> Mark Premium
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add form */}
      <Card id="lib-add-form" className="rounded-2xl">
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Add Library Item</div>
          <LibraryFields
            row={draft}
            onChange={setDraft}
            onUploadThumb={async (f) => {
              const url = await uploadFile("library-thumbnails", f);
              if (url) setDraft({ ...draft, thumbnail_url: url });
            }}
            onUploadFile={async (f) => {
              const url = await uploadFile("library-files", f);
              if (url) setDraft({ ...draft, resource_url: url });
            }}
          />
          <div className="flex justify-end">
            <Button onClick={add}>
              <Plus className="mr-1 h-4 w-4" /> Add Library Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Showing {visible.length} of {items.length} item(s)
          </div>
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No items match the current filter.</p>
          )}
          {visible.map((row) => {
            const idx = items.findIndex((it) => it.id === row.id);
            return (
              <Card key={row.id} className="rounded-2xl">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{row.title_id || "Untitled"}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {row.audience}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {row.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] ${
                        row.premium ? "border-amber-400/50 text-amber-600" : "border-primary/40 text-primary"
                      }`}
                    >
                      {row.premium ? "Premium" : "Included"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] ${
                        row.published ? "border-emerald-400/50 text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      {row.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <LibraryFields
                    row={row}
                    onChange={(next) => {
                      const c = [...items];
                      c[idx] = next;
                      setItems(c);
                    }}
                    onUploadThumb={async (f) => {
                      const url = await uploadFile("library-thumbnails", f);
                      if (url) {
                        const c = [...items];
                        c[idx] = { ...row, thumbnail_url: url };
                        setItems(c);
                      }
                    }}
                    onUploadFile={async (f) => {
                      const url = await uploadFile("library-files", f);
                      if (url) {
                        const c = [...items];
                        c[idx] = { ...row, resource_url: url };
                        setItems(c);
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => update(items[idx])}>
                      <Save className="mr-1 h-4 w-4" /> Save
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(row.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Field grid ----------------------------- */

function LibraryFields({
  row,
  onChange,
  onUploadThumb,
  onUploadFile,
}: {
  row: LibraryRow;
  onChange: (next: LibraryRow) => void;
  onUploadThumb: (f: File) => Promise<void>;
  onUploadFile: (f: File) => Promise<void>;
}) {
  const set = <K extends keyof LibraryRow>(k: K, v: LibraryRow[K]) =>
    onChange({ ...row, [k]: v });

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Title (ID)">
        <Input value={row.title_id} onChange={(e) => set("title_id", e.target.value)} />
      </Field>
      <Field label="Title (EN)">
        <Input value={row.title_en} onChange={(e) => set("title_en", e.target.value)} />
      </Field>

      <Field label="Description (ID)" full>
        <Textarea rows={2} value={row.description_id} onChange={(e) => set("description_id", e.target.value)} />
      </Field>
      <Field label="Description (EN)" full>
        <Textarea rows={2} value={row.description_en} onChange={(e) => set("description_en", e.target.value)} />
      </Field>

      <Field label="Level (early|elementary|middle|high|parent)">
        <Input value={row.audience} onChange={(e) => set("audience", e.target.value)} />
      </Field>
      <Field label="Category / Type">
        <Input
          placeholder="worksheet|story|ai_literacy|financial_literacy|…"
          value={row.type}
          onChange={(e) => set("type", e.target.value)}
        />
      </Field>

      <Field label="Language (id|en|bilingual)">
        <Input value={row.language} onChange={(e) => set("language", e.target.value)} />
      </Field>
      <Field label="Format (pdf|text|audio|video_story|interactive)">
        <Input value={row.format} onChange={(e) => set("format", e.target.value)} />
      </Field>

      <Field label="Reading time (minutes)">
        <Input
          type="number"
          value={row.reading_time_minutes}
          onChange={(e) => set("reading_time_minutes", Number(e.target.value))}
        />
      </Field>
      <Field label="Premium add-on price (IDR)">
        <Input
          type="number"
          value={row.price_addon_idr}
          onChange={(e) => set("price_addon_idr", Number(e.target.value))}
        />
      </Field>

      {/* Access */}
      <Field label="Access type">
        <div className="flex h-9 items-center gap-2">
          <Switch checked={row.premium} onCheckedChange={(v) => set("premium", v)} />
          <span className="text-xs text-muted-foreground">
            {row.premium ? "Premium add-on" : "Included in membership"}
          </span>
        </div>
      </Field>
      <Field label="Publish status">
        <div className="flex h-9 items-center gap-2">
          <Switch checked={row.published} onCheckedChange={(v) => set("published", v)} />
          <span className="text-xs text-muted-foreground">{row.published ? "Published" : "Draft"}</span>
        </div>
      </Field>

      {/* Thumbnail */}
      <Field label="Thumbnail" full>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Paste image URL or upload"
            value={row.thumbnail_url ?? ""}
            onChange={(e) => set("thumbnail_url", e.target.value)}
          />
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-muted">
            <ImageIcon className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadThumb(f);
                e.target.value = "";
              }}
            />
          </label>
          {row.thumbnail_url && (
            <img
              src={row.thumbnail_url}
              alt=""
              className="h-10 w-10 rounded object-cover"
              loading="lazy"
            />
          )}
        </div>
      </Field>

      {/* File / Resource */}
      <Field label="Resource file (PDF / link)" full>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Paste external URL or upload small PDF"
            value={row.resource_url ?? ""}
            onChange={(e) => set("resource_url", e.target.value)}
          />
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-muted">
            <Upload className="h-3.5 w-3.5" /> Upload PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Field>

      <Field label="Tags (comma or new-line separated)" full>
        <Textarea
          rows={2}
          placeholder="ai, finance, early"
          value={(row.tags ?? []).join(", ")}
          onChange={(e) =>
            set(
              "tags",
              e.target.value
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </Field>

      <Field label="Sort order">
        <Input
          type="number"
          value={row.sort_order}
          onChange={(e) => set("sort_order", Number(e.target.value))}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function normalize(r: LibraryRow): LibraryRow {
  return {
    ...empty,
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
    thumbnail_url: r.thumbnail_url ?? "",
    resource_url: r.resource_url ?? "",
  };
}

function toPayload(r: LibraryRow) {
  return {
    title_id: r.title_id,
    title_en: r.title_en,
    description_id: r.description_id,
    description_en: r.description_en,
    audience: r.audience,
    type: r.type,
    language: r.language,
    format: r.format,
    reading_time_minutes: r.reading_time_minutes,
    premium: r.premium,
    price_addon_idr: r.price_addon_idr,
    thumbnail_url: r.thumbnail_url || null,
    resource_url: r.resource_url || null,
    tags: r.tags ?? [],
    published: r.published,
    sort_order: r.sort_order,
  };
}
