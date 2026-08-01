import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileQuestion,
  Image as ImageIcon,
  List as ListIcon,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  GripVertical,
  Bold,
  Italic,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import QuestionList from "./QuestionList";
import QuizPreviewModal from "./QuizPreviewModal";
import QuestionPreviewCard from "./QuestionPreviewCard";
import MarkdownView from "./MarkdownView";
import QuestionForm from "./QuestionForm";

const getData = (res) => res.data?.data || res.data || [];


const emptyQuiz = {
  title: "",
  description: "",
  instructions: "",
  passing_score: 70,
  time_limit_min: 30,
  max_attempts: 1,
  randomize_questions: false,
  randomize_answers: false,
  show_result_after_submit: true,
  show_correct_answers: false,
  require_passing_score_before_continue: false,
  is_published: false,
  sort_order: 0,
};

const emptyQuestion = {
  question_text: "",
  question_type: "single",
  points: 1,
  explanation: "",
  sort_order: 0,
  is_required: true,
  always_correct: false,
  options: [
    { option_text: "", is_correct: true, sort_order: 1 },
    { option_text: "", is_correct: false, sort_order: 2 },
  ],
};



export default function ModuleQuizSection({
  courseId,
  moduleId,
  quizId,
  isAdmin,
  onQuizDeleted,
}) {
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizForm, setQuizForm] = useState(emptyQuiz);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [showQuizPreview, setShowQuizPreview] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importingQuiz, setImportingQuiz] = useState(false);

  const selectedQuizPayload = selectedQuiz?.quiz || selectedQuiz;
  const questions = selectedQuizPayload?.questions || [];
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + Number(q.points || 0), 0),
    [questions]
  );

  useEffect(() => {
    if (quizId) {
      selectQuiz(quizId);
    }
  }, [quizId]);

  useEffect(() => {
    if (!attempt || !selectedQuizPayload?.time_limit_min) return;
    const startedAt = new Date(attempt.started_at).getTime();
    const total = Number(selectedQuizPayload.time_limit_min || 0) * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRemainingSec(Math.max(0, total - elapsed));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt?.id, selectedQuizPayload?.time_limit_min]);

  const selectQuiz = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/lms/quizzes/${id}`);
      const payload = getData(res);
      setSelectedQuiz(payload);
      setQuizForm(payload.quiz || payload);
      setAttempt(null);
      setResult(null);
      setAnalytics(null);
      setAnswers({});
    } catch {
      toast.error("Gagal memuat detail quiz");
    } finally {
      setLoading(false);
    }
  };

  const saveQuiz = async () => {
    if (!quizForm.title?.trim()) return toast.error("Judul quiz wajib diisi");
    const payload = {
      ...quizForm,
      course_id: courseId,
      module_id: moduleId || null,
      passing_score: Number(quizForm.passing_score || 0),
      time_limit_min: Number(quizForm.time_limit_min || 0),
      max_attempts: Number(quizForm.max_attempts || 1),
      sort_order: Number(quizForm.sort_order || 0),
    };
    try {
      if (quizForm.id) {
        await api.put(`/lms/admin/quizzes/${quizForm.id}`, payload);
      }
      toast.success("Quiz tersimpan");
      selectQuiz(quizId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan quiz");
    }
  };

  const deleteQuiz = async (id) => {
    if (!confirm("Hapus quiz ini beserta soal dan attempt-nya?")) return;
    try {
      await api.delete(`/lms/admin/quizzes/${id}`);
      toast.success("Quiz dihapus");
      if (onQuizDeleted) onQuizDeleted();
    } catch {
      toast.error("Gagal menghapus quiz");
    }
  };

  const saveQuestion = async () => {
    if (!selectedQuizPayload?.id) return toast.error("Pilih quiz dulu");
    if (!questionForm.question_text?.trim())
      return toast.error("Pertanyaan wajib diisi");
    const payload = {
      ...questionForm,
      points: Number(questionForm.points || 1),
      sort_order: Number(questionForm.sort_order || questions.length + 1),
      options: (questionForm.options || []).filter((o) =>
        o.option_text?.trim()
      ),
    };
    try {
      if (questionForm.id) {
        await api.put(`/lms/admin/quiz-questions/${questionForm.id}`, payload);
      } else {
        await api.post(
          `/lms/admin/quizzes/${selectedQuizPayload.id}/questions`,
          payload
        );
      }
      toast.success("Soal tersimpan");
      setQuestionForm(emptyQuestion);
      await selectQuiz(selectedQuizPayload.id);
    } catch {
      toast.error("Gagal menyimpan soal");
    }
  };

  const duplicateQuestion = async (questionId) => {
    try {
      await api.post(`/lms/admin/quiz-questions/${questionId}/duplicate`);
      toast.success("Soal diduplikasi");
      selectQuiz(selectedQuizPayload.id);
    } catch {
      toast.error("Gagal menduplikasi soal");
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await api.delete(`/lms/admin/quiz-questions/${questionId}`);
      toast.success("Soal dihapus");
      selectQuiz(selectedQuizPayload.id);
    } catch {
      toast.error("Gagal menghapus soal");
    }
  };

  const startAttempt = async () => {
    try {
      const res = await api.post(
        `/lms/quizzes/${selectedQuizPayload.id}/start`
      );
      const payload = getData(res);
      setAttempt(payload.attempt);
      setSelectedQuiz({ quiz: payload.quiz });
      setResult(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Tidak bisa memulai quiz");
    }
  };

  const setAnswer = (question, value) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const saveAnswer = async (question) => {
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
      toast.success("Jawaban tersimpan");
    } catch {
      toast.error("Gagal mengamankan jawaban");
    }
  };

  const submitAttempt = async () => {
    if (!attempt?.id) return;
    try {
      for (const question of questions) {
        if (answers[question.id] !== undefined) await saveAnswer(question);
      }
      const res = await api.post(`/lms/quiz-attempts/${attempt.id}/submit`);
      setResult(getData(res));
      setAttempt(null);
      toast.success("Quiz dikumpulkan");
      selectQuiz(selectedQuizPayload.id);
    } catch {
      toast.error("Gagal mengirim lembar evaluasi");
    }
  };

  const downloadResults = () => {
    if (!selectedQuizPayload?.id) return;
    api
      .get(`/lms/admin/quizzes/${selectedQuizPayload.id}/export-results`, {
        responseType: "blob",
      })
      .then((res) => {
        const url = URL.createObjectURL(
          new Blob([res.data], { type: "text/csv" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "quiz-results.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
  };

  const importQuizQuestions = async () => {
    if (!selectedQuizPayload?.id || !importFile) {
      return toast.error("Pilih file Excel terlebih dahulu");
    }
    const formData = new FormData();
    formData.append("file", importFile);
    setImportingQuiz(true);
    try {
      const res = await api.post(
        `/lms/admin/quizzes/${selectedQuizPayload.id}/import-excel`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const payload = getData(res);
      toast.success(`${payload.created || 0} soal berhasil diimpor`);
      setShowImportDialog(false);
      setImportFile(null);
      await selectQuiz(selectedQuizPayload.id);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Import gagal. Periksa kembali struktur file Excel."
      );
    } finally {
      setImportingQuiz(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedQuizPayload?.id) return;
    try {
      const res = await api.get(
        `/lms/admin/quizzes/${selectedQuizPayload.id}/analytics`
      );
      setAnalytics(getData(res));
    } catch {
      toast.error("Gagal memuat analitik");
    }
  };

  const handleOnDragEnd = async (result) => {
    if (!result.destination || !isAdmin) return;

    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedQuestions = items.map((item, index) => ({
      ...item,
      sort_order: index + 1,
    }));

    setSelectedQuiz((prev) => {
      const base = prev?.quiz ? prev.quiz : prev;
      return prev?.quiz
        ? { ...prev, quiz: { ...base, questions: updatedQuestions } }
        : { ...base, questions: updatedQuestions };
    });

    try {
      await api.put(`/lms/admin/quizzes/${quizId}/questions/reorder`, {
        questions: updatedQuestions.map((q) => ({
          id: q.id,
          sort_order: q.sort_order,
        })),
      });
      toast.success("Urutan soal berhasil diperbarui");
    } catch {
      toast.error("Gagal menyimpan urutan soal baru");
      selectQuiz(quizId);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
      </div>
    );
  }

  const showQuestionSidebar = selectedQuizPayload && !attempt && !result;

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid gap-5",
          showQuestionSidebar && "xl:grid-cols-[minmax(0,1fr)_380px]"
        )}
      >
        <div className="min-w-0 space-y-5">
          {selectedQuizPayload && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                {selectedQuizPayload.title}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {selectedQuizPayload.description || "Tidak ada deskripsi."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-600 font-mono">
                <span className="rounded bg-zinc-100 px-2 py-0.5">
                  ⏱️ {selectedQuizPayload.time_limit_min || "Tanpa"} menit
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5">
                  🎯 Passing {selectedQuizPayload.passing_score}%
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5">
                  ❓ {questions.length} soal / {totalPoints} poin
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setShowImportDialog(true)}
                >
                  <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Import Quiz
                </Button>
              )}
              {isAdmin && questions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setShowQuizPreview(true)}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" /> Preview Quiz
                </Button>
              )}
              {!isAdmin && !attempt && (
                <Button
                  onClick={startAttempt}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
                >
                  <Play className="mr-2 h-3.5 w-3.5" /> Start Quiz
                </Button>
              )}
            </div>
          </div>
            </section>
          )}
          {isAdmin && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-sm text-zinc-800">
              {quizForm.id
                ? "Edit Konfigurasi Quiz"
                : "Buat Quiz"}
            </h2>
            {selectedQuizPayload?.id && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadAnalytics}>
                  Analytics
                </Button>
                <Button size="sm" variant="outline" onClick={downloadResults}>
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteQuiz(selectedQuizPayload.id)}
                >
                  Hapus
                </Button>
              </div>
            )}
          </div>

          {analytics && (
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Metric
                label="Total Attempts"
                value={analytics.total_attempts || 0}
              />
              <Metric
                label="Average Score"
                value={`${Number(analytics.average_score || 0).toFixed(2)}%`}
              />
              <Metric
                label="Pass Rate"
                value={`${Number(analytics.pass_rate || 0).toFixed(2)}%`}
              />
              <Metric
                label="Fail Rate"
                value={`${Number(analytics.fail_rate || 0).toFixed(2)}%`}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input
                value={quizForm.title || ""}
                onChange={(e) =>
                  setQuizForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </Field>
            <Field label="Passing Score (%)">
              <Input
                type="number"
                value={quizForm.passing_score || 0}
                onChange={(e) =>
                  setQuizForm((p) => ({ ...p, passing_score: e.target.value }))
                }
              />
            </Field>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(quizForm.time_limit_min && quizForm.time_limit_min > 0)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setQuizForm((p) => ({
                      ...p,
                      time_limit_min: checked ? 30 : 0,
                    }));
                  }}
                  className="accent-blue-600 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Batasi Waktu Pengerjaan (Timer)
              </label>
              {Boolean(quizForm.time_limit_min && quizForm.time_limit_min > 0) && (
                <Field label="Time Limit (menit)">
                  <Input
                    type="number"
                    min={1}
                    value={quizForm.time_limit_min || 30}
                    onChange={(e) =>
                      setQuizForm((p) => ({ ...p, time_limit_min: e.target.value }))
                    }
                  />
                </Field>
              )}
            </div>
            <Field label="Max Attempts">
              <Input
                type="number"
                value={quizForm.max_attempts || 1}
                onChange={(e) =>
                  setQuizForm((p) => ({ ...p, max_attempts: e.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={quizForm.description || ""}
                onChange={(e) =>
                  setQuizForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </Field>
            <Field label="Instructions">
              <Textarea
                rows={3}
                value={quizForm.instructions || ""}
                onChange={(e) =>
                  setQuizForm((p) => ({ ...p, instructions: e.target.value }))
                }
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3">
            {[
              ["randomize_questions", "Randomize Questions"],
              ["randomize_answers", "Randomize Answers"],
              ["show_result_after_submit", "Show Result"],
              ["show_correct_answers", "Show Correct Answers"],
              ["require_passing_score_before_continue", "Require Pass"],
              ["is_published", "Published"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  checked={!!quizForm[key]}
                  onChange={(e) =>
                    setQuizForm((p) => ({ ...p, [key]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={saveQuiz}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8"
            >
              <Save className="mr-2 h-3.5 w-3.5" /> Simpan Quiz
            </Button>
          </div>
            </section>
          )}

          {isAdmin && selectedQuizPayload && (
            <QuestionForm
              questionForm={questionForm}
              setQuestionForm={setQuestionForm}
              onSave={saveQuestion}
              onReset={() => setQuestionForm(emptyQuestion)}
            />
          )}

          {attempt && (
            <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">
                Attempt #{attempt.attempt_number}
              </h3>
              <p className="text-xs text-zinc-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-mono font-bold text-white">
              Remaining Time:{" "}
              {formatTime(
                remainingSec ||
                  Number(selectedQuizPayload.time_limit_min || 0) * 60
              )}
            </div>
          </div>
          {questions[currentQuestionIndex] && (
            <div className="rounded-lg border p-4 bg-zinc-50/50">
              <div className="mb-3 text-sm font-semibold text-zinc-800">
                <MarkdownView
                  content={questions[currentQuestionIndex].question_text}
                />
              </div>
              <AnswerInput
                question={questions[currentQuestionIndex]}
                value={answers[questions[currentQuestionIndex].id]}
                onChange={(value) =>
                  setAnswer(questions[currentQuestionIndex], value)
                }
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-3 text-xs h-7"
                onClick={() => saveAnswer(questions[currentQuestionIndex])}
              >
                Save Answer
              </Button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuestionIndex >= questions.length - 1}
                onClick={() =>
                  setCurrentQuestionIndex((i) =>
                    Math.min(questions.length - 1, i + 1)
                  )
                }
                className="h-8 text-xs"
              >
                Next
              </Button>
              <Button
                size="sm"
                onClick={submitAttempt}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
              >
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Submit Quiz
              </Button>
            </div>
          </div>
            </section>
          )}

          {result && (
            <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 border-b pb-2">
            Result Summary
          </h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Metric
              label="Score"
              value={`${Number(result.score || 0).toFixed(2)}%`}
            />
            <Metric label="Status" value={result.status} />
            <Metric label="Attempt" value={`#${result.attempt_number}`} />
            <Metric label="Duration" value={`${result.duration_sec || 0}s`} />
          </div>
          {result.answers?.length > 0 && (
            <div className="mt-5 space-y-3">
              {result.answers.map((answer) => (
                <div key={answer.id} className="rounded-lg border p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-xs text-zinc-800">
                      <MarkdownView
                        content={answer.question?.question_text || ""}
                      />
                    </div>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold shrink-0",
                        answer.is_correct
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {answer.is_correct ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                  {answer.question?.options?.length > 0 && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {answer.question.options.map((option) => (
                        <div
                          key={option.id}
                          className={cn(
                            "rounded bg-zinc-50 px-3 py-1.5 text-xs border border-transparent",
                            option.is_correct &&
                              "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}
                        >
                          {option.option_text}
                        </div>
                      ))}
                    </div>
                  )}
                  {answer.question?.explanation && (
                    <div className="mt-2.5 text-xs text-zinc-500 bg-zinc-50 p-2 rounded italic">
                      💡{" "}
                      <MarkdownView
                        content={answer.question.explanation}
                        inline
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </section>
          )}
        </div>

        {showQuestionSidebar && (
          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <QuestionList
              questions={questions}
              isAdmin={isAdmin}
              onEdit={setQuestionForm}
              onDuplicate={duplicateQuestion}
              onDelete={deleteQuestion}
              onDragEnd={handleOnDragEnd}
              sidebar
            />
          </aside>
        )}
      </div>

      {showQuizPreview && (
        <QuizPreviewModal
          quiz={selectedQuizPayload}
          questions={questions}
          totalPoints={totalPoints}
          onClose={() => setShowQuizPreview(false)}
        />
      )}

      <QuizImportDialog
        open={showImportDialog}
        file={importFile}
        importing={importingQuiz}
        onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open && !importingQuiz) setImportFile(null);
        }}
        onFileChange={setImportFile}
        onImport={importQuizQuestions}
      />
    </div>
  );
}

const importColumns = [
  ["question_text", "Wajib", "Teks pertanyaan"],
  ["question_type", "Wajib", "single, multiple, true_false, short_answer"],
  ["points", "Wajib", "Angka lebih dari 0"],
  ["explanation", "Opsional", "Penjelasan setelah quiz dinilai"],
  ["is_required", "Wajib", "TRUE atau FALSE"],
  ["option_1 s/d option_6", "Pilihan", "Minimal 2 untuk soal pilihan"],
  ["correct_answer", "Wajib", "Nomor opsi (1 / 1,3) atau teks short answer"],
];

function QuizImportDialog({
  open,
  file,
  importing,
  onOpenChange,
  onFileChange,
  onImport,
}) {
  const inputRef = useRef(null);
  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Format file harus .xlsx");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5 MB");
      return;
    }
    onFileChange(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Quiz dari Excel</DialogTitle>
          <DialogDescription>
            Tambahkan banyak soal sekaligus ke quiz ini. Soal yang sudah ada
            tidak akan dihapus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs text-zinc-600">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-indigo-950">Mulai dari template</p>
                <p className="mt-1 text-indigo-700">
                  Isi sheet <strong>Quiz</strong> tanpa mengubah nama atau urutan
                  kolom. Sheet Panduan berisi contoh setiap tipe soal.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0 bg-white">
                <a href="/templates/quiz-import-template.xlsx" download>
                  <Download className="mr-2 h-3.5 w-3.5" /> Unduh Template
                </a>
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-semibold text-zinc-800">Struktur kolom</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Kolom</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Cara isi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importColumns.map(([column, status, guide]) => (
                    <tr key={column}>
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-800">{column}</td>
                      <td className="px-3 py-2">{status}</td>
                      <td className="px-3 py-2">{guide}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="font-semibold text-zinc-800">Aturan jawaban benar</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li><strong>single / true_false:</strong> satu nomor opsi, contoh <code>2</code>.</li>
              <li><strong>multiple:</strong> beberapa nomor dipisah koma, contoh <code>1,3</code>.</li>
              <li><strong>short_answer:</strong> tulis jawaban teks persis yang diterima.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
            onDragOver={(event) => event.preventDefault()}
            className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 px-5 py-7 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            <Upload className="mb-2 h-6 w-6 text-zinc-400" />
            <span className="font-semibold text-zinc-800">
              {file ? file.name : "Pilih atau tarik file Excel ke sini"}
            </span>
            <span className="mt-1 text-zinc-500">Format .xlsx, maksimal 5 MB</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Batal
          </Button>
          <Button onClick={onImport} disabled={!file || importing} className="bg-indigo-600 hover:bg-indigo-700">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {importing ? "Mengimpor..." : "Import Quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-zinc-700">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border bg-zinc-50 p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold capitalize text-zinc-900">{value}</p>
    </div>
  );
}

function formatTime(totalSec) {
  const minutes = Math.floor(Number(totalSec || 0) / 60);
  const seconds = Number(totalSec || 0) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}



function AnswerInput({ question, value, onChange }) {
  if (question.question_type === "short_answer") {
    return (
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis jawaban singkat"
        className="h-9 text-xs"
      />
    );
  }
  if (question.question_type === "arrange_words") {
    const blanksCount = (question.question_text.match(/\[blank\]/ig) || []).length;
    const currentValues = Array.isArray(value) ? value : Array(blanksCount).fill(null);
    const availableOptions = (question.options || []).filter(opt => !currentValues.includes(opt.id));

    const handleSelectOption = (optId) => {
      const nextIndex = currentValues.indexOf(null);
      if (nextIndex !== -1) {
        const newValues = [...currentValues];
        newValues[nextIndex] = optId;
        onChange(newValues);
      }
    };

    const handleRemoveOption = (index) => {
      const newValues = [...currentValues];
      newValues[index] = null;
      onChange(newValues);
    };

    return (
      <div className="space-y-6">
        <div className="leading-relaxed whitespace-pre-wrap text-[15px] text-slate-800">
          {question.question_text.split(/(\[blank\])/i).reduce((acc, part, i) => {
            if (part.toLowerCase() === "[blank]") {
              const blankIndex = acc.blankCounter;
              acc.blankCounter++;
              const selectedOptId = currentValues[blankIndex];
              const selectedOpt = question.options?.find(o => o.id === selectedOptId);

              acc.elements.push(
                <span
                  key={i}
                  onClick={() => selectedOptId && handleRemoveOption(blankIndex)}
                  className={cn(
                    "inline-flex items-center justify-center min-w-[120px] h-8 mx-1 px-3 py-1 align-middle rounded-md text-sm transition-colors cursor-pointer",
                    selectedOptId 
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200" 
                      : "bg-zinc-100 border-2 border-dashed border-zinc-300 hover:bg-zinc-200"
                  )}
                  title={selectedOptId ? "Klik untuk membatalkan" : "Pilih kata dari bank kata di bawah"}
                >
                  {selectedOpt?.option_text || ""}
                </span>
              );
            } else {
              acc.elements.push(<span key={i}>{part}</span>);
            }
            return acc;
          }, { elements: [], blankCounter: 0 }).elements}
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 shadow-inner">
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-3">Bank Kata</p>
          <div className="flex flex-wrap gap-2">
            {availableOptions.length === 0 ? (
              <span className="text-sm text-zinc-400 italic">Semua kata sudah digunakan.</span>
            ) : (
              availableOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className="px-3 py-1.5 bg-white border border-zinc-300 rounded-md text-sm shadow-sm hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  {opt.option_text}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }
  if (question.question_type === "multiple") {
    const values = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {(question.options || []).map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 text-xs text-zinc-600 select-none cursor-pointer"
          >
            <input
              type="checkbox"
              className="rounded text-indigo-600 border-zinc-300"
              checked={values.includes(option.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...values, option.id]
                    : values.filter((id) => id !== option.id)
                )
              }
            />
            {option.option_text}
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {(question.options || []).map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-2 text-xs text-zinc-600 select-none cursor-pointer"
        >
          <input
            type="radio"
            name={question.id}
            className="text-indigo-600 border-zinc-300"
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          {option.option_text}
        </label>
      ))}
    </div>
  );
}
