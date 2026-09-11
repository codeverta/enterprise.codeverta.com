import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import POSClosingFormPage from "./POSClosingFormPage";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    post: apiPost,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("POSClosingFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders existing POS Closing Entry with linked sales invoice transactions and totals", async () => {
    const mockClosing = {
      id: "POS-CLOSE-20260911-1c0576",
      pos_opening_entry: "POS-OPEN-20260911-abcdef",
      period_start_date: "2026-09-11T23:38:19Z",
      period_end_date: "2026-09-11T23:45:00Z",
      posting_date: "2026-09-11",
      posting_time: "23:45:00",
      company: "UD MILLION CANDLES",
      pos_profile: "Usaha Jualan Lilin",
      user: "Administrator",
      total_quantity: 4,
      net_total: 28000,
      total_taxes_and_charges: 0,
      grand_total: 28000,
      status: "Submitted",
      payment_reconciliation: [
        {
          mode_of_payment: "Cash",
          opening_amount: 0,
          expected_amount: 28000,
          closing_amount: 28000,
          difference: 0,
        },
        {
          mode_of_payment: "Bank Transfer",
          opening_amount: 0,
          expected_amount: 0,
          closing_amount: 0,
          difference: 0,
        },
      ],
      sales_invoices: [
        {
          id: "posci-1",
          sales_invoice: "ACC-SINV-2026-00011",
          customer: "Walk-in Customer",
          posting_date: "2026-09-11",
          grand_total: 28000,
        },
      ],
    };

    apiGet.mockImplementation((url: string) => {
      if (url.includes("/selling/pos/closing-entries/POS-CLOSE-20260911-1c0576")) {
        return Promise.resolve({ data: mockClosing });
      }
      if (url.includes("/selling/pos/opening-entries/POS-OPEN-20260911-abcdef")) {
        return Promise.resolve({
          data: {
            id: "POS-OPEN-20260911-abcdef",
            company: "UD MILLION CANDLES",
            pos_profile: "Usaha Jualan Lilin",
            user: "Administrator",
            period_start_date: "2026-09-11T23:38:19Z",
            balance_details: [{ mode_of_payment: "Cash", opening_amount: 0 }],
          },
        });
      }
      if (url.includes("/selling/pos/invoices")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={["/desk/pos-closing-entry/POS-CLOSE-20260911-1c0576"]}>
        <Routes>
          <Route path="/desk/pos-closing-entry/:id" element={<POSClosingFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("POS-CLOSE-20260911-1c0576")).toBeInTheDocument();
    });

    // Check Company, Profile, Cashier
    expect(screen.getByText("UD MILLION CANDLES")).toBeInTheDocument();
    expect(screen.getByText("Usaha Jualan Lilin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();

    // Check Linked Invoices section
    expect(screen.getByText("Linked Invoices")).toBeInTheDocument();
    expect(screen.getByText("sales_invoices")).toBeInTheDocument();
    expect(screen.getByText("ACC-SINV-2026-00011")).toBeInTheDocument();
    const invoiceLink = screen.getByRole("link", { name: "ACC-SINV-2026-00011" });
    expect(invoiceLink).toHaveAttribute("href", "/desk/sales-invoice/ACC-SINV-2026-00011");

    // Check Totals
    expect(screen.getByText("Total Quantity")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // Check Payment Reconciliation
    expect(screen.getByText("Modes of Payment")).toBeInTheDocument();
    expect(screen.getByText("payment_reconciliation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cash" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bank Transfer" })).toBeInTheDocument();
  });
});
