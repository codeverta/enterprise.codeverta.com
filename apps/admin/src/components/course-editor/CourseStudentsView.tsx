import React, { useEffect, useState } from "react";
import { Search, Mail, Calendar, FileText, Download, UserCheck, CheckCircle2, AlertCircle, Award, Loader2, Sparkles } from "lucide-react";
import dayjs from "dayjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function CourseStudentsView({ courseId, api, toast, view = "students" }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Grading Modal State
  const [gradeModal, setGradeModal] = useState(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [grading, setGrading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch enrolled students
  const fetchStudents = async () => {
    if (!courseId) return;
    setLoadingStudents(true);
    try {
      const res = await api.get(`/lms/admin/courses/${courseId}/students`, {
        params: { search: debouncedSearch },
      });
      setStudents(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      toast.error("Gagal memuat daftar siswa.");
    } finally {
      setLoadingStudents(false);
    }
  };

  // Fetch assignments
  const fetchAssignments = async () => {
    if (!courseId) return;
    setLoadingAssignments(true);
    try {
      const res = await api.get(`/lms/admin/courses/${courseId}/assignments`);
      setAssignments(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to fetch assignments:", err);
      toast.error("Gagal memuat daftar tugas.");
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    if (view === "students") {
      fetchStudents();
    } else {
      fetchAssignments();
    }
  }, [courseId, view, debouncedSearch]);

  const handleGradeAssignment = async () => {
    if (!gradeModal) return;
    const scoreVal = parseFloat(gradeScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      toast.error("Nilai harus berupa angka antara 0 - 100");
      return;
    }
    setGrading(true);
    try {
      await api.post(`/lms/assignments/${gradeModal.id}/grade`, {
        score: scoreVal,
        feedback: gradeFeedback,
      });
      toast.success("Tugas berhasil dinilai.");
      setGradeModal(null);
      fetchAssignments();
    } catch (err) {
      console.error("Failed to grade assignment:", err);
      toast.error("Gagal menilai tugas.");
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900">
            {view === "students" ? "Peserta Course" : "Evaluasi Tugas"}
          </h2>
          <p className="text-xs text-zinc-500 mt-px">
            {view === "students"
              ? "Daftar siswa yang terdaftar dalam course ini."
              : "Kelola dan beri nilai terhadap tugas lampiran yang dikumpulkan siswa."
            }
          </p>
        </div>
      </div>

      {view === "students" ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Cari nama siswa atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Enrolled Students Table/List */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
            {loadingStudents ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-600" />
                <p className="text-xs font-medium">Memuat data siswa...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Tidak ada siswa ditemukan</p>
                <p className="text-[11px] opacity-70 mt-1">
                  Siswa yang terdaftar dalam course ini akan muncul di sini.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 font-semibold text-zinc-600">
                    <th className="p-3.5 pl-4">Nama Siswa</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4 text-right">Tanggal Gabung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {students.map((student) => {
                    const studentName = student.first_name || student.last_name
                      ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                      : student.display_name || student.email || "Siswa";

                    return (
                      <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="p-3.5 pl-4 font-semibold text-zinc-900 flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          {studentName}
                        </td>
                        <td className="p-3.5 text-zinc-500 font-mono">{student.email}</td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right text-zinc-500 font-medium">
                          {dayjs(student.created_at).format("DD MMM YYYY")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Assignments list sorted by latest */
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
            {loadingAssignments ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-600" />
                <p className="text-xs font-medium">Memuat berkas tugas...</p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Belum ada tugas dikumpulkan</p>
                <p className="text-[11px] opacity-70 mt-1">
                  Semua tugas siswa terkumpul akan muncul di halaman ini.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 font-semibold text-zinc-600">
                    <th className="p-3.5 pl-4">Siswa</th>
                    <th className="p-3.5">Materi / Lesson</th>
                    <th className="p-3.5">Berkas Tugas</th>
                    <th className="p-3.5">Status & Nilai</th>
                    <th className="p-3.5">Tgl Upload</th>
                    <th className="p-3.5 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {assignments.map((assignment) => {
                    const student = assignment.student || {};
                    const lesson = assignment.lesson || {};
                    const isGraded = assignment.status === "graded";
                    return (
                      <tr key={assignment.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="p-3.5 pl-4 flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-700 text-[10px]">
                            {student.name ? student.name.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900">{student.name || "N/A"}</p>
                            <p className="text-[10px] text-zinc-400 font-mono">{student.email}</p>
                          </div>
                        </td>
                        <td className="p-3.5 max-w-[160px] truncate">
                          <p className="font-medium text-zinc-800">{lesson.title || "N/A"}</p>
                        </td>
                        <td className="p-3.5">
                          <a
                            href={assignment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {assignment.file_name || "Download"}
                          </a>
                        </td>
                        <td className="p-3.5">
                          {isGraded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Nilai: {assignment.score}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="h-3 w-3" />
                              Perlu Dinilai
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-zinc-500 font-medium">
                          {dayjs(assignment.created_at).format("DD MMM YYYY, HH:mm")}
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          <Button
                            size="sm"
                            variant={isGraded ? "outline" : "default"}
                            className={isGraded ? "h-7 text-[10px]" : "h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"}
                            onClick={() => {
                              setGradeModal(assignment);
                              setGradeScore(assignment.score !== null ? String(assignment.score) : "");
                              setGradeFeedback(assignment.feedback || "");
                            }}
                          >
                            {isGraded ? "Edit Nilai" : "Beri Nilai"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Grading dialog */}
      <Dialog open={gradeModal !== null} onOpenChange={(open) => !open && setGradeModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Beri Nilai Tugas Siswa</DialogTitle>
          </DialogHeader>
          {gradeModal && (
            <div className="space-y-4 py-2">
              <div className="bg-zinc-50 border p-3 rounded-lg text-xs space-y-1">
                <p><span className="font-semibold text-zinc-500">Siswa:</span> {gradeModal.student?.name}</p>
                <p><span className="font-semibold text-zinc-500">Materi:</span> {gradeModal.lesson?.title}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="grade-score" className="text-xs font-semibold">Nilai (0 - 100)</Label>
                <Input
                  id="grade-score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Contoh: 85"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="grade-feedback" className="text-xs font-semibold">Feedback Guru (Opsional)</Label>
                <Textarea
                  id="grade-feedback"
                  placeholder="Tulis saran atau evaluasi mengenai pengerjaan tugas siswa..."
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setGradeModal(null)} disabled={grading}>
              Batal
            </Button>
            <Button size="sm" onClick={handleGradeAssignment} disabled={grading} className="bg-indigo-600 hover:bg-indigo-700">
              {grading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Simpan Penilaian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
