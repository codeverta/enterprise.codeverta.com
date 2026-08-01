// QuizResultPage.jsx — Student View Evaluasi Hasil Kuis

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router";
import {
  CheckCircle2,
  Clock,
  FileQuestion,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import MarkdownView from "@/components/course-editor/MarkdownView";

const getData = (res) => res.data?.data || res.data || null;

function QuizResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: quizId } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  const fromCourseId = location.state?.fromCourseId || result?.quiz?.course?.id || result?.quiz?.course_id;
  const fromCourseTitle = location.state?.fromCourseTitle || result?.quiz?.course?.title;

  useEffect(() => {
    if (!attemptId) {
      toast.error("ID Attempt tidak ditemukan di URL");
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get(`/lms/quiz-attempts/${attemptId}/result`)
      .then((res) => {
        const data = getData(res);
        setResult(data);
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Gagal memuat hasil evaluasi kuis"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [attemptId]);

  useEffect(() => {
    if (result?.quiz?.title) {
      document.title = `Hasil: ${result.quiz.title} | Dashboard LMS`;
    } else {
      document.title = "Hasil Kuis | Dashboard LMS";
    }
  }, [result?.quiz?.title]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <p className="text-slate-600 font-medium">
          Data hasil pengerjaan kuis tidak dapat ditemukan.
        </p>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => navigate("/dashboard/quizzes")}
        >
          Kembali ke Daftar Kuis
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Breadcrumb Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:text-slate-900 transition font-medium"
          >
            Dashboard
          </button>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          {fromCourseId ? (
            <>
              <button
                onClick={() => navigate(`/dashboard/courses/${fromCourseId}`)}
                className="hover:text-slate-900 font-medium text-slate-700 max-w-[180px] truncate transition"
              >
                {fromCourseTitle || "Kursus"}
              </button>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/dashboard/quizzes")}
                className="hover:text-slate-900 font-medium text-slate-700 transition"
              >
                Daftar Kuis
              </button>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </>
          )}
          {(quizId || result?.quiz?.id) && (
            <>
              <button
                onClick={() =>
                  navigate(`/dashboard/quizzes/${quizId || result?.quiz?.id}`, {
                    state: { fromCourseId, fromCourseTitle },
                  })
                }
                className="hover:text-slate-900 font-medium text-slate-700 max-w-[180px] truncate transition"
              >
                {result?.quiz?.title || "Detail Kuis"}
              </button>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </>
          )}
          <span className="font-semibold text-slate-900">
            Hasil Evaluasi
          </span>
        </div>

        {/* Back Button */}
        <button
          className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
          onClick={() => {
            const targetQuizId = quizId || result?.quiz?.id;
            if (targetQuizId) {
              navigate(`/dashboard/quizzes/${targetQuizId}`, {
                state: { fromCourseId, fromCourseTitle },
              });
            } else if (fromCourseId) {
              navigate(`/dashboard/courses/${fromCourseId}`);
            } else {
              navigate("/dashboard/quizzes");
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Detail Kuis
        </button>

        {/* Header Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-1">
            {result.quiz?.title || "Evaluasi Kuis"}
          </span>
          <h2 className="text-2xl font-bold text-slate-900">
            Hasil Analisis Jawaban
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label="Skor Perolehan"
              value={`${Number(result.score || 0).toFixed(1)}%`}
              className={cn(
                result.status === "passed"
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-900"
                  : "bg-rose-50/50 border-rose-100 text-rose-900"
              )}
            />
            <Metric
              label="Status Kelulusan"
              value={result.status === "passed" ? "Lulus" : "Tidak Lulus"}
              className={cn(
                result.status === "passed"
                  ? "text-emerald-700 font-bold"
                  : "text-rose-700 font-bold"
              )}
            />
            <Metric
              label="Percobaan Ke"
              value={`#${result.attempt_number || 1}`}
            />
            <Metric
              label="Durasi Pengerjaan"
              value={formatTime(result.duration_sec)}
            />
          </div>
        </div>

        {/* Question Review List */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1">
            Review Soal & Kunci Jawaban
          </h3>

          {result.answers && result.answers.length > 0 ? (
            result.answers.map((ans, idx) => {
              const question = ans.question;
              // Decode selected options array dari JSON database
              let selectedOptions = [];
              try {
                selectedOptions =
                  typeof ans.selected_option_ids === "string"
                    ? JSON.parse(ans.selected_option_ids)
                    : ans.selected_option_ids || [];
              } catch (e) {
                selectedOptions = [];
              }

              return (
                <div
                  key={ans.id}
                  className={cn(
                    "rounded-xl border bg-white p-5 shadow-sm transition relative overflow-hidden",
                    ans.is_correct
                      ? "border-l-4 border-l-emerald-500"
                      : "border-l-4 border-l-rose-500"
                  )}
                >
                  {/* Question Header Status */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className="font-medium text-slate-500 text-sm shrink-0">
                      Soal {idx + 1}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full text-xs font-bold px-2.5 py-0.5",
                        ans.is_correct
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      )}
                    >
                      {ans.is_correct ? "Benar" : "Salah"}
                    </span>
                  </div>

                  <div className="mb-4 text-base font-semibold leading-relaxed text-slate-900">
                    <MarkdownView content={question?.question_text} />
                  </div>

                  {/* Answer Type Rendering */}
                  {question?.question_type === "short_answer" ? (
                    <div className="space-y-2 text-sm">
                      <div className="rounded-lg border p-3 bg-slate-50">
                        <span className="text-xs text-slate-400 block mb-0.5">
                          Jawaban Kamu:
                        </span>
                        <p className="font-medium text-slate-800">
                          {ans.answer_text || "— (Kosong)"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-100 p-3 bg-emerald-50/40">
                        <span className="text-xs text-emerald-600 block mb-0.5">
                          Kunci Jawaban Benar:
                        </span>
                        <p className="font-semibold text-emerald-800">
                          {question.options?.find((o) => o.is_correct)
                            ?.option_text || "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Choice Options Rendering */
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(question?.options || []).map((opt) => {
                        const isChosen =
                          selectedOptions.includes(opt.id.toString()) ||
                          selectedOptions.includes(opt.id);
                        const isCorrectOption = opt.is_correct;

                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "rounded-lg border p-3 text-sm flex flex-col justify-center transition-all",
                              // Kondisi kombinasi warna styling opsi jawaban
                              isCorrectOption
                                ? "border-emerald-300 bg-emerald-50/60 text-emerald-900 font-medium"
                                : isChosen && !isCorrectOption
                                ? "border-rose-200 bg-rose-50/50 text-rose-900"
                                : "border-slate-200 bg-slate-50/30 text-slate-700"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 font-bold">
                                {isCorrectOption ? "✓" : isChosen ? "✗" : "•"}
                              </span>
                              <div>
                                <p>{opt.option_text}</p>
                                {isChosen && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider block mt-1 text-slate-400">
                                    Pilihan Kamu
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation Section */}
                  {question?.explanation && (
                    <div className="mt-4 rounded-lg bg-blue-50/60 border border-blue-100 p-3.5 text-xs text-blue-900 leading-relaxed">
                      <p className="font-bold text-blue-950 mb-1">
                        Penjelasan Solusi:
                      </p>
                      <MarkdownView content={question.explanation} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500 bg-white">
              Tidak ada detail riwayat butir soal yang terekam.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Metric({ label, value, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-slate-50/50 p-3.5",
        className
      )}
    >
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function formatTime(totalSec) {
  const s = Number(totalSec || 0);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds} detik`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default DashboardLayout(QuizResultPage);
