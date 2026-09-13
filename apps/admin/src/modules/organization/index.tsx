import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import UserManagementPage from "./pages/users";
import TenantPage from "./pages/tenants";
import PermissionManagementPage from "./pages/permissions";
import OrganizationDeskPage from "./pages/organization-desk";
import RolePage from "./pages/RolePage";
import ERPUserPage from "./pages/ERPUserPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";

export default function OrganizationModule() {
  const { pathname } = useLocation();

  if (pathname.startsWith("/desk/user")) {
    return <WorkspaceModuleLayout slug="organization"><ERPUserPage /></WorkspaceModuleLayout>;
  }

  if (pathname.includes("/role")) {
    return (
      <WorkspaceModuleLayout slug="framework">
        <RolePage />
      </WorkspaceModuleLayout>
    );
  }

  if (pathname.startsWith("/desk/company")) {
    const segments = pathname.split("/").filter(Boolean);
    const isCompanyList =
      segments.length <= 2 ||
      (segments.length === 4 && segments[2] === "view" && segments[3] === "List");

    if (!isCompanyList) {
      return (
        <WorkspaceModuleLayout slug="organization">
          <CompanyDetailPage />
        </WorkspaceModuleLayout>
      );
    }
  }

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
