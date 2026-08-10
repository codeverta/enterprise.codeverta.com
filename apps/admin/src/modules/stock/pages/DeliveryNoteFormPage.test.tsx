import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeliveryNoteFormPage from "./DeliveryNoteFormPage";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("@/lib/api", () => ({
  default: { get: apiGet, post: apiPost, put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("Sales Order to Delivery Note flow", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === "/stock/delivery-notes/options") {
        return Promise.resolve({ data: {
          naming_series: ["MAT-DN-.YYYY.-"],
          companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
          currencies: ["IDR"],
          price_lists: ["Standard Selling"],
          warehouses: ["Stores - PT ZENIT"],
          tax_categories: ["In State"],
          taxes_templates: ["PPN 11%"],
          shipping_rules: ["Standard Delivery"],
          incoterms: ["EXW"],
        } });
      }
      if (url === "/crm/sales-orders/982704fd-635f-423a-a507-17b0234a9235") {
        return Promise.resolve({ data: {
          id: "982704fd-635f-423a-a507-17b0234a9235",
          customer: "PT Pelanggan Indonesia",
          currency: "IDR",
          items: [{ item_code: "ITEM-001", item_name: "Produk Satu", quantity: 2, rate: 100_000, amount: 200_000 }],
        } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    apiPost.mockImplementation((_url: string, payload: object) => Promise.resolve({ data: { ...payload, id: "dn-test-1", number: "MAT-DN-2026-TEST" } }));
  });

  it("prefills the referenced order and submits a backend-valid posting date", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/desk/delivery-note/new?sales_order_id=982704fd-635f-423a-a507-17b0234a9235"]}>
        <Routes>
          <Route path="/desk/delivery-note/*" element={<DeliveryNoteFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("PT Pelanggan Indonesia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ITEM-001")).toBeInTheDocument();
    expect(screen.getByText("Produk Satu")).toBeInTheDocument();
    expect(screen.getByText(/Dibuat dari Sales Order/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
      "/stock/delivery-notes",
      expect.objectContaining({
        sales_order_id: "982704fd-635f-423a-a507-17b0234a9235",
        customer: "PT Pelanggan Indonesia",
        posting_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/),
        items: [expect.objectContaining({ item_code: "ITEM-001", quantity: 2 })],
      }),
    ));
  });
});
