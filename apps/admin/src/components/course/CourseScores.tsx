import React from 'react'
import { Award, Loader2 } from "lucide-react";


function CourseScores({
    hasLearningAccess,
    assignmentLoading,
    assignmentSummary,
    }: {
    hasLearningAccess: boolean;
    assignmentLoading: boolean;
    assignmentSummary: {
        total_lessons: number;
        submitted_count: number;
        graded_count: number;
        average_score: number | null;
        lessons: {
        lesson_id: string;
        lesson_title: string;
        status: "not_submitted" | "submitted" | "graded";
        score?: number;
        max_score?: number;
        feedback?: string;
        }[];
    } | null;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900">Assignment Scores</h2>
      {!hasLearningAccess ? (
        <p className="text-sm text-slate-500">
          Kamu perlu subscription aktif untuk melihat nilai tugas.
        </p>
      ) : assignmentLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat data penilaian...
        </div>
      ) : assignmentSummary ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {assignmentSummary.total_lessons}
              </p>
              <p className="text-xs text-slate-400">Total Lessons</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {assignmentSummary.submitted_count}
              </p>
              <p className="text-xs text-slate-400">Submitted</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {assignmentSummary.graded_count}
              </p>
              <p className="text-xs text-slate-400">Graded</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">
                {assignmentSummary.average_score?.toFixed(1) || "0"}%
              </p>
              <p className="text-xs text-slate-400">Average Score</p>
            </div>
          </div>

          {/* Per-lesson breakdown */}
          <div className="space-y-2">
            {assignmentSummary.lessons?.map((item) => (
              <div
                key={item.lesson_id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.lesson_title}
                  </p>
                  {item.status === "graded" && item.feedback && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      Feedback: {item.feedback}
                    </p>
                  )}
                </div>
                {item.status === "not_submitted" ? (
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Not submitted
                  </span>
                ) : item.status === "graded" ? (
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <Award className="h-3 w-3" />
                      {item.score}/{item.max_score}
                    </span>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-600">
                    Submitted
                  </span>
                )}
              </div>
            ))}
          </div>

          {assignmentSummary.lessons?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              Course ini belum memiliki lesson untuk penilaian tugas.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Tidak ada data penilaian tersedia.
        </p>
      )}
    </div>
  );
}

export default CourseScores