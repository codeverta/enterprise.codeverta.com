import React from "react";
import { Loader2, Save, Eye, AlignLeft, Upload, Trash2, Link2, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import SafeHTMLRenderer from "@/components/SafeHtmlRenderer";
import { MarkdownView } from "@/components/course-editor/MarkdownView";
import { RefObject } from "react";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";

export interface AssetType {
  value: string;
  label: string;
  icon: any; // Sesuaikan dengan tipe komponen ikon Anda
}

export interface Asset {
  id?: string;
  title: string;
  type: string;
  file_url: string;
  thumbnail_url: string;
  description: string;
  // Tambahkan properti lain jika ada dalam objek aset
}

export interface LessonForm {
  id: string;
  module_id: string;
  tenant_id: string;
  title: string;
  summary: string;
  sort_order: number;
  is_published: boolean;
  is_preview: boolean;
  require_attachment: boolean;
  duration_sec: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  completed_at: string | null;
  is_completed: boolean;
  progress_percent: number;
  progress_status: string;
  progress: any; // Sesuaikan dengan interface Progress jika diperlukan
}

export interface LessonEditorProps {
  lessonForm: LessonForm;
  setLessonForm: React.Dispatch<React.SetStateAction<LessonForm>>;
  canManageCourses: boolean;
  canManageAssets: boolean;
  saveLesson: () => Promise<void>;
  busyKey: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  RichToolbar: React.FC<{ onInsert: (tag: string, type: string) => void }>;
  handleInsert: (tag: string, type: string) => void;
  markdownPreview: (value: string) => any; // Sesuaikan return type jika diketahui
  assets: Asset[];
  assetTypes: AssetType[];
  acceptByAssetType: Record<string, string>;
  assetForm: Asset;
  setAssetForm: React.Dispatch<React.SetStateAction<Asset>>;
  uploadAssetFile: (file: File) => Promise<void>;
  uploadAssetThumbnail: (file: File) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  addAsset: () => Promise<void>;
  selectedLessonId: string;
  isDirty?: boolean;
}

export const LessonEditor = ({
  lessonForm,
  setLessonForm,
  canManageCourses,
  canManageAssets,
  saveLesson,
  busyKey,
  textareaRef,
  RichToolbar,
  handleInsert,
  markdownPreview,
  assets,
  assetTypes,
  acceptByAssetType,
  assetForm,
  setAssetForm,
  uploadAssetFile,
  uploadAssetThumbnail,
  deleteAsset,
  addAsset,
  selectedLessonId,
  isDirty,
}: LessonEditorProps) => {

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-8xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Editor Lesson</h2>
          <p className="text-xs text-zinc-500 mt-px">
            Masukkan materi dengan format markdown, code, ataupun rumus
            matematika.
          </p>
        </div>
        {canManageCourses && (
          <div className="flex items-center gap-2.5">
            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Belum disimpan
              </span>
            )}
            <Button
              size="sm"
              onClick={saveLesson}
              disabled={busyKey === "save-lesson"}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 gap-1.5 h-8 text-xs shadow-sm shadow-indigo-200"
            >
              {busyKey === "save-lesson" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {assetForm.title.trim() && assetForm.file_url.trim()
                ? "Simpan Lesson + Media"
                : "Simpan Lesson"}
            </Button>
          </div>
        )}
      </div>

      {/* Title + Toggles */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700">
            Judul Lesson
          </Label>
          <Input
            placeholder="cth: Matematika Dasar - Bab 1"
            value={lessonForm.title || ""}
            readOnly={!canManageCourses}
            maxLength={100}
            onChange={(e) =>
              setLessonForm((p) => ({ ...p, title: e.target.value }))
            }
            className="h-9 text-sm font-medium"
          />
          <div className="flex justify-end text-[10px] text-zinc-400">
            <span>{(lessonForm.title || "").length}/100</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 pt-1">
          {/* <div className="flex items-center gap-2">
            <Switch
              id="les-preview"
              checked={!!lessonForm.is_preview}
              disabled={!canManageCourses}
              onCheckedChange={(v) =>
                setLessonForm((p) => ({ ...p, is_preview: v }))
              }
            />
            <Label
              htmlFor="les-preview"
              className="text-xs cursor-pointer text-zinc-600"
            >
              Gratis Preview
            </Label>
          </div> */}
          <div className="flex items-center gap-2">
            <Switch
              id="les-attachment"
              checked={!!lessonForm.require_attachment}
              disabled={!canManageCourses}
              onCheckedChange={(v) =>
                setLessonForm((p) => ({ ...p, require_attachment: v }))
              }
            />
            <Label
              htmlFor="les-attachment"
              className="text-xs cursor-pointer text-zinc-600"
            >
              Perlu Attachment Partner
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="les-published"
              checked={!!lessonForm.is_published}
              disabled={!canManageCourses}
              onCheckedChange={(v) =>
                setLessonForm((p) => ({ ...p, is_published: v }))
              }
            />
            <Label
              htmlFor="les-published"
              className="text-xs cursor-pointer text-zinc-600"
            >
              Published
            </Label>
          </div>
        </div>
        {lessonForm.require_attachment && (
          <div className="space-y-1.5 pt-3 border-t border-dashed border-zinc-150 animate-in slide-in-from-top-1 duration-200">
            <Label className="text-xs font-semibold text-zinc-700">
              Nilai Minimum Kelulusan Tugas (Attachment Passing Score)
            </Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="cth: 75"
              value={lessonForm.attachment_passing_score || ""}
              readOnly={!canManageCourses}
              onChange={(e) =>
                setLessonForm((p) => ({
                  ...p,
                  attachment_passing_score: parseFloat(e.target.value) || 0,
                }))
              }
              className="h-9 text-sm font-medium w-full max-w-xs"
            />
          </div>
        )}
      </div>

      {/* Editor + Preview Tabs */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <Tabs defaultValue="write">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4">
            <TabsList className="h-10 bg-transparent gap-0 p-0">
              {["write", "preview", "split"].map((val) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="h-8 rounded-md px-3 text-xs font-medium transition-all
                     text-zinc-500 hover:text-zinc-900 
                     data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 
                     data-[state=active]:shadow-none"
                >
                  {val === "write" && "✏️ Edit"}
                  {val === "preview" && (
                    <>
                      <Eye className="mr-1.5 h-3 w-3" /> Preview
                    </>
                  )}
                  {val === "split" && (
                    <>
                      <AlignLeft className="mr-1.5 h-3 w-3" /> Split
                    </>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <span className="text-[11px] text-zinc-400">
              {(lessonForm.summary || "").length}/50000 karakter
            </span>
          </div>

          <TabsContent value="write" className="m-0">
            {canManageCourses && <RichToolbar onInsert={handleInsert} />}
            <textarea
              ref={textareaRef}
              className="w-full font-mono text-[13px] leading-relaxed resize-none focus:outline-none px-4 py-4 min-h-[420px] bg-white text-zinc-800 placeholder:text-zinc-300"
              placeholder="Tulis konten materi di sini menggunakan Markdown…"
              value={lessonForm.summary || ""}
              readOnly={!canManageCourses}
              maxLength={50000}
              onChange={(e) =>
                setLessonForm((p) => ({ ...p, summary: e.target.value }))
              }
            />
          </TabsContent>

          <TabsContent value="preview" className="m-0">
            <div className="min-h-[420px] px-6 py-4 text-sm text-zinc-800 leading-relaxed overflow-y-auto">
              <MarkdownView
                content={lessonForm.summary || "*Belum ada konten.*"}
              />
            </div>
          </TabsContent>

          <TabsContent value="split" className="m-0">
            <div className="grid grid-cols-2 divide-x divide-zinc-100">
              <div className="flex flex-col">
                {canManageCourses && <RichToolbar onInsert={handleInsert} />}
                <textarea
                  ref={textareaRef}
                  className="font-mono text-[13px] leading-relaxed resize-none focus:outline-none px-4 py-4 min-h-[420px] bg-white text-zinc-800 placeholder:text-zinc-300"
                  placeholder="Tulis konten…"
                  value={lessonForm.summary || ""}
                  readOnly={!canManageCourses}
                  maxLength={50000}
                  onChange={(e) =>
                    setLessonForm((p) => ({ ...p, summary: e.target.value }))
                  }
                />
              </div>
              <div className="min-h-[420px] px-5 py-4 text-sm text-zinc-800 leading-relaxed overflow-y-auto bg-zinc-50/50">
                <MarkdownView
                  content={lessonForm.summary || "*Belum ada konten.*"}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Media Assets Card */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">
              Media & Aset Pendukung
            </h3>
            <p className="text-[11px] text-zinc-400 mt-px">
              Upload file multimedia ke dalam lesson ini
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {assets.length} file
          </Badge>
        </div>

        <div
          className={cn(
            "p-5 gap-5",
            canManageAssets ? "grid lg:grid-cols-[1fr_300px]" : "block"
          )}
        >
          <div className="space-y-2">
            {assets.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-8 text-center">
                <Upload className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  Belum ada media terlampir
                </p>
              </div>
            ) : (
              assets.map((asset) => {
                const typeMeta =
                  assetTypes.find((t) => t.value === asset.type) ||
                  assetTypes[0];
                const AssetIcon = typeMeta.icon;
                return (
                  <div
                    key={asset.id}
                    className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 transition-colors"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <AssetIcon className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-800 truncate">
                        {asset.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-mono truncate mt-px">
                        {asset.file_url}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      {typeMeta.label}
                    </Badge>
                    {canManageAssets && (
                      <button
                        type="button"
                        onClick={() => deleteAsset(asset.id)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {canManageAssets && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Lampirkan File
              </p>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-zinc-600">
                  Tipe
                </Label>
                <ERPSelect
                  className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={assetForm.type}
                  onChange={(e) =>
                    setAssetForm((p) => ({
                      ...p,
                      type: e.target.value,
                      file_url: "",
                    }))
                  }
                >
                  {assetTypes
                    .filter((t) => canManageCourses || t.value === "youtube")
                    .map((t) => (
                      <ERPSelectOption key={t.value} value={t.value}>
                        {t.label}
                      </ERPSelectOption>
                    ))}
                </ERPSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-zinc-600">
                  Nama Lampiran
                </Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="cth: Source Code Bab 1"
                  value={assetForm.title}
                  maxLength={100}
                  onChange={(e) =>
                    setAssetForm((p) => ({ ...p, title: e.target.value }))
                  }
                />
                <div className="flex justify-end text-[9px] text-zinc-400">
                  <span>{(assetForm.title || "").length}/100</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-zinc-600">
                  {assetForm.type === "youtube"
                    ? "Link YouTube"
                    : "Upload File"}
                </Label>
                {assetForm.type === "youtube" ? (
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                      type="url"
                      className="h-8 bg-white pl-8 text-xs"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={assetForm.file_url}
                      onChange={(e) =>
                        setAssetForm((p) => ({
                          ...p,
                          file_url: e.target.value,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input
                      type="file"
                      className="h-8 text-[11px] cursor-pointer bg-white"
                      accept={acceptByAssetType[assetForm.type]}
                      onChange={(e) => uploadAssetFile(e.target.files?.[0])}
                    />
                    <p className="text-[9px] text-zinc-400 leading-normal">
                      * Maksimal file:{" "}
                      {assetForm.type === "video" ||
                      assetForm.type === "audiobook"
                        ? "100MB"
                        : assetForm.type === "image"
                        ? "5MB"
                        : "20MB"}
                      . Ekstensi: {acceptByAssetType[assetForm.type]}
                    </p>
                  </div>
                )}
                {assetForm.file_url && (
                  <p className="text-[10px] text-emerald-600 font-mono truncate mt-1">
                    ✓ {assetForm.file_url}
                  </p>
                )}
              </div>

              {assetForm.type !== "youtube" && (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-zinc-600">
                    Thumbnail (Opsional)
                  </Label>
                  <Input
                    type="file"
                    className="h-8 text-[11px] cursor-pointer bg-white"
                    accept="image/*"
                    onChange={(e) => uploadAssetThumbnail(e.target.files?.[0])}
                  />
                  <p className="text-[9px] text-zinc-400 leading-normal">
                    * Maksimal file: 5MB. Ekstensi: image/*
                  </p>
                  {assetForm.thumbnail_url && (
                    <img
                      src={assetForm.thumbnail_url}
                      alt="thumb"
                      className="mt-1.5 h-16 w-full rounded-md object-cover border border-zinc-200"
                    />
                  )}
                </div>
              )}
              {/* Ganti tombol "Upload Resource" jadi panel info, hapus addAsset standalone dari sini */}
              {assetForm.file_url && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-700 font-medium truncate">
                    Siap dilampirkan — klik <b>Simpan Lesson</b> di atas untuk
                    submit sekaligus.
                  </p>
                </div>
              )}
              {selectedLessonId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8 gap-1.5"
                  onClick={addAsset}
                  disabled={busyKey === "save-asset"}
                >
                  {busyKey === "save-asset" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Tambah Media Lain
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
