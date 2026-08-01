import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import UserManagementPage from "./pages/users";
import TenantPage from "./pages/tenants";

export default function OrganizationModule() {
  const { pathname } = useLocation();
  return <WorkspaceModuleLayout slug="organization">
    {pathname.includes("/tenants") ? <TenantPage /> : <UserManagementPage />}
  </WorkspaceModuleLayout>;
}
