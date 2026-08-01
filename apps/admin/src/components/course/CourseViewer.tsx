import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import dayjs from "dayjs";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  BookOpen,
  Bold,
  ChevronRight,
  Eye,
  FileQuestion,
  Layers,
  Loader2,
  Users,
  Video,
  ArrowLeft,
  GripVertical,
  LockKeyhole,
  Plus,
} from "lucide-react";
import {
  Star,
  Clock,
  BarChart2,
  Globe,
  Award,
  Download,
  Share2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  Calendar,
  Play,
  Lock,
  ChevronDown,
} from "lucide-react";
import { Link as RouterLink } from "react-router";

import api from "@/lib/api";
import CourseCertificate from "@/components/course/CourseCertificate";
import { Button } from "@/components/ui/button";
import CourseScores from "./CourseScores";
import CourseReview from "./CourseReview";
import { markdownPreview } from "@/lib/utils"
import MarkdownView from "@/components/course-editor/MarkdownView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StatCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}


function ProgressBar({ percent = 0 }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function compactNumber(value = 0) {
  const number = Number(value || 0);
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return number.toLocaleString();
}

function LessonRow({ lesson, isSelected, isPreview, hasLearningAccess, onClick, isLocked }) {
  const canOpen = (hasLearningAccess || isPreview) && !isLocked;
  const isCompleted = !!lesson.is_completed;
  return (
    <button
      type="button"
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
        isLocked
          ? "opacity-50 cursor-not-allowed text-slate-400"
          : isSelected
          ? "bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-200"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : isLocked ? (
        <Lock className="h-4 w-4 shrink-0 text-slate-400 animate-pulse" />
      ) : canOpen ? (
        <Play className="h-4 w-4 shrink-0 text-blue-500" />
      ) : (
        <Lock className="h-4 w-4 shrink-0 text-slate-300" />
      )}
      <span className="flex-1 truncate">{lesson.title}</span>
      {isCompleted && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          Completed
        </span>
      )}
      {lesson.duration && (
        <span className="shrink-0 text-xs text-slate-400">
          {lesson.duration}
        </span>
      )}
      {isPreview && !hasLearningAccess && (
        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          Preview
        </span>
      )}
    </button>
  );
}

function QuizRow({ quiz, onClick, isLocked }) {
  const progress = quiz.progress || quiz.best_progress || {};
  const completed = !!progress.is_completed;
  return (
    <button
      type="button"
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
        isLocked
          ? "opacity-50 cursor-not-allowed text-slate-400"
          : "text-blue-700 hover:bg-blue-50"
      }`}
    >
      {completed ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : isLocked ? (
        <Lock className="h-4 w-4 shrink-0 text-slate-400" />
      ) : (
        <FileQuestion className="h-4 w-4 shrink-0 text-blue-500" />
      )}
      <span className="flex-1 truncate">{quiz.title}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isLocked ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-600"
      }`}>
        {completed ? "Completed" : "Quiz"}
      </span>
    </button>
  );
}

