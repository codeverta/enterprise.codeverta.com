import React from 'react'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import MarkdownView from './MarkdownView';
import MarkdownEditor from './MarkdownEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Save, X } from "lucide-react";
import QuestionPreviewCard from './QuestionPreviewCard';



const questionTypes = [
  { value: "single", label: "Multiple Choice" },
  { value: "multiple", label: "Multiple Select" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "arrange_words", label: "Arrange Words" },
];

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-zinc-700">{label}</Label>
      {children}
    </div>
  );
}



// ============================================================
// Section "Tambah Soal" — sekarang dengan markdown editor utk
// question_text & explanation, image upload per-option (opsional
// ringan: opsi cuma teks, tapi question text bisa ada gambar),
// dan live preview soal ini sendiri (kartu kanan / bawah).
// ============================================================
function QuestionForm({ questionForm, setQuestionForm, onSave, onReset }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-bold text-sm text-zinc-800">
        {questionForm.id ? "Edit Soal" : "Tambah Soal"}
      </h3>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Kolom kiri: form input */}
        <div className="space-y-4">
          <Field label="Question Text">
            <MarkdownEditor
              value={questionForm.question_text}
              onChange={(val) =>
                setQuestionForm((p) => ({ ...p, question_text: val }))
              }
              rows={5}
              placeholder={
                questionForm.question_type === "arrange_words"
                  ? "Tulis pertanyaan di sini. Gunakan tag [blank] untuk membuat area kosong yang harus diisi kata. Contoh: Saya suka makan [blank] goreng."
                  : "Tulis pertanyaan di sini. Bisa pakai **markdown**, $LaTeX$, atau upload gambar."
              }
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Question Type">
              <Select
                value={questionForm.question_type}
                onValueChange={(value) =>
                  setQuestionForm((p) => {
                    let newOptions = p.options || [];
                    if (value === "true_false") {
                      newOptions = [
                        {
                          option_text: "True",
                          is_correct: true,
                          sort_order: 1,
                        },
                        {
                          option_text: "False",
                          is_correct: false,
                          sort_order: 2,
                        },
                      ];
                    } else if (value === "short_answer") {
                      newOptions = [
                        {
                          option_text: "",
                          is_correct: true,
                          sort_order: 1,
                        },
                      ];
                    } else if (value === "arrange_words") {
                      newOptions = [
                        { option_text: "", is_correct: true, sort_order: 1 },
                        { option_text: "", is_correct: true, sort_order: 2 },
                      ];
                    } else if (
                      p.question_type === "true_false" ||
                      p.question_type === "short_answer" ||
                      p.question_type === "arrange_words"
                    ) {
                      newOptions = [
                        { option_text: "", is_correct: false, sort_order: 1 },
                        { option_text: "", is_correct: false, sort_order: 2 },
                      ];
                    }
                    return {
                      ...p,
                      question_type: value,
                      options: newOptions,
                    };
                  })
                }
              >
                <SelectTrigger className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-400">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="text-xs"
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Points">
              <Input
                type="number"
                value={questionForm.points || 1}
                onChange={(e) =>
                  setQuestionForm((p) => ({ ...p, points: e.target.value }))
                }
              />
            </Field>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
            <div>
              <Label
                htmlFor="question-always-correct"
                className="cursor-pointer text-sm font-semibold text-emerald-950"
              >
                Always correct / always true
              </Label>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                Jawaban apa pun akan mendapat poin penuh. Pertanyaan yang tidak
                dijawab tetap tidak mendapat poin.
              </p>
            </div>
            <Switch
              id="question-always-correct"
              checked={!!questionForm.always_correct}
              onCheckedChange={(checked) =>
                setQuestionForm((p) => ({ ...p, always_correct: checked }))
              }
              className="mt-0.5 data-[state=checked]:bg-emerald-600"
            />
          </div>

          <Field label="Explanation (opsional, ditampilkan setelah submit)">
            <MarkdownEditor
              value={questionForm.explanation}
              onChange={(val) =>
                setQuestionForm((p) => ({ ...p, explanation: val }))
              }
              rows={3}
              placeholder="Penjelasan jawaban, boleh markdown / gambar juga."
            />
          </Field>

          {questionForm.question_type === "short_answer" && (
            <Field label="Correct Answer">
              <Input
                placeholder="Tulis kunci jawaban yang benar di sini"
                value={questionForm.options?.[0]?.option_text || ""}
                onChange={(e) => {
                  setQuestionForm((p) => {
                    const currentOpts = p.options || [];
                    const newOpts = [...currentOpts];
                    if (newOpts.length === 0) {
                      newOpts.push({
                        option_text: e.target.value,
                        is_correct: true,
                        sort_order: 1,
                      });
                    } else {
                      newOpts[0] = {
                        ...newOpts[0],
                        option_text: e.target.value,
                        is_correct: true,
                        sort_order: 1,
                      };
                    }
                    return { ...p, options: newOpts };
                  });
                }}
              />
            </Field>
          )}

          {questionForm.question_type !== "short_answer" && (
            <div className="space-y-2">
              <Label className="flex justify-between items-end text-xs font-semibold text-zinc-700">
                <span>Options</span>
                {questionForm.question_type === "arrange_words" && (
                  <span className="text-[10px] font-normal text-zinc-500 max-w-[200px] text-right">
                    Centang kunci jawaban & sesuaikan urutannya dengan kemunculan [blank]
                  </span>
                )}
              </Label>
              {(questionForm.options || []).map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-600 border-zinc-300 shrink-0"
                    checked={!!option.is_correct}
                    onChange={(e) =>
                      setQuestionForm((p) => ({
                        ...p,
                        options: p.options.map((o, i) =>
                          i === index
                            ? { ...o, is_correct: e.target.checked }
                            : o
                        ),
                      }))
                    }
                  />
                  <Input
                    value={option.option_text || ""}
                    onChange={(e) =>
                      setQuestionForm((p) => ({
                        ...p,
                        options: p.options.map((o, i) =>
                          i === index
                            ? {
                                ...o,
                                option_text: e.target.value,
                                sort_order: index + 1,
                              }
                            : o
                        ),
                      }))
                    }
                    className="h-8 text-xs"
                    disabled={questionForm.question_type === "true_false"}
                  />
                  {questionForm.question_type !== "true_false" &&
                    (questionForm.options || []).length > 2 && (
                      <button
                        type="button"
                        title="Hapus option"
                        onClick={() =>
                          setQuestionForm((p) => ({
                            ...p,
                            options: p.options.filter((_, i) => i !== index),
                          }))
                        }
                        className="text-zinc-400 hover:text-red-500 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                </div>
              ))}
              {questionForm.question_type !== "true_false" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setQuestionForm((p) => ({
                      ...p,
                      options: [
                        ...(p.options || []),
                        {
                          option_text: "",
                          is_correct: false,
                          sort_order: (p.options || []).length + 1,
                        },
                      ],
                    }))
                  }
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" /> Tambah Option
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Kolom kanan: live preview kartu soal ini, persis tampilan peserta */}
        <div className="lg:border-l lg:pl-5">
          <Label className="text-xs font-semibold text-zinc-700 mb-2 block">
            Preview Soal
          </Label>
          <QuestionPreviewCard question={questionForm} index={0} showKey />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-8 text-xs"
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
        >
          <Save className="mr-2 h-3.5 w-3.5" /> Simpan Soal
        </Button>
      </div>
    </section>
  );
}


export default QuestionForm
