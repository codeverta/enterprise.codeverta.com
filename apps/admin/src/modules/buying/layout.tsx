import React from "react";
import { Navigate } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import { getWorkspaceFromPath } from "@/lib/erp-workspaces";

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
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }
  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;
  return <BuyingDashboard>{children}</BuyingDashboard>;
}
