import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import dayjs from "dayjs";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Timer,
  Printer,
} from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const getData = (response: any) => response.data?.data || response.data || {};
const formatDate = (value?: string | null) => value ? dayjs(value).format("DD MMM YYYY") : "-";
const formatDateTime = (value?: string | null) => value ? dayjs(value).format("DD MMM YYYY HH:mm") : "-";
const formatScore = (value?: number | null, t?: any) => value == null ? (t ? t("parent.student.not_graded") : "Not graded yet") : `${Number(value).toFixed(1)}%`;

function initials(name?: string) {
  return String(name || "Student").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active" || normalized === "graded" || normalized === "completed") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{status}</Badge>;
  }
  if (normalized === "submitted" || normalized === "pending_renewal" || normalized === "in_progress") {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{String(status).replaceAll("_", " ")}</Badge>;
  }
  if (normalized === "expired" || normalized === "returned") {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{status}</Badge>;
  }
  return <Badge variant="outline">{status || "none"}</Badge>;
}

function SummaryTile({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function CircularProgress({ percentage, size = 80, strokeWidth = 8, colorClass = "text-indigo-600" }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center animate-in fade-in zoom-in duration-300" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-zinc-100"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-500 ease-out", colorClass)}
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-[11px] font-bold text-zinc-800">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

function ParentStudentDetailPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { student_id } = useParams();
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const activeTab = searchParams.get("tab") || "overview";
  const isMentorOrAdmin = Number(user?.role || 0) === 30 || Number(user?.role || 0) >= 99;

  const categoryProgress = useMemo(() => {
    if (!detail?.course_progress_details) return [];
    
    // Group courses by category name
    const grouped: Record<string, { scores: number[]; progressSums: number[]; totalCourses: number }> = {};
    detail.course_progress_details.forEach((c: any) => {
      const cat = c.category_name || "Uncategorized";
      if (!grouped[cat]) {
        grouped[cat] = { scores: [], progressSums: [], totalCourses: 0 };
      }
      if (c.average_score !== null) {
        grouped[cat].scores.push(c.average_score);
      }
      grouped[cat].progressSums.push(c.progress_percent || 0);
      grouped[cat].totalCourses++;
    });

    return Object.entries(grouped).map(([categoryName, data]) => {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((sum, val) => sum + val, 0) / data.scores.length
        : null;
      const avgProgress = data.progressSums.reduce((sum, val) => sum + val, 0) / data.totalCourses;
      return {
        category_name: categoryName,
        average_score: avgScore,
        progress_percent: avgProgress,
      };
    });
  }, [detail?.course_progress_details]);

  useEffect(() => {
    // if (Number(user?.role || 0) !== 10) {
    //   navigate("/dashboard", { replace: true });
    //   return;
    // }
    load();
  }, [student_id]);

  const load = async () => {
    setLoading(true);
    try {
      const [detailRes, progressRes, assignmentRes] = await Promise.all([
        api.get(`/lms/parent/students/${student_id}`),
        api.get(`/lms/parent/students/${student_id}/progress`),
        api.get(`/lms/parent/students/${student_id}/assignments`),
      ]);
      setDetail(getData(detailRes));
      setProgress(getData(progressRes).courses || []);
      setAssignments(getData(assignmentRes).courses || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const student = detail?.student || {};
  const activity = detail?.recent_activity || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (isMentorOrAdmin) {
                navigate("/dashboard/mentor/student-progress");
              } else {
                navigate("/dashboard");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-14 w-14">
            <AvatarImage src={student.avatar_url} />
            <AvatarFallback>
              {initials(student.name || student.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold tracking-tight">
              {student.name || student.full_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {student.email || "Email unavailable"}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load}>
          {t("parent.student.refresh")}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview">{t("parent.student.overview")}</TabsTrigger>
          <TabsTrigger value="progress">{t("parent.student.learning_progress")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("parent.student.assignments")}</TabsTrigger>
          <TabsTrigger value="report">Rapor Nilai</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {!isMentorOrAdmin && (
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>{t("parent.student.info")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("parent.student.subscription")}</span>
                    {statusBadge(student.subscription_status)}
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("parent.student.plan")}</span>
                    <span className="text-right font-medium">
                      {student.subscription_plan || "No active plan"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("parent.student.start_date")}</span>
                    <span>{formatDate(student.subscription_start)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("parent.student.expiry_date")}</span>
                    <span>{formatDate(student.subscription_expiry)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("parent.student.remaining_days")}</span>
                    <span>{student.remaining_days ?? "-"}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={isMentorOrAdmin ? "lg:col-span-3" : "lg:col-span-2"}>
              <CardHeader>
                <CardTitle>{t("parent.student.learning_summary")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile
                  label={t("parent.student.courses_started")}
                  value={student.courses_started || 0}
                  icon={BookOpen}
                />
                <SummaryTile
                  label={t("parent.student.courses_completed")}
                  value={student.courses_completed || 0}
                  icon={CheckCircle2}
                />
                <SummaryTile
                  label={t("parent.student.lessons_completed")}
                  value={student.lessons_completed || 0}
                  icon={CheckCircle2}
                />
                <SummaryTile
                  label={t("parent.student.lessons_in_progress")}
                  value={student.lessons_in_progress || 0}
                  icon={Timer}
                />
                <SummaryTile
                  label={t("parent.student.average_progress")}
                  value={`${student.average_progress_percentage || 0}%`}
                  icon={BookOpen}
                />
                <SummaryTile
                  label={t("parent.student.average_score")}
                  value={
                    student.average_score == null
                      ? "-"
                      : `${student.average_score}%`
                  }
                  icon={Award}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("parent.student.assignment_summary")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label={t("parent.student.submitted")}
                  value={student.assignments_submitted || 0}
                  icon={FileText}
                />
                <SummaryTile
                  label={t("parent.student.graded")}
                  value={student.assignments_graded || 0}
                  icon={Award}
                />
                <SummaryTile
                  label={t("parent.student.pending")}
                  value={student.assignments_pending || 0}
                  icon={Timer}
                />
                <SummaryTile
                  label={t("parent.student.status")}
                  value={student.assignments_returned || 0}
                  icon={MessageSquareText}
                />
                <SummaryTile
                  label={t("parent.student.latest_submission")}
                  value={formatDate(student.latest_assignment_submission)}
                  icon={FileText}
                />
                <SummaryTile
                  label={t("parent.student.latest_grade")}
                  value={formatDate(student.latest_assignment_grade)}
                  icon={Award}
                />
                <SummaryTile
                  label={t("parent.student.latest_activity")}
                  value={formatDate(student.last_activity_at)}
                  icon={Timer}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("parent.student.recent_activity_timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("parent.student.no_recent_activity")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activity.map((item: any, index: number) => (
                      <div key={`${item.type}-${index}`} className="flex gap-3">
                        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                        <div className="min-w-0">
                          <p className="font-medium">{item.title}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {item.course_name || item.description}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDateTime(item.occurred_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {progress.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center text-muted-foreground">
                {t("parent.student.no_lessons")}
              </CardContent>
            </Card>
          ) : (
            progress.map((course: any) => (
              <Card key={course.course_id}>
                <CardHeader>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <CardTitle>{course.course_name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {course.completed_lessons} / {course.total_lessons}{" "}
                        {t("parent.student.lessons_completed_count")}
                      </p>
                    </div>
                    <Badge variant="outline">{course.progress_percent}%</Badge>
                  </div>
                  <Progress
                    value={Number(course.progress_percent || 0)}
                    className="mt-3"
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.modules?.map((module: any) => (
                    <div
                      key={module.module_id}
                      className="rounded-md border p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">
                            {module.module_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {module.completed_lessons} / {module.total_lessons}{" "}
                            {t("parent.student.completed")}
                          </p>
                        </div>
                        <span className="text-sm font-medium">
                          {module.progress_percent}%
                        </span>
                      </div>
                      <div className="space-y-2">
                        {module.lessons?.map((lesson: any) => (
                          <div
                            key={lesson.lesson_id}
                            className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm md:grid-cols-[1fr_120px_120px_140px] md:items-center"
                          >
                            <div className="font-medium">
                              {lesson.is_completed ? "✓ " : "⏳ "}
                              {lesson.lesson_name}
                            </div>
                            <div>{statusBadge(lesson.status)}</div>
                            <div>
                              {Number(lesson.progress_percent || 0).toFixed(1)}%
                            </div>
                            <div className="text-muted-foreground">
                              {formatDate(lesson.last_activity_at)}
                            </div>
                            <div className="text-muted-foreground md:col-span-4">
                              Last position: {lesson.last_position_sec || 0}s ·
                              Completed: {formatDateTime(lesson.completed_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          {assignments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center text-muted-foreground">
                {t("parent.student.no_assignments")}
              </CardContent>
            </Card>
          ) : (
            assignments.map((course: any) => (
              <Card key={course.course_id}>
                <CardHeader>
                  <CardTitle>{course.course_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.modules?.map((module: any) => (
                    <div key={module.module_id} className="space-y-3">
                      <h3 className="font-semibold">{module.module_name}</h3>
                      {module.lessons?.map((lesson: any) => (
                        <div
                          key={lesson.lesson_id}
                          className="space-y-3 rounded-md border p-4"
                        >
                          <h4 className="font-medium">{lesson.lesson_name}</h4>
                          {lesson.assignments?.map((assignment: any) => (
                            <div
                              key={assignment.id}
                              className="rounded-md bg-muted/40 p-4"
                            >
                              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {assignment.file_name}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {assignment.note || t("parent.student.no_submission_note")}
                                  </p>
                                </div>
                                {statusBadge(assignment.status)}
                              </div>
                              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  <p className="text-muted-foreground">{t("parent.student.score")}</p>
                                  <p className="font-medium">
                                    {assignment.score == null
                                      ? t("parent.student.not_graded")
                                      : assignment.score}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    {t("parent.student.max_score")}
                                  </p>
                                  <p className="font-medium">
                                    {assignment.max_score || 100}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    {t("parent.student.percentage")}
                                  </p>
                                  <p className="font-medium">
                                    {formatScore(assignment.percentage_score, t)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    {t("parent.student.submitted")}
                                  </p>
                                  <p className="font-medium">
                                    {formatDateTime(assignment.submitted_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    {t("parent.student.graded")}
                                  </p>
                                  <p className="font-medium">
                                    {formatDateTime(assignment.graded_at)}
                                  </p>
                                </div>
                                <div className="md:col-span-2 xl:col-span-3">
                                  <p className="text-muted-foreground">
                                    {t("parent.student.feedback")}
                                  </p>
                                  <p className="font-medium">
                                    {assignment.feedback || t("parent.student.no_feedback")}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    window.open(
                                      import.meta.env.VITE_COS_CDN_BASE_URL +
                                        "/" +
                                        assignment.file_url,
                                      "_blank"
                                    )
                                  }
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" /> {t("parent.student.view_submission")}
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={assignment.file_url} download>
                                    <Download className="mr-2 h-4 w-4" />{" "}
                                    {t("parent.student.download_submission")}
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card className="no-print">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Rapor Nilai Akademik</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Laporan gabungan nilai kuis dan tugas di setiap course
                </p>
              </div>
              <Button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 text-xs h-9"
              >
                <Printer className="h-4 w-4" />
                Cetak/Unduh PDF
              </Button>
            </CardHeader>
            <CardContent>
              {(!categoryProgress || categoryProgress.length === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada progres kategori terdaftar untuk siswa ini.
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryProgress.map((c: any) => {
                    const hasScore = c.average_score !== null;
                    return (
                      <div key={c.category_name} className="flex flex-col items-center p-5 border rounded-2xl bg-zinc-50/30 hover:bg-zinc-50/70 hover:border-zinc-300 transition-all duration-200">
                        <span className="font-bold text-xs text-zinc-900 uppercase tracking-wider mb-4 border-b pb-1 w-full text-center">
                          {c.category_name}
                        </span>
                        <div className="flex gap-6 items-center justify-center w-full">
                          {/* Average Score */}
                          <div className="flex flex-col items-center">
                            <CircularProgress
                              percentage={hasScore ? c.average_score : 0}
                              size={75}
                              strokeWidth={6}
                              colorClass={hasScore ? "text-indigo-600" : "text-zinc-200"}
                            />
                            <span className="text-[10px] text-zinc-400 font-semibold mt-2">Nilai Rata-rata</span>
                            <span className="text-[11px] font-bold text-zinc-800 mt-0.5">
                              {hasScore ? `${c.average_score.toFixed(1)}%` : "N/A"}
                            </span>
                          </div>
                          {/* Learning Progress */}
                          <div className="flex flex-col items-center">
                            <CircularProgress
                              percentage={c.progress_percent}
                              size={75}
                              strokeWidth={6}
                              colorClass="text-emerald-500"
                            />
                            <span className="text-[10px] text-zinc-400 font-semibold mt-2">Progres Belajar</span>
                            <span className="text-[11px] font-bold text-zinc-800 mt-0.5">
                              {Math.round(c.progress_percent)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Printable Report Document for Single Student (Print Only) */}
          <div className="hidden print:block print-container bg-white p-8 max-w-4xl mx-auto text-black">
            <div className="border-b-2 border-zinc-800 pb-5 mb-6 text-center">
              <h1 className="text-2xl font-bold uppercase tracking-wide">Laporan Hasil Belajar & Akademik Siswa</h1>
              <p className="text-sm text-zinc-500 mt-1 font-medium">LMS Learning Management System</p>
              <p className="text-xs text-zinc-400 mt-0.5">Tanggal Cetak: {dayjs().format("DD MMMM YYYY")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-zinc-50 p-4 border border-zinc-200 rounded-lg">
              <div>
                <p><span className="text-zinc-500">Nama Siswa:</span> <span className="font-bold">{student.name || student.full_name}</span></p>
                <p className="mt-1.5"><span className="text-zinc-500">Email:</span> <span className="font-mono">{student.email}</span></p>
              </div>
              <div>
                <p><span className="text-zinc-500">Paket Subskripsi:</span> <span className="font-bold">{student.subscription_plan || "No active plan"}</span></p>
                <p className="mt-1.5"><span className="text-zinc-500">Status Subskripsi:</span> <span className="font-bold">{student.subscription_status || "Inactive"}</span></p>
              </div>
            </div>

            <table className="w-full border-collapse border border-zinc-300 text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-zinc-300 p-3 text-left">Kategori</th>
                  <th className="border border-zinc-300 p-3 text-center">Progres Belajar</th>
                  <th className="border border-zinc-300 p-3 text-center">Nilai Rata-rata (Quiz + Tugas)</th>
                </tr>
              </thead>
              <tbody>
                {categoryProgress.map((c: any) => (
                  <tr key={c.category_name}>
                    <td className="border border-zinc-300 p-3 font-bold">{c.category_name}</td>
                    <td className="border border-zinc-300 p-3 text-center">{Math.round(c.progress_percent)}%</td>
                    <td className="border border-zinc-300 p-3 text-center font-bold text-zinc-900">
                      {c.average_score !== null ? `${c.average_score.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-16 flex justify-between text-xs text-zinc-500">
              <div>
                <p>Dicetak Oleh:</p>
                <p className="mt-8 font-bold border-t border-zinc-300 pt-1 w-40 text-center">Sistem Akademik LMS</p>
              </div>
              <div className="text-right">
                <p>Mengetahui,</p>
                <p className="mt-8 font-bold border-t border-zinc-300 pt-1 w-40 text-center">Administrator LMS</p>
              </div>
            </div>
          </div>

          <style>{`
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              nav, aside, header, footer, button, .no-print, [role="navigation"] {
                display: none !important;
              }
              .print-container {
                display: block !important;
                width: 100% !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                margin: 0 !important;
                padding: 10px !important;
              }
            }
          `}</style>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashboardLayout(ParentStudentDetailPage);
