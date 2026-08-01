import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileQuestion,
  FileText,
  Loader2,
  MessageCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import GradeModal from "@/components/lesson/GradeModal";
import { MarkdownView, tableComponents } from "@/components/course-editor/MarkdownView";

// Import komponen assignment section yang sudah di-split
import StudentAssignmentSection from "@/components/lesson/StudentAssignmentSection";
import MentorAssignmentSection from "@/components/lesson/MentorAssignmentSection";
import LessonAskPanel from "../../../components/lesson/LessonAskPanel";

function LessonDetailPage({ setIsSidebarOpen }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  // Assignment state
  const [myAssignment, setMyAssignment] = useState(null);
  const [lessonAssignments, setLessonAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assignmentNote, setAssignmentNote] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
const [askPanelOpen, setAskPanelOpen] = useState(false);

  // AI Chat state (persists across panel open/close)
  const [aiMessages, setAiMessages] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [activeAiConv, setActiveAiConv] = useState(null);
  const [aiLoaded, setAiLoaded] = useState(false);

  const sendAiMessage = async (text) => {
    if (!text.trim() || aiThinking || !lessonId) return;
    const userMsg = { id: `user-${Date.now()}`, sender_id: "user", sender_role: "student", sender_name: "Saya", body: text, created_at: new Date().toISOString() };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiThinking(true);
    try {
      const res = await api.post(`/lms/chat/lessons/${lessonId}/ai`, {
        message: text,
        conversation_id: activeAiConv?.id,
      });
      const data = res.data?.data || res.data || {};
      if (data.conversation) setActiveAiConv(data.conversation);
      const savedUser = data.user_message;
      const assistant = data.assistant_message;
      setAiMessages((prev) => [
        ...prev.map((m) => m.id === userMsg.id && savedUser ? savedUser : m),
        assistant || { id: `ai-${Date.now()}`, sender_id: "ai-assistant", sender_name: "AI Assistant", sender_role: "ai", body: data.answer || "Maaf, saya belum bisa menjawab pertanyaan itu.", created_at: new Date().toISOString() },
      ]);
    } catch {
      toast.error("Gagal mengirim pesan ke AI.");
    } finally {
      setAiThinking(false);
    }
  };

  // Grading state (mentor/admin)
  const [gradeModal, setGradeModal] = useState(null);
  const [grading, setGrading] = useState(false);

  // Certificate state
  const [courseCompleted, setCourseCompleted] = useState(false);

  // Get user role from localStorage
  const userStr = localStorage.getItem("user");
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const userRole = currentUser?.role;
  const isMentorOrAdmin = userRole === 99 || userRole === 30;

  const lesson = payload?.lesson;
  const module = payload?.module;
  const course = payload?.course;
  const progress = payload?.progress;
  const assets = payload?.assets || [];
  const lessonQuizzes = payload?.lesson_quizzes || [];
  const previousLesson = payload?.previous_lesson;
  const nextLesson = payload?.next_lesson;


    useEffect(() => {
      if (!lessonId || isMentorOrAdmin) return;
      let alive = true;
      const loadAIHistory = async () => {
        setAiLoaded(false);
        try {
          const res = await api.get(
            `/lms/chat/lessons/${lessonId}/ai/messages`
          );
          const data = res.data?.data || res.data || {};
          if (alive) {
            setAiMessages(data.messages || []);
            setActiveAiConv(data.conversation || null);
          }
        } catch {
        } finally {
          if (alive) setAiLoaded(true);
        }
      };
      loadAIHistory();
      return () => {
        alive = false;
      };
    }, [lessonId, isMentorOrAdmin]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, []);
  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  useEffect(() => {
    if (lessonId) {
      loadAssignmentData();
    }
  }, [lessonId]);

  useEffect(() => {
    if (course?.id) {
      checkCourseCertificate();
    }
  }, [course?.id]); // eslint-disable-line

  const loadLesson = async () => {
    setLoading(true);
    setError("");
    setFinished(false);
    try {
      const res = await api.get(`/lms/lessons/${lessonId}`);
      setPayload(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Lesson tidak bisa dimuat.");
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentData = async () => {
    setAssignmentLoading(true);
    try {
      if (isMentorOrAdmin) {
        const res = await api.get(`/lms/lessons/${lessonId}/assignments`);
        setLessonAssignments(res.data?.data || res.data || []);
      } else {
        const res = await api.get(`/lms/lessons/${lessonId}/my-assignment`);
        setMyAssignment(res.data?.data || null);
      }
    } catch (err) {
      console.error("Failed to load assignment data:", err);
    } finally {
      setAssignmentLoading(false);
    }
  };

  // Check certificate after course is available
  // Di dalam file React LessonDetailPage.jsx Anda (baris ~91)
  const checkCourseCertificate = async () => {
    if (!course?.id) return;
    try {
      // FIX: Tambahkan ?check_only=true agar backend me-return data JSON status kelulusan saja
      const res = await api.get(
        `/lms/courses/${course.id}/certificate?check_only=true`
      );
      const data = res.data?.data || res.data;
      if (data?.completed) {
        setCourseCompleted(true);
      }
    } catch {
      // Not completed or error
    }
  };
  const videoAsset = useMemo(
    () =>
      assets.find(
        (a) =>
          a.type === "video" ||
          /youtube|youtu\.be|vimeo|\.mp4/i.test(a.file_url || "")
      ),
    [assets]
  );
  const resourceAssets = assets.filter((a) => a.id !== videoAsset?.id);
  const completed = progress?.is_completed || progress?.status === "completed";
  const hasBlockingQuiz =
    !isMentorOrAdmin &&
    lessonQuizzes.some((item) => {
      const quiz = item.quiz || item;
      const quizProgress = item.progress || quiz.progress || {};
      return !quizProgress.is_passed;
    });

  const hasBlockingAssignment =
    !isMentorOrAdmin &&
    lesson?.require_attachment &&
    (!myAssignment ||
      myAssignment.status !== "graded" ||
      myAssignment.score === null ||
      myAssignment.score < (lesson.attachment_passing_score || 0));

  const continueLesson = async () => {
    if (!lesson?.id) return;

    // Jika Mentor/Admin, cukup pindah halaman tanpa kirim post progress ke API
    if (isMentorOrAdmin) {
      if (nextLesson?.id) {
        navigate(`/dashboard/lessons/${nextLesson.id}`);
      }
      return;
    }

    // Alur reguler untuk Partner
    setSaving(true);
    try {
      const res = await api.post(`/lms/lessons/${lesson.id}/continue`, {
        status: "completed",
        progress_percent: 100,
      });
      const data = res.data?.data || res.data;
      toast.success("Progress lesson tersimpan.");
      if (data.next_lesson?.id) {
        navigate(`/dashboard/lessons/${data.next_lesson.id}`);
      } else {
        setPayload((prev) => ({ ...prev, progress: data.progress }));
        setFinished(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan progress.");
    } finally {
      setSaving(false);
    }
  };

  const handleAskMentor = () => {
    if (!lesson?.id) return;
    const params = new URLSearchParams({
      lesson_id: lesson.id,
      lesson_title: lesson.title || "",
      module_title: module?.title || "",
      course_id: course?.id || "",
      course_title: course?.title || "",
    });
    navigate(`/dashboard/chat?${params.toString()}`);
  };

  const goToLessonQuiz = (quiz) => {
    if (!quiz?.id || isMentorOrAdmin) return;
    navigate(`/dashboard/quizzes/${quiz.id}`);
  };

  // Assignment handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedFile) {
      toast.error("Pilih file terlebih dahulu.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (assignmentNote) {
        formData.append("note", assignmentNote);
      }

      await api.post(`/lms/lessons/${lessonId}/assignments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Tugas berhasil dikirim!");
      setSelectedFile(null);
      setAssignmentNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadAssignmentData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal mengirim tugas.");
    } finally {
      setUploading(false);
    }
  };

  const handleGrade = async (score, feedback) => {
    if (!score || !gradeModal) return;
    setGrading(true);
    try {
      await api.post(`/lms/assignments/${gradeModal.id}/grade`, {
        score: parseFloat(score),
        feedback: feedback,
      });
      toast.success("Penilaian berhasil!");
      setGradeModal(null);
      loadAssignmentData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal memberikan penilaian.");
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Memuat lesson...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            Lesson tidak tersedia
          </h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Kembali
            </Button>
            <Button onClick={loadLesson}>
              <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Lesson kosong.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      {/* Top bar */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              {course?.title} / {module?.title}
            </p>
            <h1 className="truncate text-lg font-bold text-slate-950">
              {lesson.title}
            </h1>
          </div>
          {!isMentorOrAdmin && (
            <div
              className={cn(
                "ml-auto rounded-full px-3 py-1 text-xs font-semibold",
                completed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              )}
            >
              {completed ? "Completed" : progress?.status || "In progress"}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3 lg:items-start items-start min-h-screen">
        {/* Main content */}
        <section className="space-y-5 lg:col-span-2">
          {/* Video */}
          {videoAsset && (
            <div className="overflow-hidden rounded-2xl border bg-black shadow-sm">
              {isVideoFile(videoAsset.file_url) ? (
                <video
                  src={videoAsset.file_url}
                  controls
                  className="aspect-video w-full"
                />
              ) : (
                <iframe
                  src={embedURL(videoAsset.file_url)}
                  title={videoAsset.title || lesson.title}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
          )}

          {/* Lesson content */}
          <article className="rounded-2xl border bg-white p-6 shadow-sm overflow-hidden">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  Lesson Content
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {lesson.title}
                </h2>
              </div>
              <PlayCircle className="h-7 w-7 text-blue-500" />
            </div>

            <div
              className="prose prose-slate max-w-none text-sm leading-7 text-slate-700 
                            [&_img]:!m-0 [&_img]:!p-0 [&_img]:!block [&_img]:!w-full [&_img]:!h-auto 
                            [&>p:last-child]:!m-0 [&>p:last-child]:!p-0"
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={tableComponents}
              >
                {lesson.summary || "Materi lesson belum tersedia."}
              </ReactMarkdown>
            </div>
          </article>

          {/* Supporting resources */}
          {resourceAssets.length > 0 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-bold text-slate-900">
                Materi Pendukung
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {resourceAssets.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">
                      {asset.title}
                    </span>
                    <Download className="h-4 w-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {lessonQuizzes.length > 0 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                    Lesson Quiz
                  </p>
                  <h3 className="mt-1 font-bold text-slate-900">
                    Selesaikan quiz untuk melanjutkan
                  </h3>
                </div>
                <FileQuestion className="h-5 w-5 text-blue-500" />
              </div>
              <div className="grid gap-3">
                {lessonQuizzes.map((item) => {
                  const quiz = item.quiz || item;
                  const quizProgress = item.progress || quiz.progress || {};
                  const done = !!quizProgress.is_completed;
                  const passed = !!quizProgress.is_passed;
                  const blockedByScore =
                    quiz.require_passing_score_before_continue &&
                    done &&
                    !passed;
                  return (
                    <div
                      key={quiz.id}
                      role={!isMentorOrAdmin ? "button" : undefined}
                      tabIndex={!isMentorOrAdmin ? 0 : undefined}
                      onClick={() => goToLessonQuiz(quiz)}
                      onKeyDown={(event) => {
                        if (isMentorOrAdmin) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          goToLessonQuiz(quiz);
                        }
                      }}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border px-4 py-3 md:flex-row md:items-center md:justify-between",
                        !isMentorOrAdmin &&
                          "cursor-pointer transition hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {quiz.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.question_count || quiz.questions?.length || 0}{" "}
                          soal · Passing {quiz.passing_score || 0}% · Best score{" "}
                          {Number(quizProgress.best_score || 0).toFixed(0)}%
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            done
                              ? passed ||
                                !quiz.require_passing_score_before_continue
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {done
                            ? blockedByScore
                              ? "Belum lulus"
                              : "Completed"
                            : "Belum selesai"}
                        </span>
                        {!isMentorOrAdmin && (
                          <Button
                            size="sm"
                            variant={done ? "outline" : "default"}
                            onClick={(event) => {
                              event.stopPropagation();
                              goToLessonQuiz(quiz);
                            }}
                          >
                            {done ? "Ulangi Quiz" : "Kerjakan Quiz"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ─── Assignment Section (Student View) ─── */}
          {!isMentorOrAdmin && (
            <StudentAssignmentSection
              assignmentLoading={assignmentLoading}
              myAssignment={myAssignment}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              uploading={uploading}
              handleSubmitAssignment={handleSubmitAssignment}
              assignmentNote={assignmentNote}
              setAssignmentNote={setAssignmentNote}
            />
          )}

          {/* ─── Assignment Section (Mentor/Admin View) ─── */}
          {isMentorOrAdmin && (
            <MentorAssignmentSection
              assignmentLoading={assignmentLoading}
              lessonAssignments={lessonAssignments}
              setGradeModal={setGradeModal}
            />
          )}

          {/* Finished notice (Hanya untuk partner) */}
          {!isMentorOrAdmin && finished && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
              Kamu sudah menyelesaikan lesson terakhir di module ini. 🎉
            </div>
          )}
        </section>
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          {/* Sembunyikan Progress Card & Navigasi jika user adalah Mentor/Admin */}
          {!isMentorOrAdmin ? (
            <>
              {/* Progress card */}
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Progress
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <CheckCircle2
                    className={cn(
                      "h-8 w-8",
                      completed ? "text-emerald-500" : "text-slate-300"
                    )}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {completed ? "Lesson completed" : "Belum selesai"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {progress?.completed_at
                        ? dayjs(progress.completed_at).format(
                            "DD MMM YYYY, HH:mm"
                          )
                        : "Klik Continue untuk menyimpan progress."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Card */}
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    disabled={!previousLesson}
                    onClick={() =>
                      previousLesson &&
                      navigate(`/dashboard/lessons/${previousLesson.id}`)
                    }
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous Lesson
                  </Button>
                  <Button
                    onClick={continueLesson}
                    disabled={
                      saving || hasBlockingQuiz || hasBlockingAssignment
                    }
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {nextLesson ? "Continue" : "Finish Module"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  {hasBlockingQuiz && (
                    <p className="text-xs leading-5 text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-1 font-medium">
                      ⚠️ Kuis lesson belum lulus. Silakan kerjakan kuis dan
                      capai nilai kelulusan terlebih dahulu sebelum melanjutkan.
                    </p>
                  )}
                  {hasBlockingAssignment && (
                    <p className="text-xs leading-5 text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg mt-1 font-medium animate-in fade-in duration-200">
                      {!myAssignment &&
                        "⚠️ Tugas (attachment) wajib di-upload terlebih dahulu."}
                      {myAssignment &&
                        myAssignment.status === "submitted" &&
                        "⚠️ Tugas telah dikirim. Menunggu penilaian guru untuk dapat melanjutkan."}
                      {myAssignment &&
                        myAssignment.status === "graded" &&
                        `⚠️ Tugas dinilai ${myAssignment.score} (Nilai kelulusan: ${lesson.attachment_passing_score}). Nilai kurang dari batas kelulusan, silakan kumpulkan kembali.`}
                    </p>
                  )}
                  {course?.id && (
                    <Button variant="ghost" asChild>
                      <Link to={`/dashboard/courses/${course.id}`}>
                        Kembali ke Course
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Opsi Navigasi Sederhana Khusus Mentor/Admin (Hanya beralih antar lesson jika ada asset berikutnya) */
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="grid gap-2">
                {previousLesson && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(`/dashboard/lessons/${previousLesson.id}`)
                    }
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous Lesson
                  </Button>
                )}
                {nextLesson && (
                  <Button onClick={continueLesson}>
                    Next Lesson
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {course?.id && (
                  <Button variant="ghost" asChild>
                    <Link to={`/dashboard/courses/${course.id}`}>
                      Kembali ke Course
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Certificate button - only when course completed */}
          {!isMentorOrAdmin && courseCompleted && course?.id && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-amber-600" />
                <p className="text-sm font-bold text-amber-800">
                  Sertifikat Kelulusan
                </p>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Kamu telah menyelesaikan course ini! 🎉
              </p>
              <Button
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={() =>
                  navigate(
                    `/dashboard/courses/${course.id}?view=true&tab=certificate`
                  )
                }
              >
                <Award className="mr-2 h-4 w-4" /> Lihat Sertifikat
              </Button>
            </div>
          )}

          {!isMentorOrAdmin && (
            <>
              <button
                onClick={() => setAskPanelOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-blue-300 bg-white px-4 py-3 text-left text-sm text-blue-600 transition hover:border-blue-400 hover:bg-blue-50"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                <span>Tanya tentang lesson ini...</span>
              </button>
              <LessonAskPanel
                open={askPanelOpen}
                onClose={() => setAskPanelOpen(false)}
                lessonTitle={lesson?.title}
                messages={aiMessages}
                thinking={aiThinking}
                onSend={sendAiMessage}
              />
            </>
          )}
        </aside>
      </main>

      {/* ─── Grade Modal ─── */}
      {gradeModal && (
        <GradeModal
          gradeModal={gradeModal}
          onClose={() => setGradeModal(null)}
          onGradeSubmit={handleGrade}
          grading={grading}
        />
      )}
    </div>
  );
}

function isVideoFile(url = "") {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

function embedURL(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    const videoID =
      host === "youtu.be"
        ? parts[0]
        : ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)
          ? parts[0] === "watch"
            ? parsed.searchParams.get("v")
            : ["embed", "shorts", "live"].includes(parts[0])
              ? parts[1]
              : ""
          : "";
    if (videoID && /^[A-Za-z0-9_-]{11}$/.test(videoID)) {
      return `https://www.youtube-nocookie.com/embed/${videoID}`;
    }
  } catch {
    return url;
  }
  return url;
}

export default DashboardLayout(LessonDetailPage);
