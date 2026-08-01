import { useEffect } from "react";
import dayjs from "dayjs";
import { Link } from "react-router";
import {
  BookOpen,
  ChevronRight,
  Clock,
  Lock,
  Star,
  Tag,
  Users,
} from "lucide-react";

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const CourseCard = ({ course }) => {
  useEffect(() => {
    const id = "lms-course-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const isLocked = !!course.is_locked;
  const lockedReason = course.locked_by_course
    ? `Selesaikan "${course.locked_by_course}"`
    : "Selesaikan course sebelumnya";

  const courseId = course.course_id || course.id || course.slug;
  const coverImage =
    course.cover_image_url || course.thumbnail || course.thumbnail_url;
  const categoryName =
    course.course_category?.name || course.category?.name || course.category_name;
  const mentorNames =
    course.mentors && course.mentors.length > 0
      ? course.mentors
          .map((m) => m.display_name || m.name || m.username)
          .filter(Boolean)
          .join(", ")
      : course.mentor
      ? course.mentor.display_name || course.mentor.name || course.mentor.username
      : "";
  const price = Number(course.price || 0);
  const originalPrice = Number(course.original_price || 0);
  const hasDiscount = originalPrice > price && price > 0;
  const discountPercent = hasDiscount
    ? Math.round(100 - (price / originalPrice) * 100)
    : 0;
  const totalStudents = Number(course.total_students || course.student_count || 0);
  const createdAt = course.created_at || course.published_at || course.updated_at;

  return (
    <Link
      to={isLocked ? "#" : `/courses/${courseId}`}
      onClick={(e) => {
        if (isLocked) {
          e.preventDefault();
        }
      }}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-inherit no-underline shadow-sm transition-all duration-200 ${
        isLocked
          ? "border-[#ECEBF7] opacity-90 cursor-not-allowed"
          : "border-[#ECEBF7] cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#5B5FEF]/10"
      }`}
    >
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#EEF0FD] to-[#F6F5FB]">
        {coverImage ? (
          <img
            src={coverImage}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-9 w-9 text-[#C7C6E8]" />
          </div>
        )}

        {isLocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1E1B3A]/70 p-3 text-center text-white backdrop-blur-[2px]">
            <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              Terkunci
            </span>
            <span className="mt-0.5 text-[9px] text-white/70 leading-tight">
              {lockedReason}
            </span>
          </div>
        )}

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-[#C7F0E3] bg-[#E9FBF6]/95 px-2.5 py-1 text-[10px] font-semibold text-[#0F9D66] backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#12B981]" />
          {categoryName || "Course"}
        </span>

        {isLocked ? (
          <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[10px] font-semibold text-amber-800 backdrop-blur-sm">
            <Lock className="h-3 w-3" />
            Terkunci
          </span>
        ) : (
          discountPercent > 0 && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-[#FAD0D6] bg-[#FFEDEF]/95 px-2.5 py-1 text-[10px] font-semibold text-[#D3283F] backdrop-blur-sm">
              -{discountPercent}%
            </span>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className={`line-clamp-2 font-['Baloo_2'] text-sm font-semibold leading-snug transition-colors ${
          isLocked ? "text-[#B3B2C8]" : "text-[#1E1B3A] group-hover:text-[#5B5FEF]"
        }`}>
          {course.title}
        </h3>

        {mentorNames && (
          <p className="-mt-1 line-clamp-1 text-[11px] font-medium text-[#9694B0]">
            Mentor: {mentorNames}
          </p>
        )}

        <p className="line-clamp-2 text-xs leading-relaxed text-[#8B8AA0]">
          {course.short_description || course.description || "Tidak ada deskripsi"}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {course.level && (
            <span className="rounded-md border border-[#FBDBC7] bg-[#FFF1EA] px-2 py-0.5 font-mono text-[11px] text-[#C4622D]">
              {course.level}
            </span>
          )}
          {course.age_range && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#DADCF8] bg-[#EEF0FD] px-2 py-0.5 text-[11px] font-medium text-[#5B5FEF]">
              <Tag className="h-3 w-3" />
              {course.age_range}
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-[#9694B0]">
          {course.rating ? (
            <span className="inline-flex items-center gap-1 font-medium text-[#5B5A72]">
              <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
              {Number(course.rating).toFixed(1)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {totalStudents} partner
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-[#F0EFF9] pt-2.5">
          <div className="min-w-0">
            {price > 0 ? (
              <span className="block truncate text-sm font-bold text-[#1E1B3A]">
                {rupiah(price)}
              </span>
            ) : (
              <></>
            )}
            {createdAt && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#9694B0]">
                <Clock className="h-3 w-3" />
                {dayjs(createdAt).format("DD MMM YYYY")}
              </span>
            )}
          </div>

          {isLocked ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#FFF6E8] px-2.5 text-[11px] font-medium text-[#B4790A]">
              <Lock className="h-3 w-3" />
              Terkunci
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-[#EEF0FD]">
              <ChevronRight className="h-4 w-4 text-[#5B5FEF]" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
