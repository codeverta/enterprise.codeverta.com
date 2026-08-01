// QuizViewerPage.jsx — Student-only Quiz List View

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Clock,
  FileQuestion,
  Loader2,
  Eye,
  BookOpen,
  Trophy,
  ChevronRight,
  ClipboardList,
  Sparkles,
  LockKeyhole,
  Search,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

const getData = (res) => res.data?.data || res.data || [];

// ── Small presentational helper: circular score ring ─────────────────────────
function ScoreRing({ score, passed }) {
  const size = 52;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const offset = circumference - (clamped / 100) * circumference;
  const ringColor = passed ? "#1EA97C" : "#F2994A";

  return (
    <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EDEEF7"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-slate-800">
        {score}
      </span>
    </div>
  );
}

function QuizViewerPage({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id: routeQuizId } = useParams();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");

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

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openQuizDetail = async (item) => {
    const quiz = item.quiz || item;
    const access = item.access || {};
    if (access.has_access === false || item.has_access === false) {
      const course = access.required_course || quiz.course;
      toast.info(
        course?.title
          ? `Anda harus mengikuti course ${course.title} untuk memulai quiz ini.`
          : "Anda belum memiliki akses untuk memulai quiz ini."
      );
      if (course?.id) {
        navigate(`/dashboard/courses/${course.id}`);
      }
      return;
    }
    try {
      const res = await api.get(`/lms/quizzes/${quiz.id}`);
      const payload = getData(res);
      navigate(`/dashboard/quizzes/${quiz.id}`);
    } catch {
      toast.error(t("quizzes.toast.detail_error"));
    }
  };

  // ── Derived summary stats (presentational only) ───────────────────────────────
  const stats = useMemo(() => {
    const total = quizzes.length;
    const passed = quizzes.filter((q) => q.progress?.is_passed).length;
    const taken = quizzes.filter(
      (q) =>
        q.progress?.best_score !== undefined && q.progress?.best_score !== null
    ).length;
    return { total, passed, taken };
  }, [quizzes]);

  const courseOptions = useMemo(() => {
    const map = new Map();
    quizzes.forEach((item) => {
      const quiz = item.quiz || item;
      const course = item.access?.required_course || quiz.course;
      if (course?.id && course?.title) {
        map.set(course.id, course.title);
      }
    });
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quizzes.filter((item) => {
      const quiz = item.quiz || item;
      const course = item.access?.required_course || quiz.course;
      const hasAccess = item.access?.has_access !== false && item.has_access !== false;
      const score = item.progress?.best_score;
      const isPassed = item.progress?.is_passed;
      const hasScore = score !== undefined && score !== null;

      const searchText = [
        quiz.title,
        quiz.description,
        course?.title,
        quiz.module?.title,
        quiz.lesson?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchText.includes(q);
      const matchesAccess =
        accessFilter === "all" ||
        (accessFilter === "open" && hasAccess) ||
        (accessFilter === "locked" && !hasAccess);
      const matchesCourse =
        courseFilter === "all" || String(course?.id || "") === courseFilter;
      const matchesProgress =
        progressFilter === "all" ||
        (progressFilter === "not_taken" && !hasScore) ||
        (progressFilter === "taken" && hasScore) ||
        (progressFilter === "passed" && isPassed) ||
        (progressFilter === "failed" && hasScore && !isPassed);

      return matchesSearch && matchesAccess && matchesCourse && matchesProgress;
    });
  }, [quizzes, search, accessFilter, courseFilter, progressFilter]);

  const resetFilters = () => {
    setSearch("");
    setAccessFilter("all");
    setCourseFilter("all");
    setProgressFilter("all");
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#F6F7FC]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
        <p className="text-sm font-medium text-slate-400">
          {t("quizzes.loading") || "Memuat kuis..."}
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: LIST
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F6F7FC]">
      {/* Load friendly display + body fonts, self-contained */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .qz-heading { font-family: 'Baloo 2', 'Inter', sans-serif; }
      `}</style>

      <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-500 px-5 py-7 shadow-md sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-14 right-16 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute left-1/2 top-2 h-16 w-16 rounded-full bg-white/5" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="qz-heading truncate text-2xl font-extrabold text-white sm:text-3xl">
                {t("quizzes.title")}
              </h1>
              <p className="mt-0.5 text-sm text-indigo-100">
                {t("quizzes.subtitle")}
              </p>
            </div>
          </div>

          {/* Stat pills */}
          <div className="relative mt-6 flex flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {stats.total} {t("quizzes.title")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {stats.passed}{" "}
                {t("quizzes.best_score")?.split("{")[0]?.trim() || "lulus"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <FileQuestion className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {stats.taken}/{stats.total}{" "}
                {t("quizzes.not_taken")?.split(" ")[0] || "dikerjakan"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <LockKeyhole className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {
                  quizzes.filter(
                    (item) =>
                      item.access?.has_access === false ||
                      item.has_access === false
                  ).length
                }{" "}
                terkunci
              </span>
            </div>
          </div>
        </div>

        {/* ── Search & Filter ────────────────────────────────────────────── */}
        <Card className="p-4 rounded-2xl">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_220px_180px_auto]">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari quiz, course, module..."
                className="h-10 pl-9 rounded-xl"
              />
            </div>

            {/* Access Filter */}
            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Semua Akses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Akses</SelectItem>
                <SelectItem value="open">Bisa Dikerjakan</SelectItem>
                <SelectItem value="locked">Terkunci</SelectItem>
              </SelectContent>
            </Select>

            {/* Course Filter */}
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Semua Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Course</SelectItem>
                {courseOptions.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Progress Filter */}
            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Semua Progress" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Progress</SelectItem>
                <SelectItem value="not_taken">Belum dikerjakan</SelectItem>
                <SelectItem value="taken">Sudah dikerjakan</SelectItem>
                <SelectItem value="passed">Lulus</SelectItem>
                <SelectItem value="failed">Belum lulus</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset Button */}
            {(search ||
              accessFilter !== "all" ||
              courseFilter !== "all" ||
              progressFilter !== "all") && (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="h-10 gap-2 rounded-xl"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </Card>

        {/* ── List / Grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredQuizzes.map((item) => {
            const quiz = item.quiz || item;
            const access = item.access || {};
            const hasAccess =
              access.has_access !== false && item.has_access !== false;
            const requiredCourse = access.required_course || quiz.course;
            const requiredPlans = Array.isArray(access.required_plans)
              ? access.required_plans
              : [];
            const isPassed = item.progress?.is_passed;
            const score = item.progress?.best_score;
            const bestAttemptId = item.progress?.best_attempt_id;
            const attemptsUsed = item.attempts_used || 0;
            const hasScore = score !== undefined && score !== null;

            const accentColor = !hasScore
              ? "bg-slate-300"
              : isPassed
              ? "bg-emerald-400"
              : "bg-amber-400";
            const finalAccentColor = hasAccess ? accentColor : "bg-slate-400";

            const iconBg = !hasScore
              ? "bg-slate-100 text-slate-500"
              : isPassed
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600";
            const finalIconBg = hasAccess
              ? iconBg
              : "bg-slate-100 text-slate-500";

            return (
              <div
                key={quiz.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl bg-white p-4 pl-5 shadow-sm ring-1 ring-slate-900/5 transition duration-200 sm:p-5 sm:pl-6",
                  hasAccess
                    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-200"
                    : "border border-slate-200 bg-slate-50/80"
                )}
                onClick={() => openQuizDetail(item)}
              >
                {/* status accent bar */}
                <span
                  className={cn(
                    "absolute left-0 top-0 h-full w-1.5",
                    finalAccentColor
                  )}
                />
                {!hasAccess && (
                  <div className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    <LockKeyhole className="mr-1 inline h-3 w-3" />
                    Terkunci
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        finalIconBg
                      )}
                    >
                      {hasAccess ? (
                        <BookOpen className="h-5 w-5" />
                      ) : (
                        <LockKeyhole className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 pr-20">
                      <h3 className="qz-heading truncate text-[15px] font-bold text-slate-900 transition group-hover:text-indigo-600 sm:text-base">
                        {quiz.title}
                      </h3>

                      {(quiz.course?.title ||
                        quiz.module?.title ||
                        quiz.lesson?.title) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                          {quiz.course?.title && (
                            <span className="font-medium text-slate-500">
                              {quiz.course.title}
                            </span>
                          )}
                          {quiz.module?.title && (
                            <>
                              <span>·</span>
                              <span>{quiz.module.title}</span>
                            </>
                          )}
                          {quiz.lesson?.title && (
                            <>
                              <span>·</span>
                              <span>{quiz.lesson.title}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score ring or "not taken" badge */}
                  {hasScore ? (
                    <ScoreRing score={score} passed={isPassed} />
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {t("quizzes.not_taken")}
                    </span>
                  )}
                </div>

                {quiz.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                    {quiz.description}
                  </p>
                )}

                {!hasAccess && (
                  <div
                    className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p>
                      Anda harus mengikuti course{" "}
                      {requiredCourse?.id ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/dashboard/courses/${requiredCourse.id}`)
                          }
                          className="font-extrabold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                        >
                          {requiredCourse.title}
                        </button>
                      ) : (
                        <span className="font-extrabold">terkait</span>
                      )}{" "}
                      untuk memulai quiz ini.
                    </p>
                    {requiredPlans.length > 0 ? (
                      <p className="mt-1.5">
                        Anda belum berlangganan paket yang mencakup course ini.
                        Paket yang tersedia:{" "}
                        <span className="font-bold">
                          {requiredPlans.map((plan) => plan.name).join(", ")}
                        </span>
                        .
                      </p>
                    ) : (
                      <p className="mt-1.5">
                        Course ini belum termasuk dalam akses Anda saat ini.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {requiredCourse?.id && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/dashboard/courses/${requiredCourse.id}`)
                          }
                          className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100 transition hover:bg-indigo-50"
                        >
                          Lihat Course
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (access.can_buy_course && requiredCourse?.id) {
                            navigate(
                              `/dashboard/courses/${requiredCourse.id}/checkout`
                            );
                          } else {
                            navigate("/dashboard/subscriptions");
                          }
                        }}
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
                      >
                        {access.can_buy_course
                          ? "Beli Course"
                          : "Berlangganan Paket"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {quiz.time_limit_min || "–"} {t("quizzes.minutes")}
                    </span>
                    <span className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                      <FileQuestion className="h-3.5 w-3.5 text-slate-400" />
                      {item.question_count ?? 0} {t("quizzes.questions")}
                    </span>
                    <span className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-600">
                      {attemptsUsed} / {quiz.max_attempts}
                    </span>
                  </div>

                  {/* Redirection Info to Result Page */}
                  {hasAccess && hasScore && bestAttemptId && (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation(); // Mencegah terpicunya klik detail card utama
                        navigate(
                          `/dashboard/quizzes/${quiz.id}/result?attemptId=${bestAttemptId}`
                        );
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      {t("quizzes.view_result")}
                    </button>
                  )}

                  {hasAccess && !hasScore && (
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-500 opacity-0 transition group-hover:opacity-100">
                      {t("quizzes.title")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredQuizzes.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <ClipboardList className="h-7 w-7 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {quizzes.length === 0
                  ? t("quizzes.empty")
                  : "Tidak ada quiz yang cocok dengan filter."}
              </p>
              {quizzes.length > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Reset Filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout(QuizViewerPage);
