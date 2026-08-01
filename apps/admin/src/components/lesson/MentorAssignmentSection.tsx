import React from "react";
import { Award, Loader2, Star, Eye } from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";

function MentorAssignmentSection({
  assignmentLoading,
  lessonAssignments,
  setGradeModal,
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold text-slate-900">
          Tugas Partner / Student Assignments
        </h3>
      </div>

      {assignmentLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
        </div>
      ) : lessonAssignments.length === 0 ? (
        <p className="text-sm text-slate-500">
          Belum ada partner yang mengirim tugas untuk lesson ini.
        </p>
      ) : (
        <div className="space-y-3">
          {lessonAssignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {a.student?.email || a.student_id}
                </p>
                <p className="text-xs text-slate-500">File: {a.file_name}</p>
                {a.note && (
                  <p className="text-xs text-slate-400">Catatan: {a.note}</p>
                )}
                <p className="text-xs text-slate-400">
                  Dikirim: {dayjs(a.created_at).format("DD MMM YYYY, HH:mm")}
                </p>
                {a.status === "graded" && (
                  <div className="mt-1 flex items-center gap-2">
                    <Star className="h-3 w-3 text-amber-500" />
                    <span className="text-sm font-bold text-emerald-700">
                      {a.score}/{a.max_score}
                    </span>
                    {a.feedback && (
                      <span className="text-xs text-slate-500">
                        — {a.feedback}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2">
                <a
                  href={
                    a.file_url?.startsWith("http")
                      ? a.file_url
                      : `${
                          import.meta.env.VITE_COS_CDN_BASE_URL ||
                          "https://cdn.codeverta.com"
                        }/${a.file_url}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-3 w-3" /> Lihat
                </a>
                <Button
                  size="sm"
                  variant={a.status === "graded" ? "outline" : "default"}
                  onClick={() => setGradeModal(a)}
                >
                  {a.status === "graded" ? "Nilai Ulang" : "Nilai"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default MentorAssignmentSection;
