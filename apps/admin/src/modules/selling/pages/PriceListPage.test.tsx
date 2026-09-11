import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PriceListPage from "./PriceListPage";
import ItemPricePage from "./ItemPricePage";

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

describe("Price List and Item Price Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/price-lists") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "pl-1",
                price_list_name: "Standar Selling",
                currency: "IDR",
                buying: false,
                selling: true,
                enabled: true,
              },
              {
                id: "pl-2",
                price_list_name: "Standar Buying",
                currency: "IDR",
                buying: true,
                selling: false,
                enabled: true,
              },
            ],
          },
        });
      }
      if (url === "/selling/item-prices") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "ip-1",
                item_code: "ITEM-001",
                item_name: "Produk A",
                price_list: "Standar Selling",
                price_list_rate: 25000,
                currency: "IDR",
                uom: "Nos",
                is_active: true,
              },
            ],
          },
        });
      }
      if (url.startsWith("/currencies")) {
        return Promise.resolve({
          data: {
            data: [
              { id: "IDR", currency_name: "Indonesian Rupiah", symbol: "Rp", enabled: true },
              { id: "USD", currency_name: "US Dollar", symbol: "$", enabled: true },
            ],
          },
        });
      }
      if (url.startsWith("/buying/items")) {
        return Promise.resolve({
          data: {
            data: [
              { item_code: "ITEM-001", item_name: "Produk A", stock_uom: "Nos", standard_rate: 25000 },
            ],
          },
        });
      }
      if (url.startsWith("/stock/uoms")) {
        return Promise.resolve({
          data: {
            data: [{ id: "uom-1", uom_name: "Nos" }],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    apiPost.mockResolvedValue({ data: { success: true } });
  });

  it("renders PriceListPage with seed button and triggers seeder", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/price-list"]}>
        <Routes>
          <Route path="/desk/price-list" element={<PriceListPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Price List & Item Price")).toBeInTheDocument();
    });

    // Verify seed button exists
    const seedButton = screen.getByText("Seed Standar Price List");
    expect(seedButton).toBeInTheDocument();

    // Click seed button
    fireEvent.click(seedButton);
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/selling/price-lists/seed");
    });
  });

  it("renders ItemPricePage on /desk/item-price/new and loads price lists from API", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/item-price/new"]}>
        <Routes>
          <Route path="/desk/item-price/*" element={<ItemPricePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("New Item Price").length).toBeGreaterThan(0);
    });

    // Check that price list from API was requested
    expect(apiGet).toHaveBeenCalledWith("/selling/price-lists");
    // Check that currency from API was requested
    expect(apiGet).toHaveBeenCalledWith("/currencies", expect.anything());

    // Verify Price List element is rendered with API value
    await waitFor(() => {
      expect(screen.getByText("Price List")).toBeInTheDocument();
      expect(screen.getAllByText("Standar Selling").length).toBeGreaterThan(0);
    });
  });
});
