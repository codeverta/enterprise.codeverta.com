import React from "react";
import { Navigate, useLocation } from "react-router";
import { Cable, Gauge, Settings2, UserRoundSearch } from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import CRMDashboardPage from "./overview";
import CRMLeadsPage from "./leads";
import CRMAutomationPage from "./automation";
import CRMIntegrationsPage from "./integrations";

const navigation = [
  { name: "Overview", href: "/desk/crm", icon: Gauge },
  { name: "Lead & Prospek", href: "/desk/crm/leads", icon: UserRoundSearch },
  { name: "Automation", href: "/desk/crm/automation", icon: Settings2 },
  { name: "Integrations", href: "/desk/crm/integrations", icon: Cable },
];

function CRMContent() {
  const { pathname } = useLocation();
  if (pathname.endsWith("/leads")) return <CRMLeadsPage />;
  if (pathname.endsWith("/automation")) return <CRMAutomationPage />;
  if (pathname.endsWith("/integrations")) return <CRMIntegrationsPage />;
  return <CRMDashboardPage />;
}

const CRMWorkspace = DashboardLayout(CRMContent, {
  navigation,
  basePath: "",
  homePath: "/desk",
  defaultOpenAll: true,
  openMenusStorageKey: () => "erpSidebarOpenMenus:crm",
});

export default function CRMPage() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }
  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;
  return <CRMWorkspace />;
}
