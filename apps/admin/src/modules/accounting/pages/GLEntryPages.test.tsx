import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GLEntryListPage from "./GLEntryListPage";
import GLEntryFormPage from "./GLEntryFormPage";
import { glEntryApi, type GLEntry } from "../glEntryApi";
import { LanguageProvider } from "@/context/LanguageContext";

vi.mock("../glEntryApi", () => ({
  glEntryApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOptions: vi.fn(),
  },
}));

const mockGLEntry82808c1ee5: GLEntry = {
  id: "82808c1ee5",
  posting_date: "2026-08-05T00:00:00Z",
  fiscal_year: "2026",
  account: "4210.000 - HPP Pembelian - PZTS",
  account_currency: "IDR",
  against: "1141.000 - Persediaan Barang - PZTS",
  voucher_type: "Delivery Note",
  voucher_no: "MAT-DN-2026-00001",
  voucher_subtype: "Delivery Note",
  transaction_currency: "IDR",
  transaction_exchange_rate: 1,
  reporting_currency_exchange_rate: 1,
  debit_in_account_currency: 0,
  debit: 0,
  debit_in_transaction_currency: 0,
  debit_in_reporting_currency: 0,
  credit_in_account_currency: 10000,
  credit: 10000,
  credit_in_transaction_currency: 10000,
  credit_in_reporting_currency: 10000,
  cost_center: "Main - PZTS",
  company: "PT ZENIT TECHNOLOGY SOLUTION",
  is_opening: false,
  is_advance: false,
  is_cancelled: true,
  remarks: "On cancellation of MAT-DN-2026-00001",
  comment: "At",
};

describe("GLEntryListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (glEntryApi.getOptions as any).mockResolvedValue({
      accounts: ["4210.000 - HPP Pembelian - PZTS", "1141.000 - Persediaan Barang - PZTS"],
      companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
      cost_centers: ["Main - PZTS"],
      voucher_types: ["Delivery Note", "Sales Invoice", "Purchase Invoice", "Journal Entry"],
      currencies: ["IDR", "USD"],
    });

    (glEntryApi.list as any).mockResolvedValue({
      data: [mockGLEntry82808c1ee5],
      total: 1,
      page: 1,
      limit: 100,
      total_debit: 0,
      total_credit: 10000,
      difference: -10000,
    });
  });

  it("renders GL Entry list with entry 82808c1ee5, account, voucher, and cancelled status", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/gl-entry"]}>
          <GLEntryListPage />
        </MemoryRouter>
      </LanguageProvider>
    );

    // Should display entry ID link
    expect(await screen.findByText("82808c1ee5")).toBeInTheDocument();

    // Should display account name
    expect(screen.getByText("4210.000 - HPP Pembelian - PZTS")).toBeInTheDocument();

    // Should display voucher number
    expect(screen.getByText("MAT-DN-2026-00001")).toBeInTheDocument();

    // Should display Delivery Note badge and select option
    expect(screen.getAllByText("Delivery Note").length).toBeGreaterThanOrEqual(1);

    // Should display Cancelled status
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    // Should display credit amount (Rp 10.000)
    expect(screen.getAllByText(/10\.000/).length).toBeGreaterThanOrEqual(1);

    // Should display Against counter account
    expect(screen.getByText("1141.000 - Persediaan Barang - PZTS")).toBeInTheDocument();
  });
});

describe("GLEntryFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (glEntryApi.getOptions as any).mockResolvedValue({
      accounts: ["4210.000 - HPP Pembelian - PZTS", "1141.000 - Persediaan Barang - PZTS"],
      companies: ["PT ZENIT TECHNOLOGY SOLUTION"],
      cost_centers: ["Main - PZTS"],
      voucher_types: ["Delivery Note", "Sales Invoice", "Purchase Invoice", "Journal Entry"],
      currencies: ["IDR", "USD"],
    });

    (glEntryApi.get as any).mockResolvedValue(mockGLEntry82808c1ee5);
  });

  it("renders detail view for 82808c1ee5 with all prompt sections and fields", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/gl-entry/82808c1ee5"]}>
          <Routes>
            <Route path="/desk/gl-entry/:id" element={<GLEntryFormPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    );

    // Verify ID and Header (multiple elements in breadcrumb and header)
    const idElements = await screen.findAllByText("82808c1ee5");
    expect(idElements.length).toBeGreaterThanOrEqual(1);

    // Verify Dates
    expect(screen.getByText("05-08-2026")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();

    // Verify Account Details
    expect(screen.getByText("4210.000 - HPP Pembelian - PZTS")).toBeInTheDocument();
    expect(screen.getByText("1141.000 - Persediaan Barang - PZTS")).toBeInTheDocument();

    // Verify Transaction Details (voucher_type and voucher_subtype)
    expect(screen.getAllByText("Delivery Note").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("MAT-DN-2026-00001")).toBeInTheDocument();

    // Verify Dimensions
    expect(screen.getByText("Main - PZTS")).toBeInTheDocument();

    // Verify More Info
    expect(screen.getByText("PT ZENIT TECHNOLOGY SOLUTION")).toBeInTheDocument();
    expect(screen.getByText("On cancellation of MAT-DN-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("At")).toBeInTheDocument();
  });

  it("renders new GL Entry form and submits payload", async () => {
    (glEntryApi.create as any).mockResolvedValue({
      ...mockGLEntry82808c1ee5,
      id: "newhex1234",
    });

    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/desk/gl-entry/new"]}>
          <Routes>
            <Route path="/desk/gl-entry/:id" element={<GLEntryFormPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    );

    const newBadges = await screen.findAllByText(/New/i);
    expect(newBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(glEntryApi.create).toHaveBeenCalled();
    });
  });
});
