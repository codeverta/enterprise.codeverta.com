import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimesheetListPage from "./TimesheetListPage";
import TimesheetFormPage from "./TimesheetFormPage";

const { apiGet, apiPost, apiPut, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const mockTimesheets = [
  {
    id: "TS-2026-00001",
    series: "TS-.YYYY.-.#####",
    employee_id: "user-1",
    employee_name: "Rabih Utomo",
    company: "CODEVERTA ENTERPRISE",
    customer: "PT Pelanggan Indonesia",
    status: "Draft",
    start_date: "2026-09-11T00:00:00Z",
    end_date: "2026-09-11T00:00:00Z",
    total_working_hours: 5,
    total_billable_hours: 2,
    total_billable_amount: 500000,
    total_costing_amount: 900000,
    time_logs: [
      {
        idx: 1,
        activity_type: "Communication",
        from_time: "2026-09-11T00:13:18Z",
        hours: 2,
        is_billable: true,
        billing_rate: 250000,
        billing_amount: 500000,
        project_name: "Malabar Trailrun",
      },
      {
        idx: 2,
        activity_type: "Development",
        from_time: "2026-09-11T02:13:18Z",
        hours: 3,
        is_billable: false,
        billing_rate: 0,
        billing_amount: 0,
        project_name: "Malabar Trailrun",
      },
    ],
  },
];

describe("Timesheet Feature Frontend", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();

    apiGet.mockImplementation((url: string) => {
      if (url === "/timesheets") {
        return Promise.resolve({ data: { data: mockTimesheets } });
      }
      if (url === "/timesheets/options") {
        return Promise.resolve({
          data: {
            employees: [{ id: "user-1", name: "Rabih Utomo", email: "admin@example.com", username: "admin" }],
            projects: [{ id: "PROJ-0001", project_name: "Malabar Trailrun", customer: "PT Pelanggan Indonesia" }],
            tasks: [],
            activity_types: ["Communication", "Planning", "Development"],
            companies: ["CODEVERTA ENTERPRISE"],
            customers: ["PT Pelanggan Indonesia"],
            statuses: ["Draft", "Submitted", "Cancelled"],
          },
        });
      }
      if (url.startsWith("/timesheets/TS-2026-00001")) {
        return Promise.resolve({ data: { data: mockTimesheets[0] } });
      }
      return Promise.reject(new Error(`Unhandled GET: ${url}`));
    });
  });

  it("renders timesheet list with KPI stats and rows", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/timesheet"]}>
        <Routes>
          <Route path="/desk/timesheet" element={<TimesheetListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Rabih Utomo")).length).toBeGreaterThan(0);
    expect(screen.getByText("TS-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("CODEVERTA ENTERPRISE")).toBeInTheDocument();
    expect(screen.getAllByText("5 hrs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders timesheet detail form with time log items", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/timesheet/TS-2026-00001"]}>
        <Routes>
          <Route path="/desk/timesheet/:id" element={<TimesheetFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Rabih Utomo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CODEVERTA ENTERPRISE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeInTheDocument();

    // Verify time log items
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
  });
});
