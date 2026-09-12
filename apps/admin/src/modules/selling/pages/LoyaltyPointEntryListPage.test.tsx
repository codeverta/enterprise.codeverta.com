import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoyaltyPointEntryListPage from "./LoyaltyPointEntryListPage";

const { apiGet, apiPost, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: { get: apiGet, post: apiPost, put: vi.fn(), delete: apiDelete },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiDelete.mockReset();
  localStorage.clear();
});

describe("LoyaltyPointEntryListPage", () => {
  it("fetches entries and programs from API and does not display legacy dummy data when empty", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/loyalty-point-entries") {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === "/selling/loyalty-programs") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "lp-1",
                loyalty_program_name: "Member Rewards",
                loyalty_program_type: "Single Tier Program",
                auto_opt_in: true,
                conversion_factor: 1,
                expiry_duration: 365,
              },
            ],
          },
        });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({
          data: {
            data: [
              { id: "c-1", customer_name: "Customer VIP" },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/loyalty-point-entry"]}>
        <Routes>
          <Route path="/desk/loyalty-point-entry" element={<LoyaltyPointEntryListPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify empty state is rendered and NOT PT Sentosa Abadi
    expect(await screen.findByText("Belum ada riwayat transaksi poin")).toBeInTheDocument();
    expect(screen.queryByText("PT Sentosa Abadi")).not.toBeInTheDocument();
    expect(screen.queryByText("CV Jaya Wijaya")).not.toBeInTheDocument();

    // Verify Program Loyalty Aktif shows 1 skema
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders live entries from API with correct calculation and links to program", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/loyalty-point-entries") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "LPE-REAL-001",
                customer: "Budi Santoso",
                loyalty_program: "Member Rewards",
                sales_invoice: "POS-INV-2026001",
                reference_type: "POS Invoice",
                purchase_amount: 150000,
                loyalty_points: 15,
                posting_date: "2026-09-12",
                type: "Earned",
              },
              {
                id: "LPE-REAL-002",
                customer: "Budi Santoso",
                loyalty_program: "Member Rewards",
                sales_invoice: "POS-INV-2026002",
                reference_type: "POS Invoice",
                purchase_amount: 0,
                loyalty_points: -5,
                posting_date: "2026-09-12",
                type: "Redeemed",
              },
            ],
          },
        });
      }
      if (url === "/selling/loyalty-programs") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "lp-member",
                loyalty_program_name: "Member Rewards",
                loyalty_program_type: "Single Tier Program",
                auto_opt_in: true,
                conversion_factor: 1,
                expiry_duration: 365,
              },
            ],
          },
        });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({
          data: {
            data: [{ id: "c-1", customer_name: "Budi Santoso" }],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/loyalty-point-entry"]}>
        <Routes>
          <Route path="/desk/loyalty-point-entry" element={<LoyaltyPointEntryListPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for customer to appear
    expect(await screen.findByText("LPE-REAL-001")).toBeInTheDocument();
    expect(screen.getByText("LPE-REAL-002")).toBeInTheDocument();
    expect(screen.getAllByText("Budi Santoso").length).toBe(2);

    // Check KPI metrics and table rows
    expect(screen.getAllByText("+15").length).toBe(2);
    expect(screen.getAllByText("-5").length).toBe(2);
    expect(screen.getByText("10")).toBeInTheDocument(); // Net points: 15 - 5 = 10

    // Verify program link
    const programLinks = screen.getAllByRole("link", { name: /Member Rewards/i });
    expect(programLinks.length).toBeGreaterThanOrEqual(1);
    expect(programLinks[0]).toHaveAttribute("href", "/desk/loyalty-program/lp-member");
  });

  it("supports manual point entry creation via dialog", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/loyalty-point-entries") {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === "/selling/loyalty-programs") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "lp-member",
                loyalty_program_name: "Member Rewards",
                loyalty_program_type: "Single Tier Program",
              },
            ],
          },
        });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({
          data: {
            data: [{ id: "c-1", customer_name: "Siti Rahma" }],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    apiPost.mockImplementation((url: string, body: any) => {
      if (url === "/selling/loyalty-point-entries") {
        return Promise.resolve({
          data: {
            data: {
              id: "LPE-MANUAL-001",
              ...body,
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={["/desk/loyalty-point-entry"]}>
        <Routes>
          <Route path="/desk/loyalty-point-entry" element={<LoyaltyPointEntryListPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Belum ada riwayat transaksi poin")).toBeInTheDocument();

    // Click "Tambah Point Entry" button in header
    const addBtn = screen.getAllByRole("button", { name: /Tambah Point Entry/i })[0];
    fireEvent.click(addBtn);

    // Dialog title appears
    expect(screen.getByText("Tambah Loyalty Point Entry")).toBeInTheDocument();

    // Fill points input
    const pointsInput = screen.getByPlaceholderText("Contoh: 100");
    fireEvent.change(pointsInput, { target: { value: "50" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "Simpan Point Entry" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/loyalty-point-entries",
        expect.objectContaining({
          customer: "Siti Rahma",
          loyalty_program: "Member Rewards",
          loyalty_points: 50,
          type: "Earned",
        })
      );
    });
  });
});
