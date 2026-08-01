import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModuleQuizSection from "./ModuleQuizSection";
import QuizAttemptsList from "./QuizAttemptsList";

export const QuizEditor = ({
  lessonForm,
  setLessonForm,
  lessonsByModule,
  course,
  api,
  toast,
  loadModules,
}) => {
  return (
    <div className="mx-auto p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-zinc-900">
          Quiz Baru untuk {lessonForm.lesson_id ? "Lesson" : "Modul"}
        </h2>
        <p className="text-xs text-zinc-500">
          {lessonForm.lesson_id
            ? "Quiz ini akan muncul di dalam lesson dan wajib selesai sebelum partner melanjutkan."
            : "Inisialisasi awal modul ujian kompetensi."}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        {lessonForm.lesson_id && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Quiz ini akan muncul di lesson:{" "}
            <span className="font-semibold">
              {
                (lessonsByModule[lessonForm.module_id] || []).find(
                  (lesson) => lesson.id === lessonForm.lesson_id
                )?.title
              }
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Nama / Judul Quiz</Label>
          <Input
            placeholder="cth: Kuis Evaluasi Aljabar Dasar"
            value={lessonForm.title || ""}
            onChange={(e) =>
              setLessonForm((p) => ({ ...p, title: e.target.value }))
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={async () => {
              if (!lessonForm.title?.trim())
                return toast.error("Judul wajib diisi");
              try {
                await api.post("/lms/admin/quizzes", {
                  title: lessonForm.title,
                  course_id: course?.id,
                  module_id: lessonForm.module_id,
                  lesson_id: lessonForm.lesson_id || null,
                  passing_score: 70,
                  time_limit_min: 30,
                  require_passing_score_before_continue: true,
                });
                toast.success("Quiz berhasil dibuat!");
                if (loadModules) {
                  loadModules(course?.id);
                } else if (course?.id) {
                  window.location.reload();
                }
              } catch {
                toast.error("Gagal membuat data master quiz");
              }
            }}
          >
            Konfirmasi & Buat
          </Button>
        </div>
      </div>
    </div>
  );
};

export const QuizManageView = ({
  course,
  selectedModuleId,
  selectedLessonId,
  canManageCourses,
  loadModules,
}) => {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-8xl mx-auto">
      <div className="flex items-center justify-between border-b pb-3 mb-2">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Manajemen Quiz</h2>
          <p className="text-xs text-zinc-500">
            Kelola pertanyaan dan evaluasi ujian pada modul ini.
          </p>
        </div>
      </div>

      <ModuleQuizSection
        courseId={course?.id}
        moduleId={selectedModuleId}
        quizId={selectedLessonId}
        isAdmin={canManageCourses}
        onQuizDeleted={() => loadModules(course?.id)}
      />

      {canManageCourses && selectedLessonId && (
        <QuizAttemptsList quizId={selectedLessonId} />
      )}
    </div>
  );
};
