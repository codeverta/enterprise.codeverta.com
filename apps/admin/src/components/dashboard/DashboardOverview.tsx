import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Flame,
  GraduationCap,
  PlayCircle,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ExploreOtherCourses from "./ExploreOtherCourses";


const rupiah = (value = 0) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
const percent = (value = 0) => `${Math.round(Number(value || 0))}%`;
const list = (value) => (Array.isArray(value) ? value : []);
const paymentStatusLabels: Record<string, string> = {
  cnt_paid: "Berhasil",
  cnt_pending: "Pending",
  cnt_expired: "Gagal",
  total_revenue: "Pendapatan",
};
const relativeDate = (value) => {
  if (!value) return "-";
  const days = dayjs().diff(dayjs(value), "day");
  if (days <= 0) return "hari ini";
  if (days === 1) return "1 hari lalu";
  return `${days} hari lalu`;
};

const roleLabel = (role) => {
  if (role === 10) return "Parent";
  if (role === 20) return "Student";
  if (role === 30) return "Instructor";
	if (role === 100) return "Superadmin";
  if (role >= 99) return "Admin";
  return "User";
};

const getCurrentRole = (payloadRole) => {
  if (Number(payloadRole || 0) > 0) return Number(payloadRole);
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return Number(user?.role || 0);
  } catch {
    return 0;
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {dayjs(label).format("DD MMMM YYYY")}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          return (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                {paymentStatusLabels[entry.name] || entry.name}
              </span>
              <span className="font-semibold text-slate-900">
                {entry.name === "total_revenue" ? rupiah(entry.value) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, description }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-xl font-bold text-slate-950">{value}</div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </CardContent>
  </Card>
);

const EmptyState = ({ children }) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
    {children}
  </div>
);

