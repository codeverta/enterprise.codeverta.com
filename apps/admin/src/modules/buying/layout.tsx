import React, { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useLocation } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import { getWorkspaceFromPath } from "@/lib/erp-workspaces";
import { canAccessDeskPage, loadMyPermissions } from "@/lib/dynamic-permissions";

const buyingWorkspace = getWorkspaceFromPath("/desk/buying", "buying")!;

const BuyingDashboard = DashboardLayout(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  {
    navigation: () => buyingWorkspace.navigation,
    basePath: "",
    homePath: "/desk",
    navigationState: () => ({ workspace: "buying" }),
    openMenusStorageKey: () => "erpSidebarOpenMenus:buying",
    defaultOpenAll: true,
  },
);

export default function BuyingLayout({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }
  const legacyAdmin = isAdminRole(user?.role);
  const [allowed, setAllowed] = useState(legacyAdmin);
  const [checking, setChecking] = useState(!legacyAdmin);
  useEffect(() => {
    if (legacyAdmin) { setAllowed(true); setChecking(false); return; }
    loadMyPermissions().then((permissions) => setAllowed(canAccessDeskPage(permissions, pathname))).catch(() => setAllowed(false)).finally(() => setChecking(false));
  }, [legacyAdmin, pathname]);
  if (checking) return <div className="p-12 text-center text-sm text-slate-500">Checking page permission...</div>;
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <BuyingDashboard>{children}</BuyingDashboard>;
}
