import React from 'react'
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownView from "./MarkdownView";
import QuestionPreviewCard from './QuestionPreviewCard';


// ============================================================
// Modal full quiz preview — render seluruh quiz dari sudut
// pandang peserta (tanpa kunci jawaban) untuk admin cek hasil
// akhir sebelum publish.
// ============================================================
function QuizPreviewModal({ quiz, questions, totalPoints, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Preview — tampilan peserta
            </p>
            <h2 className="text-base font-bold text-zinc-900">{quiz?.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {quiz?.description?.trim() && (
            <div className="text-xs text-zinc-600">
              <MarkdownView content={quiz.description} />
            </div>
          )}
          {quiz?.instructions?.trim() && (
            <div className="rounded-md bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
              <MarkdownView content={quiz.instructions} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600 font-mono">
            <span className="rounded bg-zinc-100 px-2 py-0.5">
              ⏱️ {quiz?.time_limit_min || "Tanpa"} menit
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5">
              🎯 Passing {quiz?.passing_score}%
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5">
              ❓ {questions.length} soal / {totalPoints} poin
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {questions.map((q, i) => (
              <QuestionPreviewCard
                key={q.id || i}
                question={q}
                index={i}
                showKey={false}
              />
            ))}
            {questions.length === 0 && (
              <p className="text-center text-xs text-zinc-400 py-6">
                Belum ada soal pada quiz ini.
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end border-t bg-white px-5 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Tutup Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuizPreviewModal