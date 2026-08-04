import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import UserManagementPage from "./pages/users";
import TenantPage from "./pages/tenants";
import PermissionManagementPage from "./pages/permissions";

export default function OrganizationModule() {
  const { pathname } = useLocation();
  return <WorkspaceModuleLayout slug="organization">
    {pathname.includes("/permissions") ? <PermissionManagementPage /> : pathname.includes("/tenants") ? <TenantPage /> : <UserManagementPage />}
  </WorkspaceModuleLayout>;
}
