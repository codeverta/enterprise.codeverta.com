import { BookOpen, Loader2 } from "lucide-react";
import AdminCourseList from "@/components/course-list/AdminCourseList";
import DashboardLayout from "@/layout/DashboardLayout";
import { ROLES } from "@/lib/constants";

function AddCoursePage({ user, sellerStatus, sellerStatusLoading }) {
  const role = Number(user?.role || 0);
  const requiresCourseCreationPlan =
    role === ROLES.PARENT || role === ROLES.MENTOR_EXTERNAL;
  const canCreateCourseFromPlan =
    !requiresCourseCreationPlan || sellerStatus?.can_create_course === true;
  const canOpenAddCourse =
    role >= ROLES.ADMIN ||
    role === ROLES.INSTRUCTOR ||
    role === ROLES.MENTOR_EXTERNAL ||
    role === ROLES.PARENT;

  if (requiresCourseCreationPlan && sellerStatusLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
        Memeriksa akses tambah kelas...
      </div>
    );
  }

  if (!canOpenAddCourse || !canCreateCourseFromPlan) {
    const lockReason = sellerStatus?.creation_unlock_reason?.trim();
    const noCreateCourseReason =
      "Paket subscription aktif Anda belum mendukung fitur tambah kelas.";
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <BookOpen className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Halaman tambah kelas tidak tersedia untuk akun ini.
        </p>
        <p className="mt-1 max-w-sm text-xs">
          {requiresCourseCreationPlan && lockReason
            ? lockReason
            : requiresCourseCreationPlan
            ? noCreateCourseReason
            : "Gunakan menu Kelas Saya untuk membuka kelas dari paket subscription Anda."}
        </p>
      </div>
    );
  }

  return <AdminCourseList user={user} />;
}

export default DashboardLayout(AddCoursePage);
