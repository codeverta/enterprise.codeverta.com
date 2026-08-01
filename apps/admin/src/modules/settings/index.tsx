import React from "react";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import SettingsPage from "./pages/system-settings";

export default function SettingsModule() {
  return <WorkspaceModuleLayout slug="erpnext-settings"><SettingsPage /></WorkspaceModuleLayout>;
}
