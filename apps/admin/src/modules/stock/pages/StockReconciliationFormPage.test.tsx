import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import StockReconciliationFormPage from "./StockReconciliationFormPage";

const { apiGet, apiPost, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("StockReconciliationFormPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
  });

  const setupMocks = () => {
    apiGet.mockImplementation((url: string, config?: any) => {
      if (url === "/stock/stock-reconciliations/options") {
        return Promise.resolve({
          data: {
            naming_series: ["MAT-RECO-.YYYY.-"],
            purposes: ["Stock Reconciliation", "Opening Stock"],
            companies: ["UD MILLION CANDLES"],
            warehouses: ["Finished Goods - MC", "Stores - MC"],
            items: [
              {
                item_code: "MK",
                item_name: "Lilin Million Kecil",
                stock_uom: "Nos",
                valuation_rate: 2000,
                barcode: "8991234567890",
              },
              {
                item_code: "MB",
                item_name: "Lilin Million Besar",
                stock_uom: "Box",
                valuation_rate: 50000,
                barcode: "8991234567891",
              },
            ],
            expense_accounts: ["5111 - Stock Adjustment - Expense"],
            cost_centers: ["Main - MC"],
          },
        });
      }

      if (url === "/stock/stock-balances") {
        const itemCode = config?.params?.item_code;
        if (itemCode === "MK") {
          return Promise.resolve({
            data: {
              data: [
                { item_code: "MK", warehouse: "Finished Goods - MC", qty: 25 },
              ],
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      }

      return Promise.resolve({ data: {} });
    });
  };

  it("renders stock reconciliation form and auto-fetches existing qty when selecting item and warehouse", async () => {
    setupMocks();

    render(
      <MemoryRouter initialEntries={["/desk/stock-reconciliation/new"]}>
        <Routes>
          <Route path="/desk/stock-reconciliation/*" element={<StockReconciliationFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify key elements from user request are present
    expect(screen.getAllByText("New Stock Reconciliation").length).toBeGreaterThan(0);
    expect(screen.getByText("Not Saved")).toBeInTheDocument();

    expect(screen.getByText("naming_series")).toBeInTheDocument();
    expect(screen.getByText("company")).toBeInTheDocument();
    expect(screen.getByText("purpose")).toBeInTheDocument();
    expect(screen.getByText("scan_barcode")).toBeInTheDocument();
    expect(screen.getByText("scan_mode")).toBeInTheDocument();
    expect(screen.getByText("Disables auto-fetching of existing quantity")).toBeInTheDocument();
    expect(screen.getByText("expense_account")).toBeInTheDocument();
    expect(screen.getByText("cost_center")).toBeInTheDocument();

    // Select Item "MK"
    const itemSelectBtn = screen.getByText("Pilih item...");
    fireEvent.click(itemSelectBtn);

    await waitFor(() => {
      expect(screen.getByText("MK - Lilin Million Kecil")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("MK - Lilin Million Kecil"));

    // Verify auto-fetched qty 25 appears in quantity input
    await waitFor(() => {
      const qtyInput = screen.getByDisplayValue("25");
      expect(qtyInput).toBeInTheDocument();
    });
  });
});
