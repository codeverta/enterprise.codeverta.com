import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupplierFormPage from "./SupplierFormPage";

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

describe("SupplierFormPage API Integration", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();
  });

  const mockApis = () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/master/options") {
        return Promise.resolve({
          data: {
            supplier_groups: ["All Supplier Groups", "Local", "Distributor"],
            countries: ["Indonesia", "Singapore", "Malaysia"],
            currencies: ["IDR", "USD"],
            price_lists: ["Standard Buying"],
            languages: ["English", "Bahasa Indonesia"],
          },
        });
      }
      if (url === "/buying/supplier-groups") {
        return Promise.resolve({
          data: {
            data: [
              { id: "sg-1", group_name: "Raw Material", parent_group: "All Supplier Groups" },
              { id: "sg-2", group_name: "Distributor Utama", parent_group: "All Supplier Groups" },
            ],
          },
        });
      }
      if (url === "/countries") {
        return Promise.resolve({
          data: {
            data: [
              { id: "ID", country_name: "Indonesia", code: "ID" },
              { id: "SG", country_name: "Singapore", code: "SG" },
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
      if (url === "/accounting/bank-accounts") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "ba-1",
                account_name: "BCA Operasional PT",
                bank: "BCA",
                bank_account_no: "1234567890",
                is_company_account: true,
                is_default: true,
                disabled: false,
              },
              {
                id: "ba-2",
                account_name: "Mandiri Giro Perusahaan",
                bank: "Bank Mandiri",
                bank_account_no: "9876543210",
                is_company_account: true,
                is_default: false,
                disabled: false,
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
              {
                id: "pl-2",
                price_list_name: "Supplier VIP Buying",
                currency: "IDR",
                buying: true,
                selling: false,
                enabled: true,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  };

  it("fetches supplier groups, country, currency, bank accounts, and price lists from API and auto-selects defaults", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/supplier/new"]}>
        <Routes>
          <Route path="/desk/supplier/new" element={<SupplierFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify all APIs were called
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/buying/supplier-groups");
      expect(apiGet).toHaveBeenCalledWith("/countries", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/currencies", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/accounting/bank-accounts", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/selling/price-lists");
    });

    // Check pre-selected default company bank account
    await waitFor(() => {
      expect(screen.getByText("BCA Operasional PT")).toBeInTheDocument();
    });

    // Check pre-selected price list
    expect(screen.getByText("Standard Buying")).toBeInTheDocument();

    // Verify header title
    expect(screen.getByText("New Supplier")).toBeInTheDocument();
  });

  it("submits the form with chosen API values", async () => {
    mockApis();
    apiPost.mockResolvedValueOnce({
      data: {
        id: "supp-new-123",
        supplier_name: "PT Sumber Rejeki Abadi",
        supplier_type: "Company",
        supplier_group: "Raw Material",
        country: "Indonesia",
        default_currency: "IDR",
        default_bank_account: "BCA Operasional PT",
        default_price_list: "Standard Buying",
        disabled: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/supplier/new"]}>
        <Routes>
          <Route path="/desk/supplier/new" element={<SupplierFormPage />} />
          <Route path="/desk/supplier/:id" element={<div data-testid="detail-page">Supplier Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("BCA Operasional PT")).toBeInTheDocument();
    });

    // Input Supplier Name
    const nameInput = screen.getByPlaceholderText("Masukkan nama supplier");
    fireEvent.change(nameInput, { target: { value: "PT Sumber Rejeki Abadi" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/buying/suppliers",
        expect.objectContaining({
          supplier_name: "PT Sumber Rejeki Abadi",
          default_bank_account: "BCA Operasional PT",
          default_price_list: "Standard Buying",
        })
      );
    });
  });

  it("shows redirect link to create new bank account when no company bank accounts exist", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/accounting/bank-accounts") {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/supplier/new"]}>
        <Routes>
          <Route path="/desk/supplier/new" element={<SupplierFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Belum ada rekening bank/i)).toBeInTheDocument();
    });

    const createLink = screen.getAllByRole("link", { name: /Buat Bank Account Baru/i });
    expect(createLink.length).toBeGreaterThan(0);
    expect(createLink[0]).toHaveAttribute("href", "/desk/bank-account/new-bank-account");
  });
});
