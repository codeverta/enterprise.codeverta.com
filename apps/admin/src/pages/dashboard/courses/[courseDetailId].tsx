import React from "react";
import { Loader2 } from "lucide-react";
import { useCourseManagement } from "@/hooks/useCourseManagement";
import api from "@/lib/api";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import CourseViewer from "@/components/course/CourseViewer";

const emptyModuleForm = {
  id: "",
  title: "",
  description: "",
  sort_order: 0,
  is_published: true,
};
const emptyLessonForm = {
  id: "",
  module_id: "",
  title: "",
  summary: "",
  is_preview: false,
  is_published: true,
  require_attachment: false,
  attachment_passing_score: 0,
};
const emptyAssetForm = {
  title: "",
  type: "video",
  file_url: "",
  thumbnail_url: "",
  description: "",
  is_downloadable: false,
};
const getResponseData = (r: any) => r.data?.data || r.data || [];

function CourseDetailPage() {
  const sessionUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const {
    navigate,
    course,
    loadingCourse,
    modules,
    lessonsByModule,
    quizzesByModule,
    assetsByLesson,
    selectedLessonId,
    startLearning,
  } = useCourseManagement(sessionUser, {
    api,
    toast,
    getResponseData,
    emptyModuleForm,
    emptyLessonForm,
    emptyAssetForm,
  });

  if (loadingCourse) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isManager = Number(sessionUser?.role || 0) === 30 || Number(sessionUser?.role || 0) >= 99;

  return (
    <CourseViewer
      course={course}
      modules={modules}
      lessonsByModule={lessonsByModule}
      quizzesByModule={quizzesByModule}
      assetsByLesson={assetsByLesson}
      selectedLessonId={selectedLessonId}
      hasLearningAccess={course?.has_access !== false}
      onBack={() => navigate(isManager ? "/dashboard/courses/add" : "/dashboard/courses")}
      onStartLearning={startLearning}
      onSelectLesson={(lesson) => navigate(`/dashboard/lessons/${lesson.id}`)}
    />
  );
}

export default DashboardLayout(CourseDetailPage);
