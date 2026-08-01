import React, {
    useState, useRef
} from 'react'
import { Bold, Italic, List as ListIcon, Image as ImageIcon, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

const getData = (res) => res.data?.data || res.data || {};

function ToolbarButton({ children, onClick, title, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

// ============================================================
// NOTE UPLOAD ENDPOINT:
// Diasumsikan sudah ada endpoint generik upload file di backend:
//   POST /lms/admin/upload  (multipart/form-data, field "file")
//   Response: { data: { url: "https://.../file.png" } }
// Kalau path / shape response berbeda di backend kamu, tinggal
// sesuaikan di fungsi `uploadImageFile` di bawah ini saja —
// semua pemanggil (toolbar question text & explanation) lewat
// fungsi ini jadi cukup ubah di satu tempat.
// ============================================================
async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`/admin/upload-image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const payload = getData(res);
  const url = payload?.url || payload?.file_url || payload?.path;
  if (!url) throw new Error("Upload response tidak mengandung url");
  return url;
}


// ============================================================
// Markdown editor: toolbar (bold/italic/list/image) + tab
// Write / Preview + drag&drop / paste image upload
// ============================================================
function MarkdownEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  uploadingLabel = "Mengunggah gambar...",
}) {
  const [tab, setTab] = useState("write"); // "write" | "preview"
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const wrapSelection = (before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const valStr = value || "";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = valStr.slice(start, end);
    const next =
      valStr.slice(0, start) + before + selected + after + valStr.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const insertAtCursor = (text) => {
    const el = textareaRef.current;
    const valStr = value || "";
    if (!el) {
      onChange(valStr + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = valStr.slice(0, start) + text + valStr.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.selectionStart = pos;
      el.selectionEnd = pos;
    });
  };

  const insertList = () => {
    const el = textareaRef.current;
    if (!el) return;
    const valStr = value || "";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = valStr.slice(start, end);
    const lines = (selected || "List item").split("\n");
    const listed = lines.map((l) => `- ${l}`).join("\n");
    const next = valStr.slice(0, start) + listed + valStr.slice(end);
    onChange(next);
  };

  const handleUploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadImageFile(file);
      insertAtCursor(`\n![${file.name}](${url})\n`);
      toast.success("Gambar berhasil diunggah");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Gagal mengunggah gambar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    handleUploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  };

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData?.items || []).find((i) =>
      i.type.startsWith("image/")
    );
    if (item) {
      e.preventDefault();
      const file = item.getAsFile();
      handleUploadFile(file);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            title="Bold"
            onClick={() => wrapSelection("**")}
            disabled={tab !== "write"}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            onClick={() => wrapSelection("_")}
            disabled={tab !== "write"}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="List"
            onClick={insertList}
            disabled={tab !== "write"}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Upload gambar"
            onClick={() => fileInputRef.current?.click()}
            disabled={tab !== "write" || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {tab === "write" ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={rows}
            value={value || ""}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onPaste={handlePaste}
            className="rounded-none border-0 focus-visible:ring-0 resize-y text-xs"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-zinc-600 font-medium gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {uploadingLabel}
            </div>
          )}
          <p className="px-2 pb-1 text-[10px] text-zinc-400">
            Tip: drag & drop atau paste gambar langsung di sini. Mendukung
            markdown & LaTeX (contoh: $x^2 + y^2 = z^2$).
          </p>
        </div>
      ) : (
        <div
          className="p-3 min-h-[80px] bg-white"
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          <MarkdownView content={value} />
        </div>
      )}
    </div>
  );
}


export default MarkdownEditor
