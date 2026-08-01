import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import EmailTemplatesPage from "./pages/email-templates";
import EmailBroadcastPage from "./pages/email-broadcast";

export default function CommunicationModule() {
  const { pathname } = useLocation();
  return <WorkspaceModuleLayout slug="communication">
    {pathname.includes("/broadcast") ? <EmailBroadcastPage /> : <EmailTemplatesPage />}
  </WorkspaceModuleLayout>;
}
