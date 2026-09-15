import React, { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useLocation } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import {
  canAccessModule,
  canAccessDeskPage,
  filterWorkspaceNavigation,
  loadMyPermissions,
  type MyPermissions,
} from "@/lib/dynamic-permissions";
import { getWorkspaceFromPath, type ErpWorkspace } from "@/lib/erp-workspaces";

function Content({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const WorkspaceShell = DashboardLayout(Content, {
  navigation: ({ workspace }: { workspace: ErpWorkspace }) =>
    workspace.navigation,
  basePath: "",
  homePath: "/desk",
  navigationState: ({ workspace }: { workspace: ErpWorkspace }) => ({
    workspace: workspace.slug,
  }),
  openMenusStorageKey: ({ workspace }: { workspace: ErpWorkspace }) =>
    `erpSidebarOpenMenus:${workspace.slug}`,
  moduleLabel: ({ workspace }: { workspace: ErpWorkspace }) => workspace.name,
  defaultOpenAll: true,
});

export default function WorkspaceModuleLayout({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }
  const legacyAdmin = isAdminRole(user?.role);
  const [allowed, setAllowed] = useState(legacyAdmin);
  const [permissions, setPermissions] = useState<MyPermissions | null>(legacyAdmin ? { legacy_admin: true } : null);
  const [checking, setChecking] = useState(!legacyAdmin);
  useEffect(() => {
    if (legacyAdmin) {
      setAllowed(true);
      setChecking(false);
      return;
    }
    loadMyPermissions()
      .then((nextPermissions) => {
        setPermissions(nextPermissions);
        const isWorkspaceHome = pathname === `/desk/${slug}` || pathname === `/desk/${slug}/`;
        setAllowed(isWorkspaceHome ? canAccessModule(nextPermissions, slug, getWorkspaceFromPath(pathname, slug)) : canAccessDeskPage(nextPermissions, pathname));
      })
      .catch(() => setAllowed(false))
      .finally(() => setChecking(false));
  }, [legacyAdmin, pathname]);
  if (checking)
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Checking page permission...
      </div>
    );
  if (!allowed) return <Navigate to="/dashboard" replace />;
  const workspace = getWorkspaceFromPath(`/desk/${slug}`, slug);
  if (!workspace) return <Navigate to="/desk" replace />;
  const visibleWorkspace = legacyAdmin ? workspace : { ...workspace, navigation: filterWorkspaceNavigation(permissions, workspace.navigation) };
  return <WorkspaceShell workspace={visibleWorkspace}>{children}</WorkspaceShell>;
}
