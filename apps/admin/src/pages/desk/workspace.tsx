import React from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowRight, FolderOpen } from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import {
  flattenWorkspaceNavigation,
  getWorkspaceFromPath,
  type ErpWorkspace,
} from "@/lib/erp-workspaces";
import { isAdminRole } from "@/lib/erp-desk";

type WorkspaceContentProps = {
  workspace: ErpWorkspace;
};

function WorkspaceContent({ workspace }: WorkspaceContentProps) {
  const location = useLocation();
  const currentItem = flattenWorkspaceNavigation(workspace).find(
    (item) => item.href.split("?")[0] === location.pathname,
  );
  const sections = workspace.navigation.filter((item) => item.items?.length);
  const isHome = location.pathname === `/desk/${workspace.slug}`;

  return (
    <div className="mx-auto max-w-screen-xl space-y-8 p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold text-blue-600">{workspace.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          {isHome
            ? `Area Kerja ${workspace.name}`
            : currentItem?.name || workspace.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isHome
            ? `Pilih transaksi, setup, atau laporan ${workspace.name.toLowerCase()} dari sidebar.`
            : "Halaman ERP siap dihubungkan dengan data dan workflow backend."}
        </p>
      </div>

      {isHome && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <section
              key={section.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FolderOpen className="size-5" />
                </span>
                <h2 className="font-bold text-slate-900">{section.name}</h2>
              </div>
              <div className="space-y-1">
                {section.items?.slice(0, 8).map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    state={{ workspace: workspace.slug }}
                    className="group flex items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                  >
                    {item.name}
                    <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const WorkspaceDashboard = DashboardLayout(WorkspaceContent, {
  navigation: ({ workspace }) => workspace.navigation,
  basePath: "",
  homePath: "/desk",
  navigationState: ({ workspace }) => ({ workspace: workspace.slug }),
  openMenusStorageKey: ({ workspace }) =>
    `erpSidebarOpenMenus:${workspace.slug}`,
  moduleLabel: ({ workspace }) => workspace.name,
  defaultOpenAll: true,
});

export default function ErpWorkspacePage() {
  const location = useLocation();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;

  const sidebarParam = new URLSearchParams(location.search).get("sidebar")?.toLowerCase();
  const preferredWorkspace =
    (location.state as { workspace?: string } | null)?.workspace ||
    sidebarParam;
  const workspaceConfig = getWorkspaceFromPath(
    location.pathname,
    preferredWorkspace,
  );
  if (!workspaceConfig) return <Navigate to="/desk" replace />;

  return <WorkspaceDashboard workspace={workspaceConfig} />;
}
