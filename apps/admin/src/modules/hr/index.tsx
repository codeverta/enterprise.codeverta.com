import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import PayrollEntryListPage from "./pages/PayrollEntryListPage";
import PayrollEntryFormPage from "./pages/PayrollEntryFormPage";
import AttendanceListPage from "./pages/AttendanceListPage";
import AttendanceFormPage from "./pages/AttendanceFormPage";
import EmployeeOnboardingPage from "./pages/EmployeeOnboardingPage";

export default function HRModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;
  let workspaceSlug = "hr";

  if (pathname.startsWith("/desk/employee-onboarding")) {
    content = <EmployeeOnboardingPage />;
    workspaceSlug = "tenure";
  } else if (
    pathname.startsWith("/desk/attendance") ||
    pathname.startsWith("/desk/employee-attendance-tool") ||
    pathname.startsWith("/desk/employee-checkin")
  ) {
    workspaceSlug = "shift-and-attendance";
    const isList =
      pathname === "/desk/attendance" ||
      pathname === "/desk/attendance/view/List" ||
      pathname.startsWith("/desk/attendance/view") ||
      pathname === "/desk/employee-attendance-tool" ||
      pathname === "/desk/employee-checkin";
    const isForm =
      !isList &&
      (pathname === "/desk/attendance/new" ||
        pathname.includes("/desk/attendance/new-attendance") ||
        /^\/desk\/attendance\/[^/]+$/.test(pathname));
    content = isForm ? <AttendanceFormPage /> : <AttendanceListPage />;
  } else if (pathname.startsWith("/desk/payroll-entry")) {
    workspaceSlug = "payroll";
    const isList =
      pathname === "/desk/payroll-entry" ||
      pathname === "/desk/payroll-entry/view/List" ||
      pathname.startsWith("/desk/payroll-entry/view");
    const isForm =
      !isList &&
      (pathname === "/desk/payroll-entry/new" ||
        pathname.includes("/desk/payroll-entry/new-payroll-entry") ||
        /^\/desk\/payroll-entry\/[^/]+$/.test(pathname));
    content = isForm ? <PayrollEntryFormPage /> : <PayrollEntryListPage />;
  } else {
    content = <AttendanceListPage />;
  }

  return <WorkspaceModuleLayout slug={workspaceSlug}>{content}</WorkspaceModuleLayout>;
}
