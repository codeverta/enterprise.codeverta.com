import React from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import ExploreOtherCourses from "@/components/dashboard/ExploreOtherCourses";

function ParentCoursesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <ExploreOtherCourses 
        title="Jelajahi Course Lainnya" 
        subtitle="Kembangkan skill anak Anda dengan course pilihan berikut" 
        limit={12} 
      />
    </div>
  );
}

export default DashboardLayout(ParentCoursesPage);
