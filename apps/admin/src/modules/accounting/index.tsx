import React from "react";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import FinanceDashboard from "./pages/finance";

export default function AccountingModule() {
  return <WorkspaceModuleLayout slug="accounting"><FinanceDashboard /></WorkspaceModuleLayout>;
}
