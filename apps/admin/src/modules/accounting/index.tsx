import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import FinanceDashboard from "./pages/finance";
import CurrencyListPage from "./pages/CurrencyListPage";
import CurrencyFormPage from "./pages/CurrencyFormPage";

export default function AccountingModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;
  if (pathname.startsWith("/desk/currency")) {
    const isForm =
      pathname === "/desk/currency/new" ||
      /^\/desk\/currency\/[^/]+$/.test(pathname);
    content = isForm ? <CurrencyFormPage /> : <CurrencyListPage />;
  } else {
    content = <FinanceDashboard />;
  }

  return (
    <WorkspaceModuleLayout slug="accounting">{content}</WorkspaceModuleLayout>
  );
}