const StudentDashboard = ({ data }) => {
  const progress = data?.learning_progress || {};
  const courses = list(progress.courses);
  const resume = data?.continue_learning;
  const stats = data?.study_stats || {};
  const certificates = data?.certificates || {};
  const deadlines = list(data?.deadlines);
  const classes = list(data?.upcoming_classes);
  const grades = list(data?.latest_grades);
  const achievements = list(data?.achievements);
  const announcements = list(data?.announcements);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Progress Belajar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Semua kursus</span>
                <span className="font-semibold text-slate-950">
                  {percent(progress.overall_percent)}
                </span>
              </div>
              <Progress value={Number(progress.overall_percent || 0)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Modul selesai</p>
                <p className="text-2xl font-bold text-emerald-950">
                  {progress.completed_modules || 0}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Modul tersisa</p>
                <p className="text-2xl font-bold text-amber-950">
                  {progress.remaining_modules || 0}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {courses.length ? (
                courses.map((course) => (
                  <div key={course.course_id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">
                        {course.course_title}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {percent(course.progress_percent)}
                      </span>
                    </div>
                    <Progress value={Number(course.progress_percent || 0)} />
                  </div>
                ))
              ) : (
                <EmptyState>Belum ada progress kursus.</EmptyState>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListPanel
          title="Nilai Terbaru"
          icon={<Star className="h-4 w-4 text-amber-500" />}
        >
          {grades.length ? (
            grades.map((grade, index) => (
              <div
                key={`${grade.title}-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
              >
                <span className="font-medium text-slate-800">
                  {grade.title}
                </span>
                <span className="text-lg font-bold text-slate-950">
                  {Math.round(Number(grade.score || 0))}
                </span>
              </div>
            ))
          ) : (
            <EmptyState>Belum ada nilai quiz.</EmptyState>
          )}
        </ListPanel>

        <ListPanel
          title="Achievement"
          icon={<Trophy className="h-4 w-4 text-yellow-600" />}
        >
          {achievements.length ? (
            achievements.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-slate-100 p-3"
              >
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            ))
          ) : (
            <EmptyState>
              Achievement akan muncul setelah kamu mulai belajar.
            </EmptyState>
          )}
        </ListPanel>
      </div>

      <ListPanel
        title="Pengumuman"
        icon={<AlertCircle className="h-4 w-4 text-slate-600" />}
      >
        {announcements.length ? (
          announcements.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700"
            >
              {item.message || item.title}
            </div>
          ))
        ) : (
          <EmptyState>Belum ada pengumuman baru.</EmptyState>
        )}
      </ListPanel>

    </div>
  );
};

const ListPanel = ({ title, icon, children }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">{children}</CardContent>
  </Card>
);

const InstructorDashboard = ({ data }) => {
  const summary = data?.summary || {};
  const analytics = data?.analytics || {};
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    api.get("/lms/my-wallet").then((res) => {
      const d = res.data?.data || res.data;
      setWallet(d?.wallet || null);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {wallet && (
          <StatCard
            title="Saldo Dompet"
            value={rupiah(wallet.available_balance ?? wallet.balance)}
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          />
        )}
        <StatCard
          title="Total Siswa"
          value={summary.total_students || 0}
          icon={<Users className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Kursus Aktif"
          value={summary.active_courses || 0}
          icon={<BookOpen className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Menunggu Review"
          value={summary.assignment_pending_review || 0}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          title="Rata-rata Completion"
          value={percent(summary.average_completion_rate)}
          icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingPanel
          title="Course Completion Rate"
          items={list(analytics.course_completion_rate)}
          valueKey="completion_rate"
          valueFormatter={percent}
        />
        <RankingPanel
          title="Most Active Students"
          items={list(analytics.most_active_students)}
          titleKey="name"
          valueKey="activity_count"
        />
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Average Score"
            value={Math.round(Number(analytics.average_score || 0))}
            icon={<Award className="h-4 w-4 text-amber-600" />}
          />
          <EmptyState>
            Aktivitas terbaru akan tampil saat siswa submit quiz atau
            assignment.
          </EmptyState>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminLMSDashboard = ({ data }) => {
  const revenue = data?.revenue || {};
  const users = data?.users || {};
  const analytics = data?.course_analytics || {};
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Pendapatan Bulan Ini" value={rupiah(revenue.month)} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} />
        <StatCard title="Pendapatan Hari Ini" value={rupiah(revenue.today)} icon={<TrendingUp className="h-4 w-4 text-blue-600" />} />
        <StatCard title="Total Transaksi LMS" value={revenue.total_transactions || 0} icon={<CheckCircle className="h-4 w-4 text-violet-600" />} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Siswa" value={users.total_students || 0} icon={<Users className="h-4 w-4 text-blue-600" />} />
        <StatCard title="Siswa Aktif Hari Ini" value={users.active_today || 0} icon={<Flame className="h-4 w-4 text-rose-600" />} />
        <StatCard title="Registrasi Baru" value={users.new_registrations || 0} icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankingPanel title="Kursus Paling Laris" items={list(analytics.top_selling_courses)} valueKey="total" />
        <RankingPanel title="Completion Tertinggi" items={list(analytics.top_completion_courses)} valueKey="completion_rate" valueFormatter={percent} />
        <RankingPanel title="Rating Terbaik" items={list(analytics.top_rated_courses)} valueKey="rating" />
      </div>
    </div>
  );
};

const RankingPanel = ({ title, items, titleKey = "title", valueKey, valueFormatter = (value) => value }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {items.length ? items.map((item, index) => (
        <div key={`${item[titleKey]}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{item[titleKey] || "-"}</p>
            <p className="text-xs text-slate-500">#{index + 1}</p>
          </div>
          <span className="shrink-0 font-bold text-slate-950">{valueFormatter(item[valueKey] || 0)}</span>
        </div>
      )) : <EmptyState>Belum ada data.</EmptyState>}
    </CardContent>
  </Card>
);

const Dashboard = ({ dateRange }) => {
  const [data, setData] = useState({ summary: { revenue: 0, transactions: 0 }, chart_data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    try {
      setLoading(true);
      const response = await api.get("/dashboard/overview", {
        params: {
          start_date: dayjs(dateRange.from).format("YYYY-MM-DD"),
          end_date: dayjs(dateRange.to).format("YYYY-MM-DD"),
        },
      });
      setData(response.data || {});
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Gagal mengambil data dashboard");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const role = useMemo(() => getCurrentRole(data?.lms?.role), [data?.lms?.role]);

  if (loading && !list(data.chart_data).length) {
    return <div className="flex h-screen items-center justify-center font-medium">Memuat Data...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-red-500">
        <AlertCircle size={40} />
        <p>{error}</p>
        <button onClick={fetchStats} className="text-blue-500 underline">Coba Lagi</button>
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            {role >= 99
              ? "Dashboard Admin"
              : role === 30
              ? "Dashboard Instructor"
              : "Dashboard Belajar"}
          </h2>
          <p className="my-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Update otomatis setiap 1 menit.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/courses">
            Lihat Courses
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {role >= 99 ? (
        <>
          <AdminLMSDashboard data={data?.lms?.admin} />
          {/* <OperationalDashboard data={data} /> */}
        </>
      ) : role === 30 ? (
        <InstructorDashboard data={data?.lms?.instructor} />
      ) : (
        <StudentDashboard data={data?.lms?.student} />
      )}
    </div>
  );
};

export default Dashboard;
