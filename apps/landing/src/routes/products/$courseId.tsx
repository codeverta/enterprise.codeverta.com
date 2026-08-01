import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers3,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseThumb } from "@/components/course-thumb";
import { useLang } from "@/lib/i18n";
import { LEVELS, PILLARS } from "@/lib/curriculum-data";
import api from "@/lib/api";
import type { ApiCourse, ApiResponse } from "@/routes/siswa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/products/$courseId")({
  component: CourseDetailPage,
});

type CourseDetailResponse = {
  data: ApiCourse;
  message: string;
  success: boolean;
};

const tableComponents = {
  table: ({ node, ...props }) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border/60 shadow-sm">
      <table className="w-full text-sm text-left border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-muted/50 border-b border-border/60 text-xs font-bold uppercase text-muted-foreground tracking-wider" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-border/60 bg-background" {...props} />
  ),
  tr: ({ node, ...props }) => (
    <tr className="hover:bg-muted/20 transition-colors" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-4 py-2.5 font-bold text-foreground border-r border-border/50 last:border-r-0" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-4 py-2.5 text-muted-foreground font-normal border-r border-border/50 last:border-r-0" {...props} />
  ),
};

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const { lang } = useLang();
  const en = lang === "en";
  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const fetchCourse = async () => {
      setLoading(true);
      setError("");
      try {
        const detail = await api.get<CourseDetailResponse>(`/lms/courses/${courseId}/public`);
        if (alive) setCourse(detail.data.data);
      } catch {
        try {
          const list = await api.get<ApiResponse>("/lms/courses", { params: { limit: 100 } });
          const found = list.data.data.find((item) => item.id === courseId || item.slug === courseId);
          if (!found) throw new Error("Course not found");
          if (alive) setCourse(found);
        } catch (fallbackError) {
          console.error(fallbackError);
          if (alive) setError(en ? "Course not found." : "Kelas tidak ditemukan.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchCourse();
    return () => {
      alive = false;
    };
  }, [courseId, en]);

  const meta = useMemo(() => {
    const level = LEVELS.find((item) => item.id.toLowerCase() === course?.level?.toLowerCase());
    const pillar = PILLARS.find((item) => item.id === course?.course_category?.slug);
    return { level, pillar };
  }, [course]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {en ? "Loading class detail..." : "Memuat detail kelas..."}
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (error || !course) {
    return (
      <SiteLayout>
        <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
          <Badge variant="outline" className="rounded-full">
            404
          </Badge>
          <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
            {en ? "Class not found" : "Kelas tidak ditemukan"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {en
              ? "The class may be unpublished or no longer available."
              : "Kelas mungkin belum dipublikasikan atau sudah tidak tersedia."}
          </p>
          <Button asChild className="mt-8 rounded-full">
            <Link to="/siswa">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {en ? "Back to class library" : "Kembali ke pustaka kelas"}
            </Link>
          </Button>
        </section>
      </SiteLayout>
    );
  }

  const levelLabel = meta.level ? (en ? meta.level.label_en : meta.level.label_id) : course.level || "General";
  const pillarLabel = meta.pillar ? (en ? meta.pillar.name_en : meta.pillar.name_id) : course.course_category?.name || "";
  const description = course.description || course.short_description || (en ? "A practical class for guided learning." : "Kelas praktis untuk belajar terarah.");
  const heroDescription = course.short_description || (course.description ? course.description.replace(/[#*_`~|]/g, "").substring(0, 160) + "..." : (en ? "A practical class for guided learning." : "Kelas praktis untuk belajar terarah."));

  return (
    <SiteLayout>
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-16">
          <div>
            <Link
              to="/siswa"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {en ? "Back to classes" : "Kembali ke kelas"}
            </Link>

            <div className="mt-8 flex flex-wrap gap-2">
              <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{levelLabel}</Badge>
              {pillarLabel && <Badge variant="outline" className="rounded-full">{pillarLabel}</Badge>}
              <Badge variant="outline" className="rounded-full">{course.language || "Bahasa Indonesia"}</Badge>
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
              {course.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              {heroDescription}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-gradient-to-r from-primary to-indigo-500 font-semibold">
                <Link to="/login" search={{ redirect: `/kelas/${course.id}` }}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {course.completion_rate > 0 ? (en ? "Continue Learning" : "Lanjutkan Belajar") : (en ? "Start Learning" : "Mulai Belajar")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/harga">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {en ? "See subscription" : "Lihat langganan"}
                </Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/90 shadow-elegant">
            <CardContent className="p-4">
              {course.cover_image_url ? (
                <img
                  src={course.cover_image_url}
                  alt={course.title}
                  className="aspect-[16/10] w-full rounded-2xl object-cover"
                />
              ) : (
                <CourseThumb level={meta.level?.id || "elementary"} pillar={meta.pillar?.id || "general"} className="aspect-[16/10] h-auto" />
              )}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Metric icon={Clock} label={en ? "Duration" : "Durasi"} value={course.total_duration || "0m"} />
                <Metric icon={BookOpen} label={en ? "Lessons" : "Lesson"} value={course.lesson_count || 0} />
                <Metric icon={Layers3} label={en ? "Modules" : "Modul"} value={course.module_count || 0} />
                <Metric icon={Users} label={en ? "Enrolled" : "Peserta"} value={course.enrollment_count || 0} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px] lg:py-14">
        <div className="space-y-6">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-bold">{en ? "About this class" : "Tentang kelas ini"}</h2>
              <div className="mt-4 prose prose-slate max-w-none text-muted-foreground leading-8 [&_p]:my-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={tableComponents}
                >
                  {description}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Feature icon={ShieldCheck} title={en ? "Guided path" : "Alur belajar terarah"} body={en ? "Modules are arranged so students can keep moving without guessing the next step." : "Modul disusun agar peserta tahu langkah belajar berikutnya."} />
            <Feature icon={Award} title={en ? "Certificate ready" : "Sertifikat tersedia"} body={en ? "Completion can count toward learning records and certificates." : "Penyelesaian kelas dapat masuk ke catatan belajar dan sertifikat."} />
            <Feature icon={CalendarClock} title={en ? "Self-paced" : "Fleksibel"} body={en ? "Learn from the dashboard and continue from the last lesson." : "Belajar dari dashboard dan lanjut dari lesson terakhir."} />
            <Feature icon={GraduationCap} title={en ? "Built for families" : "Cocok untuk keluarga"} body={en ? "Parents and students can track meaningful learning progress." : "Orang tua dan peserta bisa memantau progress belajar."} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-3xl border-border/70 shadow-elegant">
            <CardContent className="space-y-5 p-6">
              <h2 className="text-lg font-bold">{en ? "Class summary" : "Ringkasan kelas"}</h2>
              <div className="space-y-3 text-sm">
                <SummaryRow label={en ? "Level" : "Level"} value={levelLabel} />
                <SummaryRow label={en ? "Category" : "Kategori"} value={pillarLabel || "-"} />
                <SummaryRow label={en ? "Quiz" : "Quiz"} value={course.quiz_count || 0} />
                <SummaryRow label={en ? "Certificate" : "Sertifikat"} value={course.has_certificate ? (en ? "Available" : "Tersedia") : "-"} />
                <SummaryRow label={en ? "Last updated" : "Terakhir update"} value={formatMonth(course.updated_at)} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </SiteLayout>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <Card className="rounded-3xl border-border/70 shadow-sm">
      <CardContent className="p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function formatMonth(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(new Date(value));
}
