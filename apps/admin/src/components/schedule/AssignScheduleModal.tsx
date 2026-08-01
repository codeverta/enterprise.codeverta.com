import React, { useEffect, useMemo, useState } from "react";
import { Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleStudent, ScheduleTemplate } from "@/lib/schedule-api";

function studentName(student: ScheduleStudent) {
  const name = [student.first_name, student.last_name].filter(Boolean).join(" ");
  return student.display_name || name || student.username || student.email || student.id;
}

export default function AssignScheduleModal({
  template,
  students,
  loading,
  saving,
  onClose,
  onAssign,
}: {
  template: ScheduleTemplate;
  students: ScheduleStudent[];
  loading?: boolean;
  saving?: boolean;
  onClose: () => void;
  onAssign: (studentIds: string[]) => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected([]);
    setQuery("");
  }, [template.id]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter((student) =>
      [studentName(student), student.email, student.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, students]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Send className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-950">Assign: {template.title}</h2>
            <p className="text-xs text-slate-500">Item template akan dicopy menjadi jadwal personal partner.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Cari partner..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Memuat partner...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Tidak ada partner.</div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {filtered.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(student.id)} onChange={() => toggle(student.id)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{studentName(student)}</p>
                    <p className="truncate text-xs text-slate-500">{student.email || student.username || student.id}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3">
          <p className="text-xs text-slate-500">{selected.length} partner dipilih</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="button" disabled={saving || selected.length === 0} onClick={() => onAssign(selected)}>
              {saving ? "Assigning..." : "Assign Template"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
