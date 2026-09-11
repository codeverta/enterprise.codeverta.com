import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesOrderFormPage, { mergeServerOrder } from "./SalesOrderPage";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
  default: { get: apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
  apiGet.mockReset();
  localStorage.clear();
});

describe("Sales Order detail mapping", () => {
  it("maps API header, dates, totals, and items into form values", () => {
    const mapped = mergeServerOrder({
      id: "982704fd-635f-423a-a507-17b0234a9235",
      order_number: "SAL-ORD-2026-00001",
      customer: "PT Pelanggan Indonesia",
      customer_email: "buyer@example.com",
      shipping_address: "Jakarta",
      transaction_date: "2026-08-07T00:00:00Z",
      currency: "IDR",
      subtotal: 200_000,
      shipping_amount: 10_000,
      total_amount: 210_000,
      payment_status: "PAID",
      status: "confirmed",
      items: [{
        item_code: "ITEM-001",
        item_name: "Produk Satu",
        quantity: 2,
        rate: 100_000,
        amount: 200_000,
      }],
    } as any);

    expect(mapped).toMatchObject({
      id: "982704fd-635f-423a-a507-17b0234a9235",
      order_number: "SAL-ORD-2026-00001",
      customer: "PT Pelanggan Indonesia",
      transaction_date: "2026-08-07",
      currency: "IDR",
      total: 200_000,
      grand_total: 210_000,
      rounded_total: 210_000,
    });
    expect(mapped.items).toEqual([expect.objectContaining({
      item_code: "ITEM-001",
      item_name: "Produk Satu",
      quantity: 2,
      rate: 100_000,
      amount: 200_000,
    })]);
  });

  it("fetches the route id and fills the edit form from the API detail", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        id: "982704fd-635f-423a-a507-17b0234a9235",
        order_number: "SAL-ORD-2026-00001",
        customer: "PT Pelanggan Indonesia",
        transaction_date: "2026-08-07T00:00:00Z",
        currency: "IDR",
        subtotal: 200_000,
        total_amount: 210_000,
        status: "confirmed",
        items: [{ item_code: "ITEM-001", item_name: "Produk Satu", quantity: 2, rate: 100_000, amount: 200_000 }],
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/sales-order/982704fd-635f-423a-a507-17b0234a9235"]}>
        <Routes>
          <Route path="/desk/sales-order/*" element={<SalesOrderFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("PT Pelanggan Indonesia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-07")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ITEM-001")).toBeInTheDocument();
    expect(screen.getByText("Produk Satu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SAL-ORD-2026-00001" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New Sales Order" })).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/crm/sales-orders/982704fd-635f-423a-a507-17b0234a9235");
  });

  it("uses cached form-only fields without overwriting fresh API data", () => {
    const mapped = mergeServerOrder({
      id: "order-1",
      order_number: "SERVER-ORDER",
      customer: "Server Customer",
      transaction_date: "2026-08-07T00:00:00Z",
      status: "processing",
      currency: "IDR",
      items: [],
    } as any, {
      id: "order-1",
      order_number: "CACHED-ORDER",
      customer: "Cached Customer",
      transaction_date: "2026-01-01",
      delivery_date: "2026-08-20",
      status: "draft",
      currency: "IDR",
      items: [{ item_code: "CACHE-ITEM", quantity: 1, rate: 50_000, amount: 50_000 }],
    } as any);

    expect(mapped.order_number).toBe("SERVER-ORDER");
    expect(mapped.customer).toBe("Server Customer");
    expect(mapped.transaction_date).toBe("2026-08-07");
    expect(mapped.delivery_date).toBe("2026-08-20");
    expect(mapped.items[0].item_code).toBe("CACHE-ITEM");
  });

  it("automatically adjusts rate and amount when selecting an item code in new Sales Order", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/organization/companies") {
        return Promise.resolve({ data: [{ name: "UD MILLION CANDLES", abbreviation: "MC" }] });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({ data: [{ customer_name: "Customer Bintang", email: "bintang@example.com" }] });
      }
      if (url === "/selling/sales-invoices/options") {
        return Promise.resolve({
          data: {
            companies: ["UD MILLION CANDLES"],
            customers: ["Customer Bintang"],
            items: [
              { item_code: "LILIN-01", item_name: "Lilin Aroma Terapi", uom: "Pcs", rate: 25000 },
            ],
          },
        });
      }
      if (url === "/buying/items") {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={["/desk/sales-order/new"]}>
        <Routes>
          <Route path="/desk/sales-order/*" element={<SalesOrderFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "New Sales Order" })).toBeInTheDocument();

    const trigger = screen.getByText("Pilih Item Code...");
    fireEvent.click(trigger);

    const itemMenu = await screen.findByRole("listbox", { name: "Cari kode atau nama item..." });
    const tableScroller = document.querySelector(".overflow-x-auto");
    expect(tableScroller).not.toContainElement(itemMenu);
    expect(itemMenu.closest("[data-radix-popper-content-wrapper]")?.parentElement).toBe(document.body);

    const optionBtn = await screen.findByRole("button", { name: /LILIN-01/i });
    fireEvent.click(optionBtn);

    expect(await screen.findByText("Lilin Aroma Terapi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 25.000").length).toBeGreaterThanOrEqual(1);
  });
});
