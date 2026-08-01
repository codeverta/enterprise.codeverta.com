import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import dayjs from "dayjs";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  GraduationCap,
  Loader2,
  Users,
} from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SubscriptionReminderBanner from "@/components/dashboard/SubscriptionReminderBanner";
import ExploreOtherCourses from "@/components/dashboard/ExploreOtherCourses";

const getData = (response: any) => response.data?.data || response.data || {};

const formatDate = (value?: string | null) => value ? dayjs(value).format("DD MMM YYYY") : "-";
const formatDateTime = (value?: string | null) => value ? dayjs(value).format("DD MMM YYYY HH:mm") : "-";
const formatScore = (value?: number | null) => value == null ? "-" : `${Number(value).toFixed(1)}%`;

function subscriptionBadge(status?: string) {
  if (status === "active") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
  if (status === "pending_renewal") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending Renewal</Badge>;
  if (status === "expired" || status === "none") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expired</Badge>;
  return <Badge variant="outline">{status || "No Subscription"}</Badge>;
}

function initials(name?: string) {
  return String(name || "Student").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function StatCard({ label, value, icon: Icon, tone = "blue" }: any) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
  }[tone] || "bg-blue-50 text-blue-600";
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ParentDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  useEffect(() => {
    if (Number(user?.role || 0) !== 10) {
      navigate("/dashboard", { replace: true });
      return;
    }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryRes, studentsRes] = await Promise.all([
        api.get("/lms/parent/dashboard"),
        api.get("/lms/parent/students"),
      ]);
      setSummary(getData(summaryRes));
      const payload = getData(studentsRes);
      setStudents(Array.isArray(payload) ? payload : payload.students || []);
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <SubscriptionReminderBanner />
      <div>
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Parent Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor learning progress, subscriptions, assignments, and recent
              student activity.
            </p>
          </div>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Children"
            value={summary?.total_children || 0}
            icon={Users}
          />
          <StatCard
            label="Active Subscriptions"
            value={summary?.active_subscriptions || 0}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="Expired Subscriptions"
            value={summary?.expired_subscriptions || 0}
            icon={AlertTriangle}
            tone="red"
          />
          <StatCard
            label="Courses Started"
            value={summary?.courses_started || 0}
            icon={BookOpen}
            tone="violet"
          />
          <StatCard
            label="Courses Completed"
            value={summary?.courses_completed || 0}
            icon={GraduationCap}
            tone="emerald"
          />
          <StatCard
            label="Lessons Completed"
            value={summary?.lessons_completed || 0}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="Assignments Submitted"
            value={summary?.assignments_submitted || 0}
            icon={FileCheck2}
          />
          <StatCard
            label="Assignments Graded"
            value={summary?.assignments_graded || 0}
            icon={Award}
            tone="amber"
          />
          <StatCard
            label="Average Score"
            value={formatScore(summary?.average_score)}
            icon={Award}
            tone="violet"
          />
          <StatCard
            label="Last Activity"
            value={formatDate(summary?.last_activity_at)}
            icon={Activity}
            tone="amber"
          />
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Children Overview
            </h2>
          </div>

          {students.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  You don't have any children linked to your account yet.
                </h3>
                <Button
                  className="mt-5"
                  onClick={() => navigate("/dashboard/akun-anak")}
                >
                  Link Existing Student
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {students.map((student) => (
                <Card
                  key={student.student_id || student.id}
                  className="border-border shadow-sm"
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={student.avatar_url} />
                        <AvatarFallback>
                          {initials(student.name || student.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {student.name || student.full_name}
                        </CardTitle>
                        <p className="truncate text-sm text-muted-foreground">
                          {student.email || "Email unavailable"}
                        </p>
                      </div>
                    </div>
                    {subscriptionBadge(student.subscription_status)}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-md bg-muted/40 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">
                          Subscription Expiry
                        </p>
                        <p className="font-medium">
                          {formatDate(student.subscription_expiry)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining Days</p>
                        <p className="font-medium">
                          {student.remaining_days ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Courses</p>
                        <p className="font-medium">
                          {student.courses_completed || 0} completed /{" "}
                          {student.courses_started || 0} started
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Lessons Completed
                        </p>
                        <p className="font-medium">
                          {student.lessons_completed || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Assignments</p>
                        <p className="font-medium">
                          {student.assignments_submitted || 0} submitted
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Average Score</p>
                        <p className="font-medium">
                          {formatScore(student.average_score)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="truncate">
                          Last activity:{" "}
                          {formatDateTime(student.last_activity_at)}
                        </span>
                      </div>
                      <Link
                        to={`/dashboard/parent/students/${
                          student.student_id || student.id
                        }`}
                      >
                        <Button>
                          View Details <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParentDashboardPage;
