import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrdersPage from "./PurchaseOrdersPage";

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("PurchaseOrdersPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  const mockOrders = [
    {
      id: "po-123",
      number: "PUR-ORD-2026-00001",
      supplier: "PT Mitra Perkasa",
      company: "PT Toko Demo",
      transaction_date: "2026-09-12T00:00:00Z",
      schedule_date: "2026-09-20T00:00:00Z",
      status: "draft",
      currency: "IDR",
      rounded_total: 1500000,
    },
    {
      id: "po-456",
      number: "PUR-ORD-2026-00002",
      supplier: "PT Sumber Rejeki",
      company: "PT Toko Demo",
      transaction_date: "2026-09-11T00:00:00Z",
      schedule_date: "2026-09-18T00:00:00Z",
      status: "submitted",
      currency: "IDR",
      rounded_total: 2500000,
    },
  ];

  it("renders Purchase Order list in DataTable with search and filter toolbar", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        data: mockOrders,
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/purchase-order"]}>
        <Routes>
          <Route path="/desk/purchase-order" element={<PurchaseOrdersPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("PUR-ORD-2026-00001")).toBeInTheDocument();
      expect(screen.getByText("PUR-ORD-2026-00002")).toBeInTheDocument();
    });

    // Check search input and filter buttons are rendered
    expect(screen.getByPlaceholderText(/Cari purchase order, supplier/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filter/i })).toBeInTheDocument();
  });

  it("navigates directly to detail page when row is clicked without opening a modal dialog", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        data: mockOrders,
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/purchase-order"]}>
        <Routes>
          <Route path="/desk/purchase-order" element={<PurchaseOrdersPage />} />
          <Route
            path="/desk/purchase-order/:id"
            element={<div data-testid="po-detail-view">PO Detail Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("PUR-ORD-2026-00001")).toBeInTheDocument();
    });

    // Verify dialog is NOT open
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Detail lengkap dokumen pembelian/i)).not.toBeInTheDocument();

    // Click on the row
    const row = screen.getByText("PUR-ORD-2026-00001").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    // Verify it redirected to the detail page directly
    await waitFor(() => {
      expect(screen.getByTestId("po-detail-view")).toBeInTheDocument();
    });

    // Dialog still never appears
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
