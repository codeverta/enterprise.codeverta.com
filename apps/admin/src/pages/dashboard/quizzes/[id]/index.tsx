// QuizDetailPage.jsx — student-only view, fully refactored

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { CheckCircle2, Clock, FileQuestion, Loader2, Play, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const getData = (res) => res.data?.data || res.data || [];

// ─── Screens ──────────────────────────────────────────────────────────────────
// "list"    → daftar quiz
// "detail"  → info + tombol mulai
// "attempt" → pengerjaan soal (focus mode)
// "result"  → hasil nilai

function QuizDetailPage({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeQuizId } = useParams();
  const [screen, setScreen] = useState("list"); // "list" | "detail" | "attempt" | "result"
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null); // full payload from API
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [attempts, setAttempts] = useState([]);

  const quizPayload = selectedQuiz?.quiz || selectedQuiz;
  const fromCourseId = location.state?.fromCourseId || quizPayload?.course?.id || quizPayload?.course_id;
  const fromCourseTitle = location.state?.fromCourseTitle || quizPayload?.course?.title;

  const questions = quizPayload?.questions || [];
  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + Number(q.points || 0), 0),
    [questions]
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isAnswered = (qId) => {
    const v = answers[qId];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  };

  const answeredCount = questions.filter((q) => isAnswered(q.id)).length;

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/lms/quizzes", { params: { limit: 100 } });
      const list = getData(res);
      setQuizzes(list);
      if (routeQuizId) openQuizDetail({ id: routeQuizId });
    } catch {
      toast.error(t("quizzes.toast.load_error"));
    } finally {
      setLoading(false);
    }
  }, [routeQuizId, t]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // ── Timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!attempt || !quizPayload?.time_limit_min) return;
    const startedAt = new Date(attempt.started_at).getTime();
    const total = Number(quizPayload.time_limit_min) * 60;
    const tick = () =>
      setRemainingSec(
        Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000))
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt?.id, quizPayload?.time_limit_min]);

  // ── Document Title ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (quizPayload?.title) {
      document.title = `${quizPayload.title} | Dashboard LMS`;
    } else {
      document.title = "Kuis | Dashboard LMS";
    }
  }, [quizPayload?.title]);

  // ── Auto-submit on timer end ─────────────────────────────────────────────────
  useEffect(() => {
    if (remainingSec === 0 && attempt) {
      toast.warning(t("quizzes.toast.time_out"));
      submitAttempt(true);
    }
  }, [remainingSec, attempt]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openQuizDetail = async (item) => {
    const quiz = item.quiz || item;
    try {
      const res = await api.get(`/lms/quizzes/${quiz.id}`);
      const payload = getData(res);
      setSelectedQuiz(payload);
      setAttempt(null);
      setResult(null);
      setAnswers({});
      setCurrentQIdx(0);
      setScreen("detail");

      // Fetch all attempts for this quiz
      try {
        const attRes = await api.get(`/lms/quizzes/${quiz.id}/attempts`);
        setAttempts(getData(attRes));
      } catch (err) {
        console.error("Failed to load attempts", err);
      }
    } catch {
      toast.error(t("quizzes.toast.detail_error"));
    }
  };

  const startAttempt = async () => {
    try {
      const res = await api.post(`/lms/quizzes/${quizPayload.id}/start`);
      const payload = getData(res);
      setAttempt(payload.attempt);
      setSelectedQuiz({ quiz: payload.quiz });
      setResult(null);
      setAnswers({});
      setCurrentQIdx(0);
      navigate(
        `/dashboard/quizzes/${routeQuizId}/attempt?attemptId=${payload.attempt.id}&q=0`,
        { state: { fromCourseId, fromCourseTitle } }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || t("quizzes.toast.start_error"));
    }
  };

  // ── Answer helpers ────────────────────────────────────────────────────────────
  const setAnswer = (qId, value) =>
    setAnswers((prev) => ({ ...prev, [qId]: value }));

  const persistAnswer = async (question) => {
    if (!attempt?.id) return;
    const value = answers[question.id];
    const isText = question.question_type === "short_answer";
    try {
      await api.post(`/lms/quiz-attempts/${attempt.id}/answers`, {
        question_id: question.id,
        selected_option_ids: isText
          ? []
          : Array.isArray(value)
          ? value
          : value
          ? [value]
          : [],
        answer_text: isText ? value || "" : "",
      });
    } catch {
      // silent — local state is source of truth
    }
  };

  // ── Navigation (auto-save on move) ────────────────────────────────────────────
  const navigateTo = async (nextIdx) => {
    await persistAnswer(questions[currentQIdx]); // auto-save current soal
    setCurrentQIdx(nextIdx);
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: DETAIL (pre-start)
  // ─────────────────────────────────────────────────────────────────────────────
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Breadcrumbs */}
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
                  className="hover:text-slate-900 font-medium text-slate-700 max-w-[220px] truncate transition"
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
            <span className="font-semibold text-slate-900 max-w-[220px] truncate">
              {quizPayload?.title || "Kuis"}
            </span>
          </div>

          {/* Back button */}
          <button
            className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
            onClick={() => {
              if (fromCourseId) {
                navigate(`/dashboard/courses/${fromCourseId}`);
              } else {
                navigate("/dashboard/quizzes");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {fromCourseId
              ? `Kembali ke ${fromCourseTitle || "Course"}`
              : t("quizzes.detail.back")}
          </button>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              {quizPayload?.title}
            </h2>

            {/* Course, Module, Lesson Details */}
            {(quizPayload?.course?.title || quizPayload?.module?.title || quizPayload?.lesson?.title) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                {quizPayload?.course?.title && (
                  <span className="font-semibold text-slate-600">
                    {quizPayload.course.title}
                  </span>
                )}
                {quizPayload?.module?.title && (
                  <>
                    <span>·</span>
                    <span>{quizPayload.module.title}</span>
                  </>
                )}
                {quizPayload?.lesson?.title && (
                  <>
                    <span>·</span>
                    <span>{quizPayload.lesson.title}</span>
                  </>
                )}
              </div>
            )}

            <p className="mt-3 text-sm text-slate-500">
              {quizPayload?.description || t("quizzes.detail.no_desc")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                {quizPayload?.time_limit_min} {t("quizzes.detail.minutes")}
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
                {t("quizzes.detail.passing")} {quizPayload?.passing_score}%
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
                {t("quizzes.detail.questions_and_points").replace("{questions}", String(questions.length)).replace("{points}", String(totalPoints))}
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600 font-medium">
                Percobaan: {selectedQuiz?.attempts_used || 0} / {quizPayload?.max_attempts || 1}
              </span>
            </div>

            {/* Attempt History */}
            {attempts.length > 0 && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Riwayat Percobaan</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm text-slate-500">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="px-4 py-3">Percobaan Ke</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Nilai</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attempts.map((att) => {
                        const submitted = att.status === "passed" || att.status === "failed";
                        const passed = att.score >= (quizPayload?.passing_score || 70);
                        return (
                          <tr key={att.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-medium text-slate-950">
                              #{att.attempt_number}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {new Date(att.started_at).toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {Number(att.score).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 font-semibold",
                                  submitted
                                    ? passed
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                )}
                              >
                                {submitted ? (passed ? "Lulus" : "Tidak Lulus") : "Pengerjaan"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {submitted && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2.5"
                                  onClick={() =>
                                    navigate(
                                      `/dashboard/quizzes/${quizPayload.id}/result?attemptId=${att.id}`,
                                      { state: { fromCourseId, fromCourseTitle } }
                                    )
                                  }
                                >
                                  Lihat Hasil
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold mb-2">{t("quizzes.detail.instructions_title")}</p>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>{t("quizzes.detail.instruction1")}</li>
                <li>
                  {t("quizzes.detail.instruction2")}
                </li>
                <li>{t("quizzes.detail.instruction3")}</li>
                <li>{t("quizzes.detail.instruction4")}</li>
              </ul>
            </div>
            <div className="mt-5">
              {selectedQuiz?.attempts_left > 0 ? (
                <Button onClick={startAttempt} size="lg">
                  <Play className="mr-2 h-4 w-4" /> {t("quizzes.detail.start_btn")}
                </Button>
              ) : (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 font-medium">
                  Batas percobaan kuis ini telah habis. Kamu tidak dapat mengerjakan kuis ini lagi.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

}


export default DashboardLayout(QuizDetailPage);
