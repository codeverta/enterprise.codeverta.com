import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseInvoiceFormPage from "./PurchaseInvoiceFormPage";

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

describe("PurchaseInvoiceFormPage API Integration", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();
  });

  const mockApis = () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/purchase-invoices/options") {
        return Promise.resolve({
          data: {
            companies: ["PT Toko Demo"],
            suppliers: ["PT Supplier Utama"],
            warehouses: ["Gudang Bahan Baku"],
            items: ["RAW-001"],
            cost_centers: ["Main - TD"],
            projects: ["Project Alfa"],
            currencies: ["IDR", "USD"],
            price_lists: ["Standard Buying"],
            uoms: ["Unit", "Pcs", "Kg"],
            modes_of_payment: ["Cash", "Bank Transfer"],
            accounts: ["BCA Operasional"],
            tax_categories: ["Default Tax", "PPN 11%"],
            shipping_rules: ["Standard Delivery"],
            taxes_and_charges: ["PPN 11%"],
            payment_terms_templates: ["Net 30"],
            incoterms: ["FOB - Free on Board"],
          },
        });
      }
      if (url === "/buying/suppliers") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "supp-1",
                supplier_name: "PT Supplier Utama",
                supplier_type: "Company",
                supplier_group: "Raw Material",
                default_currency: "IDR",
                default_price_list: "Standard Buying",
                supplier_address: "Jl. Industri No. 10",
                contact_person: "Budi",
                contact_email: "budi@supplier.com",
                contact_phone: "08123456789",
              },
            ],
          },
        });
      }
      if (url === "/buying/items") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "it-1",
                item_code: "RAW-001",
                item_name: "Bahan Baku A",
                stock_uom: "Kg",
                purchase_uom: "Kg",
                standard_rate: 75000,
                description: "Bahan Baku Kualitas Super",
              },
            ],
          },
        });
      }
      if (url === "/selling/price-lists") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "pl-1",
                price_list_name: "Standard Buying",
                currency: "IDR",
                buying: true,
                selling: false,
                enabled: true,
              },
            ],
          },
        });
      }
      if (url === "/selling/tax-categories") {
        return Promise.resolve({
          data: {
            data: [
              { id: "tc-1", title: "PPN 11%", disabled: false },
              { id: "tc-2", title: "Tax Exempt", disabled: false },
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
      if (url === "/stock/warehouses") {
        return Promise.resolve({
          data: {
            data: [
              { id: "wh-1", warehouse_name: "Gudang Bahan Baku", company: "PT Toko Demo" },
            ],
          },
        });
      }
      if (url === "/accounting/bank-accounts") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "ba-1",
                account_name: "BCA Operasional",
                bank: "BCA",
                bank_account_no: "123456789",
                is_company_account: true,
                is_default: true,
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
                item_code: "RAW-001",
                price_list: "Standard Buying",
                price_list_rate: 72000,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  };

  it("fetches options, suppliers, items, price lists, tax categories from APIs and does not render field name subtitle texts", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/purchase-invoice/new"]}>
        <Routes>
          <Route path="/desk/purchase-invoice/new" element={<PurchaseInvoiceFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/buying/purchase-invoices/options");
      expect(apiGet).toHaveBeenCalledWith("/buying/suppliers", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/buying/items", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/selling/price-lists");
      expect(apiGet).toHaveBeenCalledWith("/selling/tax-categories", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/currencies", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/stock/warehouses", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/accounting/bank-accounts", expect.anything());
    });

    // Check title
    expect(screen.getByText("New Purchase Invoice")).toBeInTheDocument();

    // Verify that field key names (naming_series, due_date, posting_date, bill_no) are NOT rendered as subtitle text
    expect(screen.queryByText("naming_series")).not.toBeInTheDocument();
    expect(screen.queryByText("posting_date")).not.toBeInTheDocument();
    expect(screen.queryByText("due_date")).not.toBeInTheDocument();
    expect(screen.queryByText("bill_no")).not.toBeInTheDocument();
  });

  it("auto-populates item rate and details from API when selecting an item", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/purchase-invoice/new"]}>
        <Routes>
          <Route path="/desk/purchase-invoice/new" element={<PurchaseInvoiceFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("New Purchase Invoice")).toBeInTheDocument();
    });

    // Open item select dropdown
    const itemSelectTrigger = screen.getByRole("button", { name: /Pilih Item/i });
    fireEvent.click(itemSelectTrigger);

    // Click RAW-001 item option
    await waitFor(() => {
      expect(screen.getByText(/RAW-001 - Bahan Baku A/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/RAW-001 - Bahan Baku A/i));

    // Verify rate is updated from API (item-price 72,000 or standard_rate 75,000)
    await waitFor(() => {
      const rateInput = screen.getByDisplayValue("72000");
      expect(rateInput).toBeInTheDocument();
    });
  });

  it("supports adding and removing item and tax rows in DataTable", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/purchase-invoice/new"]}>
        <Routes>
          <Route path="/desk/purchase-invoice/new" element={<PurchaseInvoiceFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("New Purchase Invoice")).toBeInTheDocument();
    });

    expect(screen.getByRole("columnheader", { name: "Item" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Add / Deduct" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Pilih Item/i })).toHaveLength(1);

    const addRowButtons = screen.getAllByRole("button", { name: /Add Row/i });
    await act(async () => {
      fireEvent.click(addRowButtons[0]);
    });
    expect(screen.getAllByRole("button", { name: /Pilih Item/i })).toHaveLength(2);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hapus item baris 2" }));
    });
    expect(screen.getAllByRole("button", { name: /Pilih Item/i })).toHaveLength(1);

    await act(async () => {
      fireEvent.click(addRowButtons[1]);
    });
    expect(screen.getByRole("button", { name: "Hapus pajak baris 1" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hapus pajak baris 1" }));
    });
    expect(screen.queryByRole("button", { name: "Hapus pajak baris 1" })).not.toBeInTheDocument();
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });
});
