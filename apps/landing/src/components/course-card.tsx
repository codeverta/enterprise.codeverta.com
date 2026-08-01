import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Lock, PlayCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LEVELS, PILLARS } from "@/lib/curriculum-data";
import { CourseThumb } from "@/components/course-thumb";
import { ApiCourse } from "@/routes/siswa";
import { Link } from "@tanstack/react-router"; 

function md(text: string) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 rounded text-xs'>$1</code>")
    .replace(/\n/g, "<br />");
}

interface CourseCardProps {
  course: ApiCourse;
  compact?: boolean;
}

export function CourseCard({ course, compact = false }: CourseCardProps) {
  const { lang } = useLang();
  const en = lang === "en";

  const levelMeta = LEVELS.find((l) => l.id.toLowerCase() === course.level?.toLowerCase());
  const pillar = PILLARS.find((p) => p.id === course.course_category?.slug);

  const displayLevel = levelMeta
    ? en
      ? levelMeta.label_en
      : levelMeta.label_id
    : course.level || "General";
  const displayPillar = pillar
    ? en
      ? pillar.name_en
      : pillar.name_id
    : course.course_category?.name || "";

  const isPremium = course.status === "premium" || (course as any).access === "premium_addon";
  const isLocked = !!(course as any).is_locked || isPremium;
  const lockedReason = (course as any).locked_by_course
    ? (en ? `Complete "${(course as any).locked_by_course}" first` : `Selesaikan "${(course as any).locked_by_course}"`)
    : (en ? "Complete prerequisite course" : "Selesaikan course sebelumnya");

  const accessLabel = isPremium
    ? "Premium"
    : course.status === "published"
      ? en
        ? "Included"
        : "Termasuk"
      : en
        ? "Preview"
        : "Preview";

  return (
    <Link
      to="/kelas/$courseId"
      params={{ courseId: course.id || (course as any).course_id }}
      onClick={(e) => {
        if (isLocked) {
          e.preventDefault();
        }
      }}
      className={`block no-underline text-inherit ${isLocked ? "cursor-not-allowed" : ""}`}
    >
      <Card className={`group h-full rounded-2xl border-border/60 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant ${isLocked ? "opacity-90 cursor-not-allowed bg-slate-50/50" : "cursor-pointer"}`}>
        <CardContent className={`flex h-full flex-col gap-3 ${compact ? "p-4" : "p-5"}`}>
          {!compact && (
            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-muted">
              {course.cover_image_url ? (
                <img
                  src={course.cover_image_url}
                  alt={course.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <CourseThumb level={levelMeta?.id || "elementary"} pillar={pillar?.id || "general"} />
              )}
              {isLocked && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-2 text-center z-10">
                  <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                    <Lock className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide uppercase">
                    {en ? "Locked" : "Terkunci"}
                  </span>
                  <span className="text-[9px] text-white/80 mt-0.5 leading-tight line-clamp-1">
                    {lockedReason}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <Badge variant="outline" className="rounded-full text-[10px] font-normal">
              {displayLevel}
            </Badge>
            <Badge
              variant="outline"
              className={`rounded-full text-[10px] font-medium ${
                isLocked
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {isLocked && <Lock className="mr-1 h-2.5 w-2.5" />}
              {isLocked ? (en ? "Terkunci" : "Terkunci") : accessLabel}
            </Badge>
          </div>

          {/* Judul Kelas */}
          <h3 className={`text-sm font-semibold leading-snug line-clamp-2 transition-colors ${isLocked ? "text-muted-foreground" : "group-hover:text-primary"}`}>
            {course.title}
          </h3>

          {!compact && (
            <div
              className="text-xs text-muted-foreground line-clamp-2"
              dangerouslySetInnerHTML={{ __html: md(course.description || course.short_description) }}
            />
          )}

          <div className="mt-auto space-y-3 pt-2">
            {course.completion_rate > 0 && !isLocked && (
              <div>
                <Progress value={course.completion_rate} className="h-1.5" />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">
                  {course.completion_rate}%
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{displayPillar}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {course.total_duration || "0m"} · {course.level || "Beginner"}
              </span>
            </div>

            <Button
              size="sm"
              disabled={isLocked}
              className={`w-full rounded-full ${
                isLocked ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-80" : ""
              }`}
              variant={isLocked ? "outline" : course.completion_rate > 0 ? "default" : "outline"}
            >
              {isLocked ? (
                <>
                  <Lock className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  {en ? "Locked" : "Terkunci"}
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1 h-3.5 w-3.5" />
                  {course.completion_rate > 0
                    ? en
                      ? `Continue · ${course.completion_rate}%`
                      : `Lanjutkan · ${course.completion_rate}%`
                    : en
                      ? "Start"
                      : "Mulai"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
