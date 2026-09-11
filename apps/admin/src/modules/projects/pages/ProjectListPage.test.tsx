import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectListPage from "./ProjectListPage";
import TaskListPage from "./TaskListPage";

const { apiGet, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: apiDelete,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const mockProjects = [
  {
    id: "PROJ-2026-0001",
    project_name: "Website Redesign Enterprise",
    status: "Open",
    priority: "High",
    percent_complete_method: "Task Completion",
    percent_complete: 50,
    customer: "PT Pelanggan Indonesia",
    department: "Engineering & IT",
    expected_end_date: "2026-12-31T00:00:00Z",
  },
  {
    id: "PROJ-2026-0002",
    project_name: "Internal Mobile App",
    status: "Completed",
    priority: "Medium",
    percent_complete_method: "Task Completion",
    percent_complete: 100,
    customer: "Internal",
    department: "Engineering & IT",
    expected_end_date: "2026-08-30T00:00:00Z",
  },
];

const mockTasks = [
  {
    id: "task-1",
    task_code: "TASK-2026-0001",
    subject: "Setup Database Schema",
    project_id: "PROJ-2026-0001",
    project_name: "Website Redesign Enterprise",
    status: "Working",
    priority: "High",
    progress: 60,
    task_weight: 1,
    is_milestone: true,
  },
];

describe("Projects and Tasks Module Frontend", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiDelete.mockReset();

    apiGet.mockImplementation((url: string, config?: any) => {
      if (url === "/projects") {
        const status = config?.params?.status;
        if (status === "Open") {
          return Promise.resolve({ data: { data: mockProjects.filter((p) => p.status === "Open") } });
        }
        return Promise.resolve({ data: { data: mockProjects } });
      }
      if (url === "/tasks") {
        return Promise.resolve({ data: { data: mockTasks } });
      }
      if (url === "/tasks/options") {
        return Promise.resolve({
          data: {
            projects: [{ id: "PROJ-2026-0001", project_name: "Website Redesign Enterprise", status: "Open" }],
            parent_tasks: [],
            types: ["Task", "Milestone"],
            statuses: ["Open", "Working", "Completed"],
            priorities: ["Low", "Medium", "High"],
          },
        });
      }
      return Promise.reject(new Error(`Unhandled GET: ${url}`));
    });
  });

  it("renders projects list with KPI statistics and table rows", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/project"]}>
        <Routes>
          <Route path="/desk/project" element={<ProjectListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Website Redesign Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Internal Mobile App")).toBeInTheDocument();
    expect(screen.getByText("PROJ-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    // Check KPI cards
    expect(screen.getByText("Total Projects")).toBeInTheDocument();
    expect(screen.getByText("Open Projects")).toBeInTheDocument();
  });

  it("filters projects list when ?status=Open is passed in URL", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/project?status=Open"]}>
        <Routes>
          <Route path="/desk/project" element={<ProjectListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/projects",
        expect.objectContaining({
          params: expect.objectContaining({ status: "Open" }),
        }),
      );
    });

    expect(await screen.findByText("Website Redesign Enterprise")).toBeInTheDocument();
    expect(screen.queryByText("Internal Mobile App")).not.toBeInTheDocument();
  });

  it("renders tasks list with subject, status, and milestone badge", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/task"]}>
        <Routes>
          <Route path="/desk/task" element={<TaskListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Setup Database Schema")).toBeInTheDocument();
    expect(screen.getByText("TASK-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Milestone")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
