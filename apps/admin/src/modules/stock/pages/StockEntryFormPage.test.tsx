import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import StockEntryFormPage from "./StockEntryFormPage";

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

describe("StockEntryFormPage Submittable Workflow", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
  });

  const setupMocks = () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/stock/stock-entries/options") {
        return Promise.resolve({
          data: {
            stock_entry_types: ["Material Transfer", "Material Issue", "Material Receipt"],
            naming_series: ["MAT-STE-.YYYY.-"],
            companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
            warehouses: ["Stores - PZTS", "Finished Goods - PZTS"],
            items: [
              {
                item_code: "MK",
                item_name: "Lilin Million Kecil",
                uom: "Nos",
                basic_rate: 2000,
                barcode: "8991234567890",
              },
            ],
          },
        });
      }
      if (url === "/stock/stock-entries/ste-12345") {
        return Promise.resolve({
          data: {
            id: "ste-12345",
            stock_entry_number: "MAT-STE-2026-00001",
            stock_entry_type: "Material Transfer",
            purpose: "Material Transfer",
            company: "PT ZENIT TECHNOLOGY SOLUTION",
            status: "Draft",
            posting_date: "2026-09-12",
            posting_time: "18:00:00",
            from_warehouse: "Stores - PZTS",
            to_warehouse: "Finished Goods - PZTS",
            total_qty: 10,
            total_amount: 20000,
            items: [
              {
                id: "item-1",
                item_code: "MK",
                item_name: "Lilin Million Kecil",
                source_warehouse: "Stores - PZTS",
                target_warehouse: "Finished Goods - PZTS",
                qty: 10,
                uom: "Nos",
                basic_rate: 2000,
                amount: 20000,
              },
            ],
          },
        });
      }
      if (url === "/stock/stock-entry-types") {
        return Promise.resolve({
          data: { data: [{ name: "Material Transfer", purpose: "Material Transfer" }] },
        });
      }
      if (url === "/stock/warehouses/companies") {
        return Promise.resolve({
          data: { data: [{ id: "c-1", name: "PT ZENIT TECHNOLOGY SOLUTION" }] },
        });
      }
      if (url === "/stock/uoms") {
        return Promise.resolve({
          data: {
            data: [
              { uom_name: "Nos", symbol: "Nos" },
              { uom_name: "Box", symbol: "Bx" },
              { uom_name: "Unit", symbol: "Unit" },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  };

  it("renders new stock entry form and shows draft/submit actions with Unit fetched from API", async () => {
    setupMocks();

    render(
      <MemoryRouter initialEntries={["/desk/stock-entry/new"]}>
        <Routes>
          <Route path="/desk/stock-entry/*" element={<StockEntryFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("New Stock Entry").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Not Saved").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("columnheader", { name: /^Unit$/i })).toBeInTheDocument();
    });

    // Check action buttons exist
    expect(screen.getByRole("button", { name: /Simpan Draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeInTheDocument();
  });

  it("renders existing draft stock entry and submits it", async () => {
    setupMocks();
    apiPost.mockImplementation((url: string) => {
      if (url === "/stock/stock-entries/ste-12345/submit") {
        return Promise.resolve({
          data: {
            id: "ste-12345",
            stock_entry_number: "MAT-STE-2026-00001",
            status: "Submitted",
            company: "PT ZENIT TECHNOLOGY SOLUTION",
            stock_entry_type: "Material Transfer",
            items: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Mock confirm
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    render(
      <MemoryRouter initialEntries={["/desk/stock-entry/ste-12345"]}>
        <Routes>
          <Route path="/desk/stock-entry/*" element={<StockEntryFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("MAT-STE-2026-00001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    });

    const submitBtn = screen.getAllByRole("button", { name: /Submit/i })[0];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/stock/stock-entries/ste-12345/submit");
      expect(screen.getAllByText("Submitted").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("button", { name: /Cancel Dokumen/i })).toBeInTheDocument();
    });
  });

  it("allows cancelling a submitted stock entry", async () => {
    setupMocks();
    apiGet.mockImplementation((url: string) => {
      if (url === "/stock/stock-entries/options") {
        return Promise.resolve({
          data: {
            stock_entry_types: ["Material Transfer"],
            naming_series: ["MAT-STE-.YYYY.-"],
            companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
            warehouses: ["Stores - PZTS"],
            items: [],
          },
        });
      }
      if (url === "/stock/stock-entries/ste-submitted") {
        return Promise.resolve({
          data: {
            id: "ste-submitted",
            stock_entry_number: "MAT-STE-2026-00002",
            stock_entry_type: "Material Transfer",
            status: "Submitted",
            company: "PT ZENIT TECHNOLOGY SOLUTION",
            posting_date: "2026-09-12",
            posting_time: "18:00:00",
            items: [],
          },
        });
      }
      if (url === "/stock/stock-entry-types") {
        return Promise.resolve({
          data: { data: [{ name: "Material Transfer", purpose: "Material Transfer" }] },
        });
      }
      if (url === "/stock/warehouses/companies") {
        return Promise.resolve({
          data: { data: [{ id: "c-1", name: "PT ZENIT TECHNOLOGY SOLUTION" }] },
        });
      }
      return Promise.resolve({ data: {} });
    });

    apiPost.mockImplementation((url: string) => {
      if (url === "/stock/stock-entries/ste-submitted/cancel") {
        return Promise.resolve({
          data: {
            id: "ste-submitted",
            stock_entry_number: "MAT-STE-2026-00002",
            status: "Cancelled",
            company: "PT ZENIT TECHNOLOGY SOLUTION",
            stock_entry_type: "Material Transfer",
            items: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    vi.spyOn(window, "confirm").mockImplementation(() => true);

    render(
      <MemoryRouter initialEntries={["/desk/stock-entry/ste-submitted"]}>
        <Routes>
          <Route path="/desk/stock-entry/*" element={<StockEntryFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Submitted").length).toBeGreaterThanOrEqual(1);
    });

    const cancelBtn = screen.getByRole("button", { name: /Cancel Dokumen/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/stock/stock-entries/ste-submitted/cancel");
      expect(screen.getAllByText("Cancelled").length).toBeGreaterThanOrEqual(1);
    });
  });
});
