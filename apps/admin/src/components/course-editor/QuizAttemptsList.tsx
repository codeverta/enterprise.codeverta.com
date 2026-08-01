import React, { useEffect, useState } from "react";
import { Users, Award, Calendar, ChevronDown, ChevronUp, Clock, HelpCircle, Loader2, PlayCircle, Trophy } from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function QuizAttemptsList({ quizId }) {
  const [loading, setLoading] = useState(false);
  const [attemptsInfo, setAttemptsInfo] = useState([]);
  const [expandedStudent, setExpandedStudent] = useState(null);

  const fetchAttempts = async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const res = await api.get(`/lms/admin/quizzes/${quizId}/attempts`);
      const data = res.data?.data;
      setAttemptsInfo(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch quiz attempts:", err);
      toast.error("Gagal memuat riwayat pengerjaan kuis siswa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400 border border-dashed rounded-xl bg-zinc-50/50">
        <Loader2 className="h-6 w-6 animate-spin mb-1.5 text-indigo-600" />
        <p className="text-xs font-medium">Memuat riwayat pengerjaan kuis...</p>
      </div>
    );
  }

  if (attemptsInfo.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed rounded-xl bg-zinc-50/50 text-zinc-400">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-30 text-zinc-500" />
        <p className="text-xs font-semibold text-zinc-500">Belum ada siswa yang mengerjakan kuis ini</p>
        <p className="text-[10px] opacity-70 mt-0.5">
          Riwayat beserta nilai attempt siswa akan tercatat otomatis di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 mt-6 border-t pt-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          Riwayat Ujian & Hasil Siswa
        </h3>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100 font-semibold text-zinc-600">
              <th className="p-3 pl-4">Siswa</th>
              <th className="p-3 text-center">Jumlah Attempt</th>
              <th className="p-3 text-center">Nilai Terbaik</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 pr-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">
            {attemptsInfo.map((info) => {
              const student = info.student || {};
              const isExpanded = expandedStudent === student.id;
              return (
                <React.Fragment key={student.id}>
                  <tr className="hover:bg-zinc-50/30 transition-colors">
                    <td className="p-3 pl-4 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-700 text-[10px]">
                        {student.name ? student.name.charAt(0).toUpperCase() : "S"}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">{student.name || "N/A"}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{student.email}</p>
                      </div>
                    </td>
                    <td className="p-3 text-center font-semibold text-zinc-600">
                      {info.attempts?.length || 0}x
                    </td>
                    <td className="p-3 text-center font-bold text-indigo-600">
                      {info.best_score?.toFixed(1) || "0.0"}
                    </td>
                    <td className="p-3 text-center">
                      {info.is_passed ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-[9px] font-bold">
                          LULUS
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50 text-[9px] font-bold">
                          GAGAL
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <button
                        onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 transition-colors font-medium"
                      >
                        {isExpanded ? (
                          <>
                            Tutup <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Riwayat <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-zinc-50/40">
                      <td colSpan={5} className="p-3 pl-6 pr-4 border-t border-zinc-100/50">
                        <div className="rounded-lg border bg-white p-3 space-y-2">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Daftar Percobaan (Attempts)
                          </p>
                          <div className="space-y-1.5">
                            {(info.attempts || []).map((att, i) => (
                              <div
                                key={att.id}
                                className="flex items-center justify-between text-xs py-2 px-2.5 rounded-md hover:bg-zinc-50 border border-dashed transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-zinc-500">
                                    Attempt #{att.attempt_number}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {Math.floor(att.duration_sec / 60)}m {att.duration_sec % 60}s
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>
                                      {dayjs(att.submitted_at || att.started_at).format("DD MMM YYYY, HH:mm")}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-zinc-400 text-[10px]">
                                    Poin: {att.correct_points} / {att.total_points}
                                  </span>
                                  <span className="font-bold text-zinc-900 bg-zinc-50 px-2 py-0.5 rounded border font-mono">
                                    {att.score?.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] font-semibold">
                                    {att.status === "completed" ? (
                                      <span className="text-emerald-600">Selesai</span>
                                    ) : (
                                      <span className="text-amber-500">Sedang Mengerjakan</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
