import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import GlobalDefaultsPage from "./pages/GlobalDefaultsPage";

export default function SettingsModule() {
  const { pathname } = useLocation();

  if (pathname.includes("/global-defaults")) {
    return (
      <WorkspaceModuleLayout slug="erpnext-settings">
        <GlobalDefaultsPage />
      </WorkspaceModuleLayout>
    );
  }

  return (
    <WorkspaceModuleLayout slug="erpnext-settings">
      <SystemSettingsPage />
    </WorkspaceModuleLayout>
  );
}
