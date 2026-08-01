import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Star, X } from "lucide-react";

function GradeModal({
  gradeModal,
  onClose,
  onGradeSubmit,
  grading,
}: {
  gradeModal: any;
  onClose: () => void;
  onGradeSubmit: (score: string, feedback: string) => void;
  grading: boolean;
}) {
  // Isolasi state input langsung di dalam modal (local state)
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  // Sinkronisasi data ketika modal dibuka dengan data assignment baru
  useEffect(() => {
    if (gradeModal) {
      setScore(gradeModal.score?.toString() || "");
      setFeedback(gradeModal.feedback || "");
    }
  }, [gradeModal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Nilai Tugas</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-2 text-sm text-slate-600">
          Partner:{" "}
          <span className="font-semibold">
            {gradeModal.student?.email || gradeModal.student_id}
          </span>
        </div>
        <div className="mb-4 text-sm text-slate-600">
          File:{" "}
          <a
            href={
              gradeModal.file_url?.startsWith("http")
                ? gradeModal.file_url
                : `${
                    import.meta.env.VITE_COS_CDN_BASE_URL ||
                    "https://cdn.codeverta.com"
                  }/${gradeModal.file_url}`
            }
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            {gradeModal.file_name}
          </a>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nilai (0 – {gradeModal.max_score})
            </label>
            <input
              type="number"
              min={0}
              max={gradeModal.max_score}
              step={0.5}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Masukkan nilai"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              rows={3}
              placeholder="Berikan feedback untuk partner..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button
              onClick={() => onGradeSubmit(score, feedback)}
              disabled={!score || grading}
            >
              {grading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Star className="mr-2 h-4 w-4" />
              )}
              Simpan Nilai
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GradeModal;
