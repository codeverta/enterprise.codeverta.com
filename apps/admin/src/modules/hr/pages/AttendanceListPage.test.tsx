import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceListPage from "./AttendanceListPage";

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

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  apiDelete.mockReset();
});

const mockApis = () => {
  apiGet.mockImplementation((url: string) => {
    if (url === "/hr/attendances/stats") {
      return Promise.resolve({
        data: {
          total_employees: 10,
          present_today: 7,
          half_day_today: 1,
          on_leave_today: 1,
          absent_today: 1,
          date: "2026-09-10",
        },
      });
    }
    if (url === "/hr/attendances/options") {
      return Promise.resolve({
        data: {
          employees: [
            { id: "emp-1", name: "Agus Pratama", email: "agus@example.com", username: "agus_staff" },
            { id: "emp-2", name: "Budi Santoso", email: "budi@example.com", username: "budi_hr" },
          ],
          shifts: ["General Shift (08:00 - 17:00)", "Morning Shift (07:00 - 15:00)"],
          statuses: ["Present", "Absent", "On Leave", "Half Day"],
          departments: ["Engineering & IT", "Human Resources", "Finance & Accounting"],
          devices: ["QR Scanner - Lobby", "Biometric Fingerprint"],
        },
      });
    }
    if (url === "/hr/attendances") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "HR-ATT-20260910-0001",
              user_id: "emp-1",
              employee_name: "Agus Pratama",
              employee_email: "agus@example.com",
              department: "Engineering & IT",
              attendance_date: "2026-09-10T00:00:00Z",
              status: "Present",
              shift: "General Shift (08:00 - 17:00)",
              in_time: "2026-09-10T08:05:00Z",
              out_time: "2026-09-10T17:05:00Z",
              working_hours: 9,
              source: "QR Code",
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });

  apiPost.mockImplementation((url: string, payload: any) => {
    if (url === "/hr/attendances/mark-bulk") {
      return Promise.resolve({
        data: {
          message: "Berhasil memproses absensi: 2 baru dibuat, 0 diperbarui",
          created: 2,
          updated: 0,
        },
      });
    }
    if (url === "/hr/checkins/scan") {
      return Promise.resolve({
        data: {
          message: "Check-IN berhasil untuk Agus Pratama (QR Code)",
          log_type: "IN",
          checkin: {
            id: "chk-1",
            timestamp: new Date().toISOString(),
          },
          attendance: {
            id: "HR-ATT-20260910-0001",
            status: "Present",
          },
          employee: {
            id: "emp-1",
            name: "Agus Pratama",
            email: "agus@example.com",
          },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
};

describe("AttendanceListPage", () => {
  it("renders attendance list with KPI stats and records", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/attendance"]}>
        <Routes>
          <Route path="/desk/attendance" element={<AttendanceListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Attendance")).toBeInTheDocument();
    expect(await screen.findByText("Present Today")).toBeInTheDocument();
    expect(await screen.findByText("Agus Pratama")).toBeInTheDocument();
    expect(await screen.findByText("Engineering & IT")).toBeInTheDocument();
  });

  it("opens Mark Attendance tool and submits bulk attendance", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/attendance"]}>
        <Routes>
          <Route path="/desk/attendance" element={<AttendanceListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const markBtn = await screen.findByRole("button", { name: /Mark Attendance/i });
    fireEvent.click(markBtn);

    expect(await screen.findByText("Employee Attendance Tool")).toBeInTheDocument();
    const select = screen.getByLabelText("Pilih Karyawan");
    fireEvent.change(select, { target: { value: "emp-1" } });

    const submitBtn = screen.getByRole("button", { name: /^Mark Attendance$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/hr/attendances/mark-bulk",
        expect.objectContaining({
          user_ids: ["emp-1"],
          status: "Present",
        }),
      );
    });
  });

  it("opens terminal scan modal and processes QR/Fingerprint scan", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/attendance"]}>
        <Routes>
          <Route path="/desk/attendance" element={<AttendanceListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const terminalBtn = await screen.findByRole("button", { name: /Terminal Check-in/i });
    fireEvent.click(terminalBtn);

    expect(await screen.findByText("Attendance Scan Terminal (Kiosk)")).toBeInTheDocument();

    // Click quick employee simulation button
    const empBtn = await screen.findByRole("button", { name: /Agus Pratama/i });
    fireEvent.click(empBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/hr/checkins/scan",
        expect.objectContaining({
          identifier: "agus@example.com",
          source: "QR Code",
        }),
      );
    });
  });
});
