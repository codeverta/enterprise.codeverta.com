import React, { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useLocation } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import { canAccessDeskPage, loadMyPermissions } from "@/lib/dynamic-permissions";
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
	const { pathname } = useLocation();
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }
  const legacyAdmin = isAdminRole(user?.role);
  const [allowed, setAllowed] = useState(legacyAdmin);
  const [checking, setChecking] = useState(!legacyAdmin);
  useEffect(() => {
    if (legacyAdmin) { setAllowed(true); setChecking(false); return; }
    loadMyPermissions().then((permissions) => setAllowed(canAccessDeskPage(permissions, pathname))).catch(() => setAllowed(false)).finally(() => setChecking(false));
  }, [legacyAdmin, pathname]);
  if (checking) return <div className="p-12 text-center text-sm text-slate-500">Checking page permission...</div>;
  if (!allowed) return <Navigate to="/dashboard" replace />;
  const workspace = getWorkspaceFromPath(`/desk/${slug}`, slug);
  if (!workspace) return <Navigate to="/desk" replace />;
  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>;
}
