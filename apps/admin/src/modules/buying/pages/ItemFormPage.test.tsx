import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItemFormPage from "./ItemFormPage";

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

describe("ItemFormPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
  });

  const mockUOMs = [
    { id: "uom-1", uom_name: "Nos", symbol: "Nos", common_code: "N", description: "Number", enabled: true },
    { id: "uom-2", uom_name: "Box", symbol: "Bx", common_code: "BX", description: "Box of items", enabled: true },
    { id: "uom-3", uom_name: "Kilogram", symbol: "Kg", common_code: "KGM", description: "Kilogram", enabled: true },
  ];

  const mockBrands = [
    { id: "brand-1", brand_name: "Apple", description: "Apple Electronics", enabled: true },
    { id: "brand-2", brand_name: "Samsung", description: "Samsung Group", enabled: true },
    { id: "brand-3", brand_name: "Logitech", description: "Logitech Computer Peripherals", enabled: true },
  ];

  const setupMocks = () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/master/options") {
        return Promise.resolve({
          data: {
            uoms: ["Nos", "Unit", "Pcs"],
            weight_uoms: ["Kg", "Gram"],
            item_groups: ["All Item Groups", "Products"],
            countries: ["Indonesia"],
          },
        });
      }
      if (url === "/stock/uoms") {
        return Promise.resolve({ data: { data: mockUOMs } });
      }
      if (url === "/stock/brands") {
        return Promise.resolve({ data: { data: mockBrands } });
      }
      if (url.startsWith("/buying/items/")) {
        return Promise.resolve({
          data: {
            id: "8b223fd4-9237-4b90-9fc7-3bc035b9480d",
            item_code: "ITEM-MACBOOK-PRO",
            item_name: "MacBook Pro M3 Max",
            item_group: "Products",
            stock_uom: "Nos",
            brand: "Apple",
            standard_rate: 45000000,
            uoms: [],
            barcodes: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  };

  it("fetches UOM and Brand from API and renders SearchableSelect for both", async () => {
    setupMocks();

    render(
      <MemoryRouter initialEntries={["/desk/item/new?workspace=selling"]}>
        <Routes>
          <Route path="/desk/item/*" element={<ItemFormPage workspace="selling" />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for form to finish initial load
    await waitFor(() => {
      expect(screen.getByText("New Item")).toBeInTheDocument();
    });

    // Verify Brand SearchableSelect is present with placeholder
    const brandTrigger = screen.getByText("Pilih Brand...");
    expect(brandTrigger).toBeInTheDocument();

    // Click Brand trigger
    fireEvent.click(brandTrigger);

    // Expect Brand options from API to be rendered
    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Samsung")).toBeInTheDocument();
      expect(screen.getByText("Logitech")).toBeInTheDocument();
    });

    // Select "Samsung"
    fireEvent.click(screen.getByText("Samsung"));

    // Brand trigger should now show "Samsung"
    await waitFor(() => {
      expect(screen.getByText("Samsung")).toBeInTheDocument();
    });

    // Test UOM selection: Find the default UOM trigger (currently "Nos")
    const uomTrigger = screen.getAllByRole("button").find(
      (btn) => btn.textContent?.includes("Nos")
    );
    expect(uomTrigger).toBeDefined();

    if (uomTrigger) {
      fireEvent.click(uomTrigger);
      // Verify UOM options from API
      await waitFor(() => {
        expect(screen.getByText("Box")).toBeInTheDocument();
        expect(screen.getByText("Kilogram")).toBeInTheDocument();
      });
      // Select "Box"
      fireEvent.click(screen.getByText("Box"));
      await waitFor(() => {
        expect(screen.getByText("Box")).toBeInTheDocument();
      });
    }
  });

  it("fetches and displays existing item with UOM and Brand on detail view", async () => {
    setupMocks();

    render(
      <MemoryRouter initialEntries={["/desk/item/8b223fd4-9237-4b90-9fc7-3bc035b9480d?workspace=selling"]}>
        <Routes>
          <Route path="/desk/item/*" element={<ItemFormPage workspace="selling" />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify detail is fetched
    await waitFor(() => {
      expect(screen.getByText("ITEM-MACBOOK-PRO")).toBeInTheDocument();
      expect(screen.getByDisplayValue("MacBook Pro M3 Max")).toBeInTheDocument();
      // Brand is loaded from API detail
      expect(screen.getByText("Apple")).toBeInTheDocument();
      // Stock UOM is loaded
      expect(screen.getByText("Nos")).toBeInTheDocument();
    });
  });
});
