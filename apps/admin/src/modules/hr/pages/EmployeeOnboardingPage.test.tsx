import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import EmployeeOnboardingPage from "./EmployeeOnboardingPage";

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
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();

  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  apiDelete.mockReset();

  apiGet.mockImplementation((url: string) => {
    if (url === "/hr/employee-onboardings/options") {
      return Promise.resolve({
        data: {
          job_applicants: [
            {
              id: "APPL-2026-001",
              name: "Budi Santoso",
              email: "budi.santoso@example.com",
              phone: "+62 812-3456-7890",
              designation: "Software Engineer",
              department: "Engineering & IT",
            },
          ],
          employees: [{ id: "EMP-001", name: "Rina Wijaya", email: "rina@example.com" }],
          companies: ["Codeverta Enterprise"],
          departments: ["Engineering & IT", "Human Resources"],
          designations: ["Software Engineer", "HR Manager"],
          employee_grades: ["Grade B (Senior / Lead)"],
          roles: ["HR Manager", "IT Support"],
          templates: [
            {
              template_name: "Standard Employee Onboarding",
              department: "Human Resources",
              designation: "Staff",
              employee_grade: "Grade C (Mid-Level)",
              activities: [
                {
                  activity_name: "Perform a legal and professional background check",
                  role: "HR Manager",
                  begin_on: 0,
                  duration: 3,
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }
    if (url === "/hr/employee-onboardings") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "onb-1",
              onboarding_number: "HR-ONB-2026-00001",
              job_applicant: "APPL-2026-001",
              applicant_name: "Budi Santoso",
              applicant_email: "budi.santoso@example.com",
              company: "Codeverta Enterprise",
              department: "Engineering & IT",
              designation: "Software Engineer",
              date_of_joining: "2026-10-01",
              status: "In Progress",
              activities: [
                {
                  id: "act-1",
                  activity_name: "Perform background check",
                  role: "HR Manager",
                  status: "Completed",
                  required: true,
                },
                {
                  id: "act-2",
                  activity_name: "Create Employee master",
                  role: "HR Manager",
                  status: "Pending",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }
    if (url === "/hr/employee-onboardings/onb-1") {
      return Promise.resolve({
        data: {
          data: {
            id: "onb-1",
            onboarding_number: "HR-ONB-2026-00001",
            job_applicant: "APPL-2026-001",
            applicant_name: "Budi Santoso",
            company: "Codeverta Enterprise",
            department: "Engineering & IT",
            designation: "Software Engineer",
            date_of_joining: "2026-10-01",
            status: "In Progress",
            activities: [
              {
                id: "act-1",
                activity_name: "Perform background check",
                role: "HR Manager",
                status: "Completed",
                required: true,
              },
              {
                id: "act-2",
                activity_name: "Create Employee master",
                role: "HR Manager",
                status: "Pending",
                required: true,
              },
            ],
          },
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  apiPost.mockImplementation((url: string) => {
    if (url === "/hr/employee-onboardings") {
      return Promise.resolve({
        data: {
          data: { id: "onb-2", onboarding_number: "HR-ONB-2026-00002" },
          message: "Employee Onboarding berhasil dibuat",
        },
      });
    }
    if (url.includes("/create-employee")) {
      return Promise.resolve({
        data: {
          data: {
            id: "onb-1",
            employee: "EMP-2026-A1B2",
            employee_name: "Budi Santoso",
          },
          message: "Employee master berhasil dibuat",
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

describe("EmployeeOnboardingPage", () => {
  it("renders onboarding list table with existing record", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/employee-onboarding"]}>
        <Routes>
          <Route path="/desk/employee-onboarding/*" element={<EmployeeOnboardingPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("HR-ONB-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getAllByText("Engineering & IT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Add Employee Onboarding")).toBeInTheDocument();
  });

  it("renders new onboarding form, displays default activities, and submits", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/employee-onboarding/new"]}>
        <Routes>
          <Route path="/desk/employee-onboarding/*" element={<EmployeeOnboardingPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("New Employee Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Not Saved")).toBeInTheDocument();

    // Verify key fields
    expect(screen.getByText(/Job Applicant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date of Joining/i)).toBeInTheDocument();
    expect(screen.getByText(/Employee Onboarding Template/i)).toBeInTheDocument();

    // Verify default activities are rendered
    expect(
      screen.getByDisplayValue("Perform a legal and professional background check")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Create an Employee master")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Create an Email Account")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Allocate leaves")).toBeInTheDocument();

    // Select candidate from searchable select
    const applicantTriggers = screen.getAllByText(/Begin typing for results/i);
    fireEvent.click(applicantTriggers[0]);

    await waitFor(() => {
      expect(screen.getByText(/APPL-2026-001 - Budi Santoso/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/APPL-2026-001 - Budi Santoso/i));

    // Save and submit
    const saveBtn = screen.getByRole("button", { name: /Save & Submit/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/hr/employee-onboardings",
        expect.objectContaining({
          job_applicant: "APPL-2026-001",
          applicant_name: "Budi Santoso",
        })
      );
    });
  });

  it("renders detail view and allows creating employee master", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/employee-onboarding/onb-1"]}>
        <Routes>
          <Route path="/desk/employee-onboarding/*" element={<EmployeeOnboardingPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("HR-ONB-2026-00001")).toBeInTheDocument();

    // Verify Create Employee button is present
    const createEmpBtn = screen.getByRole("button", { name: /Create Employee/i });
    expect(createEmpBtn).toBeInTheDocument();

    fireEvent.click(createEmpBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/hr/employee-onboardings/onb-1/create-employee");
    });
  });
});
