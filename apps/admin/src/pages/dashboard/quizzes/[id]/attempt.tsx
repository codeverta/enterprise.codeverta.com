// QuizAttemptPage.jsx — student-only view, fully refactored

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import MarkdownView from "@/components/course-editor/MarkdownView";

const getData = (res) => res.data?.data || res.data || [];

const shuffleItems = (items = []) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const prepareAttemptPayload = (payload) => {
  const quiz = payload?.quiz || payload;
  if (!quiz) return payload;

  let questions = [...(quiz.questions || [])];
  if (quiz.randomize_questions) questions = shuffleItems(questions);
  if (quiz.randomize_answers) {
    questions = questions.map((question) => ({
      ...question,
      options: shuffleItems(question.options || []),
    }));
  }

  const preparedQuiz = { ...quiz, questions };
  return payload?.quiz ? { ...payload, quiz: preparedQuiz } : preparedQuiz;
};

// ─── Screens ──────────────────────────────────────────────────────────────────
// "list"    → daftar quiz
// "detail"  → info + tombol mulai
// "attempt" → pengerjaan soal (focus mode)
// "result"  → hasil nilai

function QuizAttemptPage({ user }) {
  const navigate = useNavigate();
  const { id: routeQuizId } = useParams();
  const [screen, setScreen] = useState("list"); // "list" | "detail" | "attempt" | "result"
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null); // full payload from API
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [pendingQuestionIdx, setPendingQuestionIdx] = useState(null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [result, setResult] = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  const quizPayload = selectedQuiz?.quiz || selectedQuiz;
  const questions = quizPayload?.questions || [];
  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + Number(q.points || 0), 0),
    [questions]
  );

  // ── Document Title ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (quizPayload?.title) {
      document.title = `Pengerjaan: ${quizPayload.title} | Dashboard LMS`;
    } else {
      document.title = "Pengerjaan Kuis | Dashboard LMS";
    }
  }, [quizPayload?.title]);

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

      if (attemptId) {
        try {
          const attemptRes = await api.get(`/lms/quiz-attempts/${attemptId}`);
          const attemptData = getData(attemptRes);
          setAttempt(attemptData);
          setSelectedQuiz(prepareAttemptPayload(attemptData.quiz));

          // Map existing answers to state structure: { [question_id]: value }
          const mappedAnswers = {};
          if (attemptData.answers) {
            attemptData.answers.forEach((ans) => {
              const qType = ans.question?.question_type;
              if (qType === "short_answer") {
                mappedAnswers[ans.question_id] = ans.answer_text;
              } else if (qType === "multiple") {
                mappedAnswers[ans.question_id] = ans.selected_option_ids || [];
              } else {
                const optIds = ans.selected_option_ids || [];
                mappedAnswers[ans.question_id] = optIds.length > 0 ? optIds[0] : null;
              }
            });
          }
          setAnswers(mappedAnswers);

          // Restore current question index from url parameter 'q'
          const qParam = searchParams.get("q");
          if (qParam !== null) {
            setCurrentQIdx(Number(qParam));
          }
          setScreen("attempt");
        } catch (err) {
          console.error("Failed to load active attempt", err);
          toast.error("Gagal memuat sesi kuis aktif");
          if (routeQuizId) openQuizDetail({ id: routeQuizId });
        }
      } else if (routeQuizId) {
        openQuizDetail({ id: routeQuizId });
      }
    } catch {
      toast.error("Gagal memuat kuis");
    } finally {
      setLoading(false);
    }
  }, [routeQuizId, attemptId, searchParams]);

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
  }, [attempt, quizPayload?.time_limit_min]);

  // ── Auto-submit on timer end ─────────────────────────────────────────────────
  useEffect(() => {
    if (quizPayload?.time_limit_min > 0 && remainingSec === 0 && attempt) {
      toast.warning("Waktu habis! Quiz dikumpulkan otomatis.");
      submitAttempt(true);
    }
  }, [remainingSec, attempt, quizPayload?.time_limit_min]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openQuizDetail = async (item) => {
    const quiz = item.quiz || item;
    try {
      const res = await api.get(`/lms/quizzes/${quiz.id}`);
      const payload = getData(res);
      setSelectedQuiz(prepareAttemptPayload(payload));
      setAttempt(null);
      setResult(null);
      setAnswers({});
      setAnswerFeedback(null);
      setPendingQuestionIdx(null);
      setCurrentQIdx(0);
      setScreen("detail");
    } catch {
      toast.error("Gagal memuat detail quiz");
    }
  };


  // ── Answer helpers ────────────────────────────────────────────────────────────
  const setAnswer = (qId, value) =>
    setAnswers((prev) => ({ ...prev, [qId]: value }));

  const persistAnswer = async (question) => {
    if (!attemptId || !question) return null;
    const value = answers[question.id];
    const isText = question.question_type === "short_answer";
    try {
      const res = await api.post(`/lms/quiz-attempts/${attemptId}/answers`, {
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
      return getData(res);
    } catch {
      // silent — local state is source of truth
      return null;
    }
  };

  // ── Navigation (auto-save on move) ────────────────────────────────────────────
  const navigateTo = async (nextIdx) => {
    if (nextIdx < 0 || nextIdx >= questions.length || savingAnswer) return;
    const currentQuestion = questions[currentQIdx];
    const shouldShowFeedback = nextIdx > currentQIdx && isAnswered(currentQuestion?.id);

    setSavingAnswer(true);
    const feedback = await persistAnswer(currentQuestion); // auto-save current soal
    setSavingAnswer(false);

    if (shouldShowFeedback && feedback?.feedback_available) {
      setAnswerFeedback({ ...feedback, question: currentQuestion });
      setPendingQuestionIdx(nextIdx);
      return;
    }
    setAnswerFeedback(null);
    setPendingQuestionIdx(null);
    setCurrentQIdx(nextIdx);
    if (attemptId) {
      navigate(`/dashboard/quizzes/${routeQuizId}/attempt?attemptId=${attemptId}&q=${nextIdx}`, { replace: true });
    }
  };

  const continueAfterFeedback = () => {
    if (pendingQuestionIdx === null) return;
    setAnswerFeedback(null);
    setCurrentQIdx(pendingQuestionIdx);
    if (attemptId) {
      navigate(`/dashboard/quizzes/${routeQuizId}/attempt?attemptId=${attemptId}&q=${pendingQuestionIdx}`, { replace: true });
    }
    setPendingQuestionIdx(null);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const submitAttempt = async (force = false) => {
    if (!attemptId) {
      toast.error("Terjadi kesalahan di aplikasi, code: 001");
      return;
    }
    if (!force && answeredCount < questions.length) {
      toast.error(
        `Masih ada ${questions.length - answeredCount} soal belum dijawab!`
      );
      return;
    }
    const toastId = toast.loading("Mengumpulkan quiz...");
    try {
      for (const q of questions) {
        if (isAnswered(q.id)) await persistAnswer(q);
      }
      const res = await api.post(`/lms/quiz-attempts/${attemptId}/submit`);
      const resultData = getData(res);
      setResult(resultData);
      setAttempt(null);
      navigate(`/dashboard/quizzes/${routeQuizId}/result?attemptId=${attemptId}`);
      toast.success("Quiz berhasil dikumpulkan!", { id: toastId });
      await loadQuizzes();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal mengumpulkan kuis", {
        id: toastId,
      });
    }
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
  // SCREEN: ATTEMPT (focus mode)
  // ─────────────────────────────────────────────────────────────────────────────
    const q = questions[currentQIdx];
    const currentFeedback =
      answerFeedback?.question?.id === q?.id ? answerFeedback : null;
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          {/* Header bar */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">
                {quizPayload?.title}
              </p>
              <p className="text-xs text-slate-500">
                Soal {currentQIdx + 1} dari {questions.length}
              </p>
            </div>
            {quizPayload?.time_limit_min > 0 && (
              <div className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white tabular-nums">
                {formatTime(remainingSec)}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
            {/* Question area */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 text-base font-semibold leading-relaxed text-slate-900">
                <MarkdownView content={q?.question_text} />
              </div>
              {currentFeedback ? (
                <AnswerFeedback
                  feedback={currentFeedback}
                  onContinue={continueAfterFeedback}
                  isLastQuestion={pendingQuestionIdx === questions.length - 1}
                />
              ) : (
                <AnswerInput
                  question={q}
                  value={answers[q?.id]}
                  onChange={(val) => setAnswer(q.id, val)}
                />
              )}
              {/* Nav actions */}
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    currentQIdx === 0 || savingAnswer || Boolean(currentFeedback)
                  }
                  onClick={() => navigateTo(currentQIdx - 1)}
                >
                  ← Sebelumnya
                </Button>
                <div className="flex gap-2">
                  {currentQIdx < questions.length - 1 ? (
                    <Button
                      size="sm"
                      disabled={savingAnswer || Boolean(currentFeedback)}
                      onClick={() => navigateTo(currentQIdx + 1)}
                    >
                      {savingAnswer ? "Menyimpan..." : "Selanjutnya →"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => submitAttempt()}
                      disabled={
                        answeredCount < questions.length ||
                        savingAnswer ||
                        Boolean(currentFeedback)
                      }
                      title={
                        answeredCount < questions.length
                          ? `${
                              questions.length - answeredCount
                            } soal belum dijawab`
                          : ""
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Kumpulkan Quiz
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Question navigator sidebar */}
            <div className="rounded-xl border bg-white p-4 shadow-sm self-start sticky top-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Navigasi soal
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((qItem, i) => (
                  <button
                    key={qItem.id}
                    className={cn(
                      "aspect-square rounded-md text-xs font-semibold transition",
                      i === currentQIdx
                        ? "bg-blue-600 text-white"
                        : isAnswered(qItem.id)
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                    onClick={() => navigateTo(i)}
                    disabled={savingAnswer || Boolean(currentFeedback)}
                    title={`Soal ${i + 1}${
                      isAnswered(qItem.id) ? " (sudah dijawab)" : ""
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              {/* Legend */}
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-blue-600 inline-block" />{" "}
                  Soal aktif
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-blue-100 border border-blue-300 inline-block" />{" "}
                  Sudah dijawab
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-slate-100 inline-block" />{" "}
                  Belum dijawab
                </div>
              </div>
              {/* Progress */}
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-slate-500 mb-1">
                  {answeredCount}/{questions.length} terjawab
                </p>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.round(
                        (answeredCount / questions.length) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );



}

function formatTime(totalSec) {
  const s = Number(totalSec || 0);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
    s % 60
  ).padStart(2, "0")}`;
}

function AnswerFeedback({ feedback, onContinue, isLastQuestion }) {
  const correctOptions = feedback?.correct_options || [];
  const correctText =
    feedback?.correct_answer_text ||
    correctOptions.map((option) => option.option_text).join(", ");
  const isCorrect = Boolean(feedback?.is_correct);

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isCorrect
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      )}
    >
      <div className="flex items-start gap-3">
        {isCorrect ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-none text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 flex-none text-rose-600" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-base font-semibold",
              isCorrect ? "text-emerald-900" : "text-rose-900"
            )}
          >
            {isCorrect ? "Jawaban kamu benar" : "Jawaban kamu belum tepat"}
          </p>
          {!isCorrect && correctText ? (
            <div className="mt-3 rounded-lg bg-white/75 p-3 text-sm text-slate-800">
              <p className="mb-1 font-semibold text-slate-900">
                Jawaban benar
              </p>
              <p>{correctText}</p>
            </div>
          ) : null}
          {feedback?.explanation ? (
            <div className="mt-3 rounded-lg bg-white/75 p-3 text-sm text-slate-800">
              <p className="mb-1 font-semibold text-slate-900">Penjelasan</p>
              <p className="whitespace-pre-wrap">{feedback.explanation}</p>
            </div>
          ) : null}
          <Button className="mt-4" size="sm" onClick={onContinue}>
            {isLastQuestion ? "Lanjut ke soal terakhir" : "Lanjut ke soal berikutnya"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnswerInput({ question, value, onChange }) {
  if (!question) return null;
  if (question.question_type === "short_answer") {
    return (
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis jawaban singkat kamu di sini..."
        className="mt-2"
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
    const vals = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {(question.options || []).map((opt) => (
          <label
            key={opt.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer text-sm transition",
              vals.includes(opt.id)
                ? "border-blue-400 bg-blue-50"
                : "hover:bg-slate-50"
            )}
          >
            <input
              type="checkbox"
              checked={vals.includes(opt.id)}
              className="accent-blue-600"
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...vals, opt.id]
                    : vals.filter((id) => id !== opt.id)
                )
              }
            />
            {opt.option_text}
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {(question.options || []).map((opt) => (
        <label
          key={opt.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer text-sm transition",
            value === opt.id
              ? "border-blue-400 bg-blue-50"
              : "hover:bg-slate-50"
          )}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={value === opt.id}
            className="accent-blue-600"
            onChange={() => onChange(opt.id)}
          />
          {opt.option_text}
        </label>
      ))}
    </div>
  );
}

export default DashboardLayout(QuizAttemptPage);
