import React, { useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ScheduleTemplate } from "@/lib/schedule-api";

export default function ScheduleTemplateForm({
  template,
  onClose,
  onSubmit,
  saving,
}: {
  template?: ScheduleTemplate | null;
  onClose: () => void;
  onSubmit: (payload: { title: string; description?: string }) => Promise<void> | void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(template?.title || "");
  const [description, setDescription] = useState(template?.description || "");

  useEffect(() => {
    setTitle(template?.title || "");
    setDescription(template?.description || "");
  }, [template]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ title: title.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <CalendarPlus className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">
              {template ? "Edit Template Jadwal" : "Template Jadwal Baru"}
            </h2>
            <p className="text-xs text-slate-500">
              Template ini bisa diassign ke banyak siswa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label>Judul Template</Label>
            <Input
              value={title}
              placeholder="Contoh: Template Belajar Matematika"
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea
              value={description}
              placeholder="Template ini digunakan untuk jadwal belajar matematika."
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? "Menyimpan..." : "Simpan Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}