function ModuleAccordion({
  mod,
  lessons,
  quizzes = [],
  selectedLessonId,
  onSelectLesson,
  onSelectQuiz,
  hasLearningAccess,
  defaultOpen = false,
  course,
  allLessons = [],
}: {
  mod: any;
  lessons: any[];
  quizzes?: any[];
  selectedLessonId?: number;
  onSelectLesson: (lesson: any) => void;
  onSelectQuiz: (quiz: any) => void;
  hasLearningAccess: boolean;
  defaultOpen?: boolean;
  course?: any;
  allLessons?: any[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isStaff = Number(currentUser?.role || 0) >= 99 || (currentUser?.role === 30 && hasLearningAccess);
  const access = isStaff || hasLearningAccess;

  const completedCount = lessons.filter((l) => l.is_completed).length;
  const contentCount = lessons.length + quizzes.length;
  const moduleQuizzes = quizzes.filter((quiz) => !quiz.lesson_id);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {mod.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {lessons.length} lessons · {quizzes.length} quizzes · {completedCount}/{lessons.length}{" "}
            completed
          </p>
        </div>
        <div className="shrink-0 w-20">
          <ProgressBar
            percent={
              lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0
            }
          />
        </div>
        {lessons.length > 0 && completedCount === lessons.length && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Completed
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-2 space-y-1">
          {mod.description && (
            <div
              className="px-2 py-1.5 text-xs leading-5 text-slate-400 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: markdownPreview(mod.description) }}
            />
          )}
          {lessons.map((lesson) => {
            const lessonQuizzes = quizzes.filter(
              (quiz) => quiz.lesson_id === lesson.id
            );

            let isLocked = false;
            if (!isStaff && course && course.allow_skip === false) {
              const index = allLessons.findIndex((l) => l.id === lesson.id);
              if (index > 0) {
                for (let i = 0; i < index; i++) {
                  if (!allLessons[i].is_completed) {
                    isLocked = true;
                    break;
                  }
                }
              }
            }

            return (
              <React.Fragment key={lesson.id}>
                <LessonRow
                  lesson={lesson}
                  isSelected={selectedLessonId === lesson.id}
                  isPreview={lesson.is_preview}
                  hasLearningAccess={access}
                  onClick={() => onSelectLesson(lesson)}
                  isLocked={isLocked}
                />
                {lessonQuizzes.map((quiz) => (
                  <div key={quiz.id} className="ml-7">
                    <QuizRow
                      quiz={quiz}
                      onClick={() => onSelectQuiz(quiz)}
                      isLocked={isLocked}
                    />
                  </div>
                ))}
              </React.Fragment>
            );
          })}
          {moduleQuizzes.map((quiz) => {
            let isLocked = false;
            if (!isStaff && course && course.allow_skip === false) {
              isLocked = lessons.some((l) => !l.is_completed);
              if (!isLocked && lessons.length > 0) {
                const lastLesson = lessons[lessons.length - 1];
                if (lastLesson) {
                  const idx = allLessons.findIndex((l) => l.id === lastLesson.id);
                  for (let i = 0; i <= idx; i++) {
                    if (!allLessons[i].is_completed) {
                      isLocked = true;
                      break;
                    }
                  }
                }
              }
            }
            return (
              <QuizRow
                key={quiz.id}
                quiz={quiz}
                onClick={() => onSelectQuiz(quiz)}
                isLocked={isLocked}
              />
            );
          })}
          {contentCount === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">No content yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CourseViewer({
  course,
  modules,
  lessonsByModule,
  quizzesByModule = {},
  assetsByLesson,
  selectedLessonId,
  hasLearningAccess = false,
  onBack,
  onStartLearning,
  onSelectLesson,
}) {
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState(false);
  const [assignmentSummary, setAssignmentSummary] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const handlePurchase = async () => {
    if (!course?.id) return;
    navigate(`/dashboard/courses/${course.id}/checkout`);
  };

  const allLessons = modules.flatMap((mod) => lessonsByModule[mod.id] || []);
  const allQuizzes = modules.flatMap((mod) => quizzesByModule[mod.id] || []);
  const totalLessons = allLessons.length;
  const totalQuizzes = allQuizzes.length;
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId);
  const selectedAssets = selectedLesson
    ? assetsByLesson[selectedLesson.id] || []
    : [];
  const categoryName =
    course?.course_category?.name || course?.level || "Course";
  const firstModule = modules[0];
  const firstLesson = firstModule
    ? (lessonsByModule[firstModule.id] || [])[0]
    : null;
  const heroDescription =
    course?.short_description ||
    course?.description ||
    "Pelajari materi course ini melalui modul dan lesson yang sudah disusun.";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  // role 10 orang tua, role 20 siswa
  const isStudent =
    currentUser?.role === 10 || currentUser?.role === 20 || !currentUser?.role;
  const isAdmin = Number(currentUser?.role || 0) >= 99;
  const tabs = isStudent
    ? ["overview", "scores", "certificate"]
    : isAdmin
    ? ["overview", "certificate"]
    : ["overview"];
  const canStartLearning =
    hasLearningAccess &&
    modules.length > 0 &&
    !!(modules[0] ? (lessonsByModule[modules[0].id] || [])[0] : null);
  const [searchParams, setSearchParams] = useSearchParams(); 
  const stats = {
    views: Number(course?.view_count ?? 0),
    enrollments: Number(course?.enrollment_count ?? 0),
    rating: Number(course?.rating ?? 0),
    ratingCount: Number(course?.rating_count ?? 0),
    completionRate: Number(course?.completion_rate ?? 0),
    totalDuration: course?.total_duration ?? "0m",
    language: course?.language ?? "Bahasa Indonesia",
    lastUpdated: course?.updated_at
      ? dayjs(course.updated_at).format("MMM YYYY")
      : "-",
    certificate: !!course?.has_certificate,
  };
  const currentTabParam = searchParams.get("tab");
  const activeTab = tabs.includes(currentTabParam)
    ? currentTabParam
    : "overview";

  // FIX: Fungsi untuk mengubah tab sekaligus memperbarui URL query params
    const handleTabChange = (tabName) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tabName);
        return next;
      });
    };

  // Fetch assignment summary when scores tab is active
  useEffect(() => {
    if (activeTab === "scores" && course?.id && hasLearningAccess) {
      setAssignmentLoading(true);
      api
        .get(`/lms/courses/${course.id}/assignment-summary`)
        .then((res) => setAssignmentSummary(res.data?.data || res.data))
        .catch(() => setAssignmentSummary(null))
        .finally(() => setAssignmentLoading(false));
    }
  }, [activeTab, course?.id, hasLearningAccess]);

  const currentUserRole = Number(currentUser?.role || 0);
  const isManager = currentUserRole === 30 || currentUserRole >= 99;

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else if (isManager) {
      navigate("/dashboard/courses/add");
    } else {
      navigate("/dashboard/courses");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {/* Top nav */}
      <div className="sticky top-0 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Courses</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="truncate text-sm font-medium text-slate-700">
            {course?.title}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBookmarked((b) => !b)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              {bookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-blue-600" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Hero */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {course?.level && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-700">
                  {course.level}
                </span>
              )}
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                {categoryName}
              </span>
              {stats.certificate && (
                <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <Award className="h-3 w-3" /> Certificate
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              {course?.title || "Course Detail"}
            </h1>
            <div
              className="max-w-2xl text-base leading-7 text-slate-500 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: markdownPreview(heroDescription),
              }}
            />

            {/* <RatingStars rating={stats.rating} count={stats.ratingCount} /> */}

            {course?.mentors && course.mentors.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>Created by</span>
                {course.mentors.map((m: any) => {
                  const name =
                    m.profile?.display_name ||
                    m.profile?.full_name ||
                    m.display_name ||
                    m.name ||
                    m.username;
                  const avatar = m.profile?.avatar_url || m.avatar_url;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full px-2 py-0.5"
                    >
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name || "Mentor"}
                          className="h-4 w-4 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-600">
                          {(name || "M").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-slate-800 text-xs">
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : course?.mentor ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Created by</span>
                {course.mentor.avatar_url ? (
                  <img
                    src={course.mentor.avatar_url}
                    alt={course.mentor.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                    {course.mentor.name?.slice(0, 1) || "M"}
                  </div>
                )}
                <span className="font-medium text-blue-600">
                  {course.mentor.name}
                </span>
              </div>
            ) : null}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Updated {stats.lastUpdated}
              </span>
              {/* <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> {stats.language}
              </span> */}
              {/* <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {stats.totalDuration} total
              </span> */}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Eye}
              label="Total Views"
              value={stats.views.toLocaleString()}
              color="blue"
            />
            <StatCard
              icon={Users}
              label="Enrolled"
              value={stats.enrollments.toLocaleString()}
              color="purple"
            />
            <StatCard
              icon={TrendingUp}
              label="Completion Rate"
              value={`${stats.completionRate}%`}
              color="green"
            />
            {/* <StatCard
              icon={Star}
              label="Avg Rating"
              value={stats.rating.toFixed(1)}
              sub={`${stats.ratingCount} reviews`}
              color="amber"
            /> */}
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList className="h-auto w-full justify-start rounded-none border-b border-slate-200 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="relative border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-none "
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Tab: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {course?.description && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    About this course
                  </h2>
                  <div className="text-sm leading-7 text-slate-600">
                    <MarkdownView content={course.description} />
                  </div>
                </div>
              )}

              {/* What you'll learn */}
              {course?.learning_outcomes?.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    What you'll learn
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {course.learning_outcomes.map((item, i) => (
                      <div
                        key={i}
                        className="flex gap-2 text-sm text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">
                    Course Content
                  </h2>
                  <span className="text-sm text-slate-400">
                    {modules.length} modules · {totalLessons} lessons ·{" "}
                    {totalQuizzes} quizzes
                  </span>
                </div>
                <div className="space-y-2">
                  {modules.map((mod, idx) => (
                    <ModuleAccordion
                      key={mod.id}
                      mod={mod}
                      lessons={lessonsByModule[mod.id] || []}
                      quizzes={quizzesByModule[mod.id] || []}
                      selectedLessonId={selectedLessonId}
                      onSelectLesson={onSelectLesson}
                      onSelectQuiz={(quiz) =>
                        navigate(`/dashboard/quizzes/${quiz.id}`, {
                          state: {
                            fromCourseId: course?.id,
                            fromCourseTitle: course?.title,
                          },
                        })
                      }
                      hasLearningAccess={hasLearningAccess}
                      defaultOpen={idx === 0}
                      course={course}
                      allLessons={allLessons}
                    />
                  ))}
                </div>
              </div>

              {/* Instructor card */}
              {course?.mentors && course.mentors.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    Instructors
                  </h2>
                  <div className="space-y-3">
                    {course.mentors.map((m: any) => {
                      const name =
                        m.profile?.display_name ||
                        m.profile?.full_name ||
                        m.display_name ||
                        m.name ||
                        m.username;
                      const avatar = m.profile?.avatar_url || m.avatar_url;
                      const bio = m.profile?.bio;
                      const title = m.profile?.headline;
                      return (
                        <div
                          key={m.id}
                          className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={name}
                              className="h-14 w-14 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                              {(name || "M").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {name}
                            </p>
                            {title && (
                              <p className="text-xs text-slate-500">{title}</p>
                            )}
                            {bio && (
                              <p className="text-xs leading-5 text-slate-600">
                                {bio}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : course?.mentor ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    Instructor
                  </h2>
                  <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    {course.mentor.avatar_url ? (
                      <img
                        src={course.mentor.avatar_url}
                        alt={course.mentor.name}
                        className="h-16 w-16 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                        {course.mentor.name?.slice(0, 1) || "M"}
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {course.mentor.name}
                      </p>
                      {course.mentor.title && (
                        <p className="text-sm text-slate-500">
                          {course.mentor.title}
                        </p>
                      )}
                      {course.mentor.bio && (
                        <p className="text-sm leading-6 text-slate-600">
                          {course.mentor.bio}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Tab: Assignment Scores */}
          {activeTab === "scores" && (
            <CourseScores
              courseId={course?.id}
              assignmentSummary={assignmentSummary}
              assignmentLoading={assignmentLoading}
              hasLearningAccess={hasLearningAccess}
            />
          )}

          {/* Tab: Certificate */}
          {activeTab === "certificate" && course?.id && (
            <CourseCertificate
              courseId={course.id}
              onBack={() => handleTabChange("overview")}
            />
          )}

          {/* Tab: Reviews */}
          {activeTab === "reviews" && (
            <CourseReview
              stats={{
                rating: stats.rating,
                total_reviews: stats.ratingCount,
              }}
            />
          )}
        </div>

        {/* RIGHT COLUMN — sticky sidebar */}
        <aside className="mt-6 lg:sticky lg:top-20 lg:mt-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            {/* Cover */}
            <div className="relative aspect-video bg-slate-200">
              {course?.cover_image_url ? (
                <img
                  src={course.cover_image_url}
                  alt={course.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700">
                  <BookOpen className="h-12 w-12 text-white opacity-50" />
                </div>
              )}
            </div>

            {/* Sidebar body */}
            <div className="p-5 space-y-5">
              <div className="space-y-1">
                {/* <p className="text-2xl font-bold text-slate-900">
                  {course?.price
                    ? `Rp ${Number(course.price).toLocaleString("id-ID")}`
                    : "Free"}
                </p> */}
                {course?.original_price && (
                  <p className="text-sm text-slate-400 line-through">
                    Rp {Number(course.original_price).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
              {canStartLearning ? (
                <RouterLink
                  to={
                    modules.length > 0 && firstLesson
                      ? `/dashboard/lessons/${firstLesson.id}`
                      : "#"
                  }
                >
                  <Button
                    className="h-11 w-full gap-2 text-sm font-semibold"
                    onClick={onStartLearning}
                    disabled={!firstLesson}
                  >
                    {stats.completionRate > 0
                      ? "Continue Learning"
                      : "Start Learning"}{" "}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </RouterLink>
              ) : course?.sell_individual ? (
                <div className="space-y-3">
                  <div className="text-center text-sm font-semibold text-slate-800 bg-slate-100 rounded-lg py-2">
                    {course?.price > 0
                      ? `Harga: Rp ${Number(course.price).toLocaleString(
                          "id-ID"
                        )}`
                      : "Gratis"}
                  </div>
                  <Button
                    className="h-11 w-full gap-2 text-sm font-semibold"
                    onClick={handlePurchase}
                    disabled={purchaseLoading}
                  >
                    {purchaseLoading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Beli Kursus <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                /* Alternatif UI untuk Admin/Mentor/Parent agar informatif */
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center text-xs text-slate-500">
                  Mode Pratinjau: Hanya akun siswa yang dapat memulai
                  pembelajaran materi kursus ini.
                </div>
              )}
              {/* Course includes */}
              <div className="space-y-2.5 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  This course includes
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 shrink-0 text-slate-400" />
                    {modules.length} modules, {totalLessons} lessons,{" "}
                    {totalQuizzes} quizzes
                  </li>
                  {/* <li className="flex items-center gap-2.5">
                    <Download className="h-4 w-4 shrink-0 text-slate-400" />
                    Downloadable resources
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                    Full lifetime access
                  </li> */}
                  {stats.certificate && (
                    <li className="flex items-center gap-2.5">
                      <Award className="h-4 w-4 shrink-0 text-slate-400" />
                      Certificate of completion
                    </li>
                  )}
                </ul>
              </div>

              {/* Engagement stats mini */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2.5 text-center">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <p className="text-xs font-semibold text-slate-700">
                    {compactNumber(stats.views)}
                  </p>
                  <p className="text-[10px] text-slate-400">Views</p>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2.5 text-center">
                  <Users className="h-4 w-4 text-purple-500" />
                  <p className="text-xs font-semibold text-slate-700">
                    {compactNumber(stats.enrollments)}
                  </p>
                  <p className="text-[10px] text-slate-400">Enrolled</p>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2.5 text-center">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-xs font-semibold text-slate-700">
                    {stats.completionRate}%
                  </p>
                  <p className="text-[10px] text-slate-400">Complete</p>
                </div>
              </div>

              {/* Share */}
              {/* <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-800 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Share this course
              </button> */}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


export default CourseViewer;
