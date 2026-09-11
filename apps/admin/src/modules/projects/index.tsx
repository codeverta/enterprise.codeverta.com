import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectFormPage from "./pages/ProjectFormPage";
import TaskListPage from "./pages/TaskListPage";
import TaskFormPage from "./pages/TaskFormPage";
import TimesheetListPage from "./pages/TimesheetListPage";
import TimesheetFormPage from "./pages/TimesheetFormPage";
import ProjectsWorkspacePage from "./pages/ProjectsWorkspacePage";

export default function ProjectsModule() {
  const { pathname } = useLocation();

  let content: React.ReactNode;
  const workspaceSlug = "projects";

  if (pathname === "/desk/projects" || pathname === "/desk/projects/") {
    content = <ProjectsWorkspacePage />;
  } else if (pathname.startsWith("/desk/project")) {
    const isList =
      pathname === "/desk/project" ||
      pathname === "/desk/project/" ||
      pathname === "/desk/project/view/List" ||
      pathname.startsWith("/desk/project/view");
    const isForm =
      !isList &&
      (pathname === "/desk/project/new" ||
        pathname.includes("/desk/project/new-project") ||
        /^\/desk\/project\/[^/]+$/.test(pathname));

    content = isForm ? <ProjectFormPage /> : <ProjectListPage />;
  } else if (pathname.startsWith("/desk/task")) {
    const isList =
      pathname === "/desk/task" ||
      pathname === "/desk/task/" ||
      pathname === "/desk/task/view/List" ||
      pathname.startsWith("/desk/task/view");
    const isForm =
      !isList &&
      (pathname === "/desk/task/new" ||
        pathname.includes("/desk/task/new-task") ||
        /^\/desk\/task\/[^/]+$/.test(pathname));

    content = isForm ? <TaskFormPage /> : <TaskListPage />;
  } else if (pathname.startsWith("/desk/timesheet")) {
    const isList =
      pathname === "/desk/timesheet" ||
      pathname === "/desk/timesheet/" ||
      pathname === "/desk/timesheet/view/List" ||
      pathname.startsWith("/desk/timesheet/view");
    const isForm =
      !isList &&
      (pathname === "/desk/timesheet/new" ||
        pathname.includes("/desk/timesheet/new-timesheet") ||
        /^\/desk\/timesheet\/[^/]+$/.test(pathname));

    content = isForm ? <TimesheetFormPage /> : <TimesheetListPage />;
  } else {
    content = <ProjectsWorkspacePage />;
  }

  return <WorkspaceModuleLayout slug={workspaceSlug}>{content}</WorkspaceModuleLayout>;
}
