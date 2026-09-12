import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  GripVertical,
  Save,
  Trash2,
  Loader2,
  Award,
  ToggleLeft,
  ToggleRight,
  LayoutTemplate,
  Eye,
  ImagePlus,
  Type,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import CourseCertificate from "@/components/course/CourseCertificate";

interface CertificateTemplate {
  id?: string;
  course_id: string;
  is_enabled: boolean;
  template_url: string;
  name_x: number;
  name_y: number;
  name_font_size: number;
  name_color: string;
  course_title_x: number;
  course_title_y: number;
  date_x: number;
  date_y: number;
}

interface Props {
  courseId: string;
}

type PanelTab = "position" | "preview";

const DRAGGABLE_FIELDS = [
  {
    field: "name_x",
    label: "Nama Peserta",
    dotClass: "bg-blue-500",
    ringClass: "ring-blue-200",
  },
  {
    field: "course_title_x",
    label: "Judul Course",
    dotClass: "bg-emerald-500",
    ringClass: "ring-emerald-200",
  },
  {
    field: "date_x",
    label: "Tanggal",
    dotClass: "bg-purple-500",
    ringClass: "ring-purple-200",
  },
] as const;

function templateImageURL(url = "") {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const cdnBase =
    import.meta.env.VITE_COS_CDN_BASE_URL || "https://cdn.codeverta.com";
  return `${cdnBase.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export default function CertificateTemplateEditor({ courseId }: Props) {
  const [tpl, setTpl] = useState<CertificateTemplate>({
    course_id: courseId,
    is_enabled: false,
    template_url: "",
    name_x: 50,
    name_y: 40,
    name_font_size: 48,
    name_color: "#0F172A",
    course_title_x: 50,
    course_title_y: 55,
    date_x: 50,
    date_y: 70,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<PanelTab>("position");
  const [dirty, setDirty] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (courseId) {
      fetchTemplate();
    }
  }, [courseId]);

  const fetchTemplate = async () => {
    try {
      const res = await api.get(
        `/lms/admin/courses/${courseId}/certificate-template`
      );
      const data = res.data?.data || res.data;
      if (data) {
        setTpl(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!/image\/(jpeg|png)|application\/pdf/.test(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, atau PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("template", file);

    setUploading(true);
    try {
      const res = await api.post(
        `/lms/admin/courses/${courseId}/certificate-template/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const data = res.data?.data || res.data;
      setTpl((prev) => ({
        ...prev,
        template_url: data.template_url,
        is_enabled: true,
      }));
      setPreviewVersion((version) => version + 1);
      setActiveTab("position");
      toast.success("Template berhasil diupload!");
    } catch {
      toast.error("Gagal upload template");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/lms/admin/courses/${courseId}/certificate-template`, tpl);
      setPreviewVersion((version) => version + 1);
      setDirty(false);
      toast.success("Template tersimpan!");
    } catch {
      toast.error("Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Hapus template sertifikat?")) return;
    try {
      await api.delete(`/lms/admin/courses/${courseId}/certificate-template`);
      setTpl((prev) => ({
        ...prev,
        template_url: "",
        is_enabled: false,
      }));
      setPreviewVersion((version) => version + 1);
      toast.success("Template dihapus");
    } catch {
      toast.error("Gagal menghapus template");
    }
  };

  const handleDragStart = (field: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", field);
    setDragging(field);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);

    // A real file was dropped onto the editor (not a label being repositioned)
    if (e.dataTransfer.files?.length) {
      handleFileDrop(e);
      return;
    }

    const field = e.dataTransfer.getData("text/plain");
    if (!field || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (y / rect.height) * 100));

    if (field === "name_x") {
      setTpl((prev) => ({ ...prev, name_x: xPct, name_y: yPct }));
    } else if (field === "course_title_x") {
      setTpl((prev) => ({
        ...prev,
        course_title_x: xPct,
        course_title_y: yPct,
      }));
    } else if (field === "date_x") {
      setTpl((prev) => ({ ...prev, date_x: xPct, date_y: yPct }));
    }

    setDragging(null);
    setDirty(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setFileDragOver(true);
  };

  const handleDragLeaveContainer = () => setFileDragOver(false);

  const markDirty = <K extends keyof CertificateTemplate>(
    key: K,
    value: CertificateTemplate[K]
  ) => {
    setTpl((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Memuat template...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900">
            Template Sertifikat
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => markDirty("is_enabled", !tpl.is_enabled)}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            {tpl.is_enabled ? (
              <ToggleRight className="h-6 w-6 text-green-500" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-slate-400" />
            )}
            <span
              className={tpl.is_enabled ? "text-green-600" : "text-slate-500"}
            >
              {tpl.is_enabled ? "Aktif" : "Nonaktif"}
            </span>
          </button>
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            size="sm"
            className="min-w-[132px]"
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {dirty ? "Simpan Perubahan" : "Tersimpan"}
          </Button>
        </div>
      </div>

      {/* Main layout: settings on the left, live preview pinned on the right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
        {/* Left: settings panel */}
        <div className="space-y-4">
          {/* Upload card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-slate-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Berkas Template
              </h4>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {tpl.template_url ? "Ganti Template" : "Upload Template"}
              </Button>
              {tpl.template_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Format JPG, PNG, atau PDF halaman pertama. Kamu juga bisa menarik
              file langsung ke area preview di sebelah kanan.
            </p>
          </div>

          {/* Text settings card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Type className="h-4 w-4 text-slate-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gaya Teks Nama
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500">
                  Ukuran Font
                </label>
                <input
                  type="number"
                  value={tpl.name_font_size}
                  onChange={(e) =>
                    markDirty("name_font_size", parseInt(e.target.value) || 48)
                  }
                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">
                  Warna Teks
                </label>
                <div className="mt-0.5 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                  <input
                    type="color"
                    value={tpl.name_color}
                    onChange={(e) => markDirty("name_color", e.target.value)}
                    className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-[11px] text-slate-500">
                    {tpl.name_color}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Position readout */}
          {tpl.template_url && (
            <div className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Posisi Elemen
                </h4>
              </div>
              <div className="space-y-2">
                {DRAGGABLE_FIELDS.map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <span
                        className={cn("h-2 w-2 rounded-full", item.dotClass)}
                      />
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {Math.round((tpl as any)[item.field])}%,{" "}
                      {Math.round((tpl as any)[item.field.replace("_x", "_y")])}
                      %
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Buka tab "Posisi" di sebelah kanan, lalu seret label ke lokasi
                yang diinginkan pada template.
              </p>
            </div>
          )}
        </div>

        {/* Right: sticky live preview */}
        <div className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-xl border bg-white">
            {/* Tab switcher */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PanelTab)}>
              <TabsList className="flex h-auto items-center gap-1 rounded-none border-b bg-slate-50 p-1.5">
              <TabsTrigger value="position" className="flex-1 gap-1.5 rounded-lg px-3 py-1.5 text-xs">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Posisi
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!tpl.template_url} className="flex-1 gap-1.5 rounded-lg px-3 py-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Preview Sertifikat
              </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="p-3">
              {activeTab === "position" ? (
                tpl.template_url ? (
                  <div
                    ref={containerRef}
                    className="relative overflow-hidden rounded-lg border bg-slate-50"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeaveContainer}
                  >
                    <img
                      ref={imgRef}
                      src={templateImageURL(tpl.template_url)}
                      alt="Certificate Template"
                      className="w-full"
                      draggable={false}
                    />

                    {DRAGGABLE_FIELDS.map((item) => (
                      <div
                        key={item.field}
                        draggable
                        onDragStart={handleDragStart(item.field)}
                        className={cn(
                          "absolute z-20 flex cursor-grab select-none items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white shadow-lg active:cursor-grabbing",
                          item.dotClass,
                          dragging === item.field &&
                            "opacity-70 ring-2 ring-white"
                        )}
                        style={{
                          left: `${(tpl as any)[item.field] ?? 50}%`,
                          top: `${
                            (tpl as any)[item.field.replace("_x", "_y")] ?? 50
                          }%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <GripVertical className="h-3 w-3" />
                        {item.label}
                      </div>
                    ))}

                    {fileDragOver && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px]">
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow">
                          Lepaskan untuk mengganti template
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeaveContainer}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                      fileDragOver
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <Award className="h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-600">
                      Tarik file ke sini atau klik untuk upload
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      JPG, PNG, atau PDF halaman pertama — posisi teks bisa
                      diatur setelah upload
                    </p>
                  </div>
                )
              ) : (
                <CourseCertificate
                  key={`${courseId}-${previewVersion}`}
                  courseId={courseId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
