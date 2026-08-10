import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import UserManagementPage from "./pages/users";
import TenantPage from "./pages/tenants";
import PermissionManagementPage from "./pages/permissions";
import OrganizationDeskPage from "./pages/organization-desk";

export default function OrganizationModule() {
  const { pathname } = useLocation();

  if (
    pathname.includes("/company") ||
    pathname.includes("/branch") ||
    pathname.includes("/department") ||
    pathname.includes("/letter-head")
  ) {
    return (
      <WorkspaceModuleLayout slug="organization">
        <OrganizationDeskPage />
      </WorkspaceModuleLayout>
    );
  }

  return (
    <WorkspaceModuleLayout slug="organization">
      {pathname.includes("/permissions") ? (
        <PermissionManagementPage />
      ) : pathname.includes("/tenants") ? (
        <TenantPage />
      ) : (
        <UserManagementPage />
      )}
    </WorkspaceModuleLayout>
  );
}
