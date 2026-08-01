import React from "react";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import LogsPage from "./pages/audit-log";

export default function AdministrationModule() {
  return <WorkspaceModuleLayout slug="administration"><LogsPage /></WorkspaceModuleLayout>;
}
