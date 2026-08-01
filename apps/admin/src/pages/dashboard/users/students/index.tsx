import React from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import { ResourcePanel } from "@/components/lms/GenericResourcePanel";
import { lmsConfigs } from "@/lib/lms-resource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StudentsParentsPage() {
  const configs = [
    lmsConfigs.profiles,
    lmsConfigs.memberships,
    lmsConfigs.studentProgress,
    lmsConfigs.levelUnlocks,
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Siswa & Orangtua
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola profil pengguna, relasi keluarga, dan progres belajar.
        </p>
      </div>

      <Tabs defaultValue={configs[0].key} className="gap-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="h-auto w-max flex-wrap justify-start rounded-md bg-white p-1 shadow-sm">
            {configs.map((res) => (
              <TabsTrigger key={res.key} value={res.key} className="px-3 py-2">
                {res.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {configs.map((res) => (
          <TabsContent key={res.key} value={res.key}>
            <ResourcePanel resource={res} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default DashboardLayout(StudentsParentsPage);
