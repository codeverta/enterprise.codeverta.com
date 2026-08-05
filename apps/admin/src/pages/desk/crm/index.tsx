import React from "react";
import { Navigate, useLocation } from "react-router";
import {
  Building2,
  Cable,
  Columns3,
  Gauge,
  MessagesSquare,
  Settings2,
  UserRoundSearch,
} from "lucide-react";
import DashboardLayout from "@/layout/DashboardLayout";
import { isAdminRole } from "@/lib/erp-desk";
import CRMDashboardPage from "./overview";
import CRMLeadsPage from "./leads";
import CRMAutomationPage from "./automation";
import CRMIntegrationsPage from "./integrations";
import CRMDirectoryPage from "./directory";
import CRMOpportunitiesPage from "./opportunities";
import CRMInboxPage from "./inbox";

const navigation = [
  { name: "Overview", href: "/desk/crm", icon: Gauge },
  { name: "Inbox Chat", href: "/desk/crm/inbox", icon: MessagesSquare },
  { name: "Lead & Prospek", href: "/desk/crm/leads", icon: UserRoundSearch },
  { name: "Kontak & Perusahaan", href: "/desk/crm/directory", icon: Building2 },
  { name: "Peluang & Deal", href: "/desk/crm/opportunities", icon: Columns3 },
  { name: "Automation", href: "/desk/crm/automation", icon: Settings2 },
  { name: "Integrations", href: "/desk/crm/integrations", icon: Cable },
];

function CRMContent() {
  const { pathname } = useLocation();
  if (pathname.endsWith("/inbox")) return <CRMInboxPage />;
  if (pathname.endsWith("/leads")) return <CRMLeadsPage />;
  if (pathname.endsWith("/directory")) return <CRMDirectoryPage />;
  if (pathname.endsWith("/opportunities")) return <CRMOpportunitiesPage />;
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
  moduleLabel: "CRM",
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
