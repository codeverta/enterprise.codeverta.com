import React from 'react'
import MarkdownView from './MarkdownView';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Kartu preview satu soal — dipakai di live preview form & di modal full preview
function QuestionPreviewCard({ question, index, showKey = false }) {
  const hasContent = question?.question_text?.trim();
  return (
    <div className="rounded-lg border bg-zinc-50/50 p-4">
      {!hasContent ? (
        <p className="text-xs text-zinc-400 italic">
          Mulai tulis pertanyaan untuk melihat preview di sini.
        </p>
      ) : (
        <>
          <div className="mb-3 text-sm font-semibold text-zinc-800 flex items-start gap-1">
            {typeof index === "number" && <span>{index + 1}.</span>}
            <div className="flex-1">
              {question.question_type === "arrange_words" ? (
                <div className="leading-relaxed whitespace-pre-wrap">
                  {question.question_text.split(/(\[blank\])/i).map((part, i) => {
                    if (part.toLowerCase() === "[blank]") {
                      return (
                        <span
                          key={i}
                          className="inline-block w-24 h-7 mx-1 border-b-2 border-dashed border-zinc-300 align-middle bg-zinc-100 rounded-sm"
                        ></span>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>
              ) : (
                <MarkdownView content={question.question_text} />
              )}
            </div>
          </div>
          <p className="mb-2 text-[10px] text-zinc-400 uppercase font-mono">
            {question.question_type} · {question.points || 1} poin
          </p>
          {showKey && question.always_correct && (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
              Always correct — semua jawaban mendapat poin penuh
            </div>
          )}
          {question.question_type === "short_answer" ? (
            <Input
              disabled
              placeholder="Jawaban singkat..."
              className="h-9 text-xs bg-white"
            />
          ) : question.question_type === "arrange_words" ? (
            <div className="mt-4 flex flex-wrap gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <span className="w-full text-[10px] font-semibold text-blue-800 uppercase mb-1">
                Word Bank (Opsi Jawaban)
              </span>
              {(question.options || []).map((option, i) => (
                <div
                  key={option.id || i}
                  className={cn(
                    "px-3 py-1.5 text-xs bg-white border shadow-sm rounded-md",
                    showKey && option.is_correct
                      ? "border-emerald-300 text-emerald-700 font-medium"
                      : "border-zinc-200 text-zinc-700"
                  )}
                >
                  {option.option_text || (
                    <span className="text-zinc-300">(kosong)</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {(question.options || []).map((option, i) => (
                <div
                  key={option.id || i}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded border px-3 py-1.5 text-xs bg-white",
                    showKey && option.is_correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200"
                  )}
                >
                  <span>
                    {option.option_text || (
                      <span className="text-zinc-300">(kosong)</span>
                    )}
                  </span>
                  {showKey && option.is_correct && (
                    <span className="text-[10px] font-bold shrink-0">
                      Kunci
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {question.explanation?.trim() && (
            <div className="mt-3 text-xs text-zinc-500 bg-white p-2 rounded italic border">
              💡 <MarkdownView content={question.explanation} inline />
            </div>
          )}
        </>
      )}
    </div>
  );
}


export default QuestionPreviewCard
