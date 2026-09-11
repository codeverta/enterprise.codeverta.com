import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import FinanceDashboard from "./pages/finance";
import CurrencyListPage from "./pages/CurrencyListPage";
import CurrencyFormPage from "./pages/CurrencyFormPage";
import AccountSetupPage from "./pages/AccountSetupPage";
import GLEntryListPage from "./pages/GLEntryListPage";
import GLEntryFormPage from "./pages/GLEntryFormPage";

export default function AccountingModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;
  if (pathname.startsWith("/desk/account") && !pathname.startsWith("/desk/accounting")) {
    content = <AccountSetupPage />;
  } else if (pathname.startsWith("/desk/currency")) {
    const isForm =
      pathname === "/desk/currency/new" ||
      /^\/desk\/currency\/[^/]+$/.test(pathname);
    content = isForm ? <CurrencyFormPage /> : <CurrencyListPage />;
  } else if (pathname.startsWith("/desk/gl-entry")) {
    const isForm =
      pathname === "/desk/gl-entry/new" ||
      /^\/desk\/gl-entry\/[^/]+$/.test(pathname);
    content = isForm ? <GLEntryFormPage /> : <GLEntryListPage />;
  } else {
    content = <FinanceDashboard />;
  }

  return (
    <WorkspaceModuleLayout slug="accounting">{content}</WorkspaceModuleLayout>
  );
}
