import React from "react";
import { Navigate } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import { getWorkspaceFromPath, type ErpWorkspace } from "@/lib/erp-workspaces";

function Content({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const WorkspaceShell = DashboardLayout(Content, {
  navigation: ({ workspace }: { workspace: ErpWorkspace }) => workspace.navigation,
  basePath: "",
  homePath: "/desk",
  navigationState: ({ workspace }: { workspace: ErpWorkspace }) => ({ workspace: workspace.slug }),
  openMenusStorageKey: ({ workspace }: { workspace: ErpWorkspace }) => `erpSidebarOpenMenus:${workspace.slug}`,
  defaultOpenAll: true,
});

export default function WorkspaceModuleLayout({ slug, children }: { slug: string; children: React.ReactNode }) {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }
  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;
  const workspace = getWorkspaceFromPath(`/desk/${slug}`, slug);
  if (!workspace) return <Navigate to="/desk" replace />;
  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>;
}
