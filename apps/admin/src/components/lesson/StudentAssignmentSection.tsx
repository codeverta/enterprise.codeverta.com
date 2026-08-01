import React, { useCallback, useState } from "react";
import {
  Award,
  Loader2,
  Download,
  Upload,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Reusable File Drop Zone ───────────────────────────────────────────────

function FileDropZone({
  fileInputRef,
  selectedFile,
  onFileSelect,
  onClear,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png",
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  accept?: string;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file || !fileInputRef.current) return;
      // Inject into the hidden input via DataTransfer so onFileSelect fires correctly
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    },
    [fileInputRef]
  );

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
      pdf: "text-red-500",
      doc: "text-blue-600",
      docx: "text-blue-600",
      xls: "text-emerald-600",
      xlsx: "text-emerald-600",
      jpg: "text-violet-500",
      jpeg: "text-violet-500",
      png: "text-violet-500",
    };
    return colorMap[ext ?? ""] ?? "text-slate-500";
  };

  return (
    <div className="space-y-2">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={onFileSelect}
        className="sr-only"
        id="assignment-file-input"
      />

      {selectedFile ? (
        /* ── Selected state ── */
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <FileText
            className={cn(
              "h-8 w-8 flex-shrink-0",
              getFileIcon(selectedFile.name)
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-400">
              {formatBytes(selectedFile.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            aria-label="Hapus file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* ── Drop zone ── */
        <label
          htmlFor="assignment-file-input"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 transition-colors",
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              dragging ? "bg-blue-100" : "bg-white shadow-sm"
            )}
          >
            <Upload
              className={cn(
                "h-5 w-5 transition-colors",
                dragging ? "text-blue-500" : "text-slate-400"
              )}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              {dragging ? "Lepaskan file di sini" : "Tarik file ke sini atau"}{" "}
              {!dragging && (
                <span className="text-blue-600 hover:underline">
                  pilih file
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
            </p>
          </div>
        </label>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

function StudentAssignmentSection({
  assignmentLoading,
  myAssignment,
  fileInputRef,
  handleFileSelect,
  selectedFile,
  uploading,
  handleSubmitAssignment,
  assignmentNote,
  setAssignmentNote,
  onClearFile,
}: {
  assignmentLoading: boolean;
  myAssignment: {
    file_name: string;
    file_url: string;
    note?: string;
    status: "submitted" | "graded" | "returned";
    score?: number;
    max_score?: number;
    feedback?: string;
    created_at: string;
    graded_at?: string;
  } | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFile: File | null;
  uploading: boolean;
  handleSubmitAssignment: () => void;
  assignmentNote: string;
  setAssignmentNote: React.Dispatch<React.SetStateAction<string>>;
  /** Call this to clear selectedFile state in parent */
  onClearFile: () => void;
}) {
  const statusConfig = {
    graded: { label: "Dinilai", className: "bg-emerald-100 text-emerald-700" },
    returned: {
      label: "Dikembalikan",
      className: "bg-amber-100 text-amber-700",
    },
    submitted: { label: "Terkirim", className: "bg-blue-100 text-blue-700" },
  };

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold text-slate-900">Tugas / Assignment</h3>
      </div>

      {/* Loading */}
      {assignmentLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data tugas...
        </div>
      ) : myAssignment ? (
        /* ── Has submission ── */
        <div className="space-y-3">
          {/* Submission card */}
          <div
            className={cn(
              "rounded-xl border p-4",
              myAssignment.status === "graded"
                ? "border-emerald-200 bg-emerald-50"
                : "border-blue-200 bg-blue-50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <span className="truncate">{myAssignment.file_name}</span>
                </p>
                {myAssignment.note && (
                  <p className="mt-1 text-xs text-slate-600">
                    Catatan: {myAssignment.note}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Dikirim:{" "}
                  {dayjs(myAssignment.created_at).format("DD MMM YYYY, HH:mm")}
                </p>
              </div>
              <span
                className={cn(
                  "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                  statusConfig[myAssignment.status].className
                )}
              >
                {statusConfig[myAssignment.status].label}
              </span>
            </div>

            {/* Grade block */}
            {myAssignment.status === "graded" && (
              <div className="mt-3 border-t border-emerald-200 pt-3 space-y-1">
                <div className="flex items-baseline gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-700">
                    {myAssignment.score}
                  </span>
                  <span className="text-sm text-slate-400">
                    / {myAssignment.max_score}
                  </span>
                </div>
                {myAssignment.feedback && (
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Feedback: </span>
                    {myAssignment.feedback}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  Dinilai:{" "}
                  {dayjs(myAssignment.graded_at).format("DD MMM YYYY, HH:mm")}
                </p>
              </div>
            )}

            {/* Download link */}
            <a
              href={
                myAssignment.file_url?.startsWith("http")
                  ? myAssignment.file_url
                  : `${
                      import.meta.env.VITE_COS_CDN_BASE_URL ||
                      "https://cdn.codeverta.com"
                    }/${myAssignment.file_url}`
              }
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Lihat File
            </a>
          </div>

          {/* Resubmit */}
          {myAssignment.status !== "graded" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500">
                Kirim ulang tugas:
              </p>
              <FileDropZone
                fileInputRef={fileInputRef}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onClear={onClearFile}
              />
              <Button
                size="sm"
                disabled={!selectedFile || uploading}
                onClick={handleSubmitAssignment}
                className="w-full sm:w-auto"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-3.5 w-3.5" />
                )}
                Kirim Ulang
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ── No submission yet ── */
        <div className="space-y-3">
          <FileDropZone
            fileInputRef={fileInputRef}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onClear={onClearFile}
          />

          <textarea
            placeholder="Catatan untuk pengajar (opsional)"
            value={assignmentNote}
            onChange={(e) => setAssignmentNote(e.target.value)}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            rows={2}
          />

          <Button
            disabled={!selectedFile || uploading}
            onClick={handleSubmitAssignment}
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Kirim Tugas
          </Button>
        </div>
      )}
    </section>
  );
}

export default StudentAssignmentSection;
