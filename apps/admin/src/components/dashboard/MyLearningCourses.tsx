import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Clock,
  Award,
  PlayCircle,
  Loader2,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(totalSec = 0) {
  if (totalSec <= 0) return "0m";
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function MyLearningCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lms/my-courses");
      setCourses(res.data?.data || res.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

if (loading) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <CourseProgressCardSkeleton key={index} />
      ))}
    </div>
  );
}

  if (courses.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-muted-foreground">
        <BookOpen className="h-8 w-8 opacity-30" />
        <p className="text-sm">Belum ada kursus yang kamu ikuti.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((course) => (
        <CourseProgressCard key={course.id} course={course} />
      ))}
    </div>
  );
}

function CourseProgressCard({ course }) {
  // const completionRate = Number(course.completion_rate || 0);
  const completionRate = Number(0);
  const categoryName = course.course_category?.name || "";
  const totalDuration = course.total_duration || "0m";

  return (
    <Link
      to={`/dashboard/courses/${course.id}?tab=curriculum`}
      className="block no-underline text-inherit"
    >
      <Card className="group h-full rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          {/* Thumbnail */}
          {course.cover_image_url ? (
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={course.cover_image_url}
                alt={course.title}
                className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              {completionRate > 0 && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {completionRate}% selesai
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex h-32 w-full items-center justify-center rounded-xl bg-muted">
              <BookOpen className="h-8 w-8 opacity-20" />
              {completionRate > 0 && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {completionRate}% selesai
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="flex items-center gap-2">
            {course.level && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-normal"
              >
                {course.level}
              </Badge>
            )}
            {completionRate > 0 ? (
              <Badge
                variant="outline"
                className="rounded-full border-primary/30 bg-primary/10 text-[10px] font-normal text-primary"
              >
                <TrendingUp className="mr-1 h-2.5 w-2.5" />
                Sedang Dipelajari
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-normal"
              >
                Baru
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.short_description || course.description || ""}
          </p>

          {/* Progress bar */}
          {completionRate > 0 && (
            <div className="mt-auto pt-1">
              <Progress value={completionRate} className="h-1.5" />
            </div>
          )}

          {/* Meta info */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">{categoryName}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalDuration}
            </span>
          </div>

          {/* Action button */}
          <Button
            size="sm"
            className="w-full rounded-full"
            variant={completionRate > 0 ? "default" : "outline"}
          >
            <PlayCircle className="mr-1 h-3.5 w-3.5" />
            {completionRate > 0
              ? `Lanjutkan · ${completionRate}%`
              : "Mulai Belajar"}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

function CourseProgressCardSkeleton() {
  return (
    <Card className="h-full rounded-2xl border-border/60 shadow-sm">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        {/* Thumbnail */}
        <Skeleton className="h-32 w-full rounded-xl" />

        {/* Tags */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>

        {/* Progress */}
        <Skeleton className="mt-auto h-1.5 w-full rounded-full" />

        {/* Meta */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>

        {/* Button */}
        <Skeleton className="h-9 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

export default MyLearningCourses;