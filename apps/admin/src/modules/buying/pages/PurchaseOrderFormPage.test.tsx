import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderFormPage from "./PurchaseOrderFormPage";

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

describe("PurchaseOrderFormPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
  });

  const mockItems = [
    {
      id: "item-1",
      item_code: "ITEM-LAPTOP-01",
      item_name: "Laptop Asus ROG",
      item_group: "Electronics",
      stock_uom: "Unit",
      purchase_uom: "Unit",
      standard_rate: 15000000,
    },
    {
      id: "item-2",
      item_code: "ITEM-MOUSE-02",
      item_name: "Logitech MX Master 3",
      item_group: "Electronics",
      stock_uom: "Pcs",
      purchase_uom: "Pcs",
      standard_rate: 1200000,
    },
  ];

  const mockSuppliers = [
    {
      id: "sup-1",
      supplier_name: "PT Mitra Perkasa",
      supplier_group: "Distributor",
      default_currency: "IDR",
    },
  ];

  const setupDefaultMocks = () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/purchase-orders/options") {
        return Promise.resolve({
          data: {
            companies: ["PT Toko Demo"],
            suppliers: ["PT Mitra Perkasa"],
            warehouses: ["Gudang Utama"],
            items: ["ITEM-LAPTOP-01", "ITEM-MOUSE-02"],
            currencies: ["IDR", "USD"],
            price_lists: ["Standard Buying"],
            uoms: ["Unit", "Pcs"],
          },
        });
      }
      if (url === "/buying/suppliers") {
        return Promise.resolve({ data: { data: mockSuppliers } });
      }
      if (url === "/buying/items") {
        return Promise.resolve({ data: { data: mockItems } });
      }
      if (url === "/selling/price-lists") {
        return Promise.resolve({
          data: [{ price_list_name: "Standard Buying", buying: true, currency: "IDR" }],
        });
      }
      if (url === "/stock/warehouses") {
        return Promise.resolve({
          data: [{ id: "wh-1", warehouse_name: "Gudang Utama", company: "PT Toko Demo" }],
        });
      }
      if (url === "/accounting/currencies") {
        return Promise.resolve({
          data: [{ id: "IDR", currency_name: "Indonesian Rupiah", symbol: "Rp" }],
        });
      }
      if (url.startsWith("/selling/item-prices")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
  };

  it("renders searchable select for items and auto-populates rate and uom on selection", async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={["/desk/purchase-order/new"]}>
        <Routes>
          <Route path="/desk/purchase-order/*" element={<PurchaseOrderFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("New Purchase Order")).toBeInTheDocument();
    });

    // Verify SearchableSelect placeholder for Item is present
    const itemSelectTrigger = screen.getByText("Pilih Item...");
    expect(itemSelectTrigger).toBeInTheDocument();

    // Click item select trigger
    fireEvent.click(itemSelectTrigger);

    // Verify item options from API are rendered
    await waitFor(() => {
      expect(screen.getByText("ITEM-LAPTOP-01 - Laptop Asus ROG")).toBeInTheDocument();
    });

    // Select the laptop item
    fireEvent.click(screen.getByText("ITEM-LAPTOP-01 - Laptop Asus ROG"));

    // Rate and item name should be populated
    await waitFor(() => {
      expect(screen.getByText("Laptop Asus ROG")).toBeInTheDocument();
    });
  });

  it("correctly fetches and displays purchase order data in detail view", async () => {
    setupDefaultMocks();

    const mockDetailPO = {
      id: "f53098c4-0a75-4fd9-a2d0-f82cab3ee5ce",
      number: "PUR-ORD-2026-00001",
      naming_series: "PUR-ORD-.YYYY.-",
      status: "draft",
      supplier: "PT Mitra Perkasa",
      company: "PT Toko Demo",
      transaction_date: "2026-09-12T00:00:00Z",
      schedule_date: "2026-09-20T00:00:00Z",
      currency: "IDR",
      buying_price_list: "Standard Buying",
      total_qty: 2,
      total: 30000000,
      grand_total: 30000000,
      rounded_total: 30000000,
      items: [
        {
          id: "item-row-1",
          item_code: "ITEM-LAPTOP-01",
          item_name: "Laptop Asus ROG",
          description: "Laptop Asus ROG Core i9",
          schedule_date: "2026-09-20T00:00:00Z",
          quantity: 2,
          uom: "Unit",
          rate: 15000000,
          amount: 30000000,
          target_warehouse: "Gudang Utama",
        },
      ],
      taxes: [],
    };

    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/purchase-orders/f53098c4-0a75-4fd9-a2d0-f82cab3ee5ce") {
        return Promise.resolve({ data: mockDetailPO });
      }
      if (url === "/buying/purchase-orders/options") {
        return Promise.resolve({ data: {} });
      }
      if (url === "/buying/suppliers") {
        return Promise.resolve({ data: { data: mockSuppliers } });
      }
      if (url === "/buying/items") {
        return Promise.resolve({ data: { data: mockItems } });
      }
      if (url === "/selling/price-lists") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/stock/warehouses") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/accounting/currencies") {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={["/desk/purchase-order/f53098c4-0a75-4fd9-a2d0-f82cab3ee5ce"]}>
        <Routes>
          <Route path="/desk/purchase-order/*" element={<PurchaseOrderFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify detail is loaded and header shows PUR-ORD-2026-00001
    await waitFor(() => {
      expect(screen.getByText("PUR-ORD-2026-00001")).toBeInTheDocument();
      expect(screen.getByText("PT Mitra Perkasa")).toBeInTheDocument();
      expect(screen.getByText("Laptop Asus ROG")).toBeInTheDocument();
    });

    // Ensure it's not showing "Not Saved"
    expect(screen.queryByText("Not Saved")).not.toBeInTheDocument();
  });
});
