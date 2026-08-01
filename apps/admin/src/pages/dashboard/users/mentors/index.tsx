import React from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import { ResourcePanel } from "@/components/lms/GenericResourcePanel";
import { lmsConfigs } from "@/lib/lms-resource";

function MentorsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Manajemen Mentor
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola data tutor/guru yang mengajar di LMS.
        </p>
      </div>

      <ResourcePanel resource={lmsConfigs.mentors} />
    </div>
  );
}

export default DashboardLayout(MentorsPage);
