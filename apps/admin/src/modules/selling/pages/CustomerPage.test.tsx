import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerPage from "./CustomerPage";

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

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  apiDelete.mockReset();
});

const mockCustomerApis = () => {
  apiGet.mockImplementation((url: string) => {
    if (url === "/selling/customers") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "cust-1",
              customer_name: "PT Mitra Perkasa Abadi",
              customer_type: "Company",
              customer_group: "Commercial",
              territory: "Indonesia",
              email: "finance@mitraperkasa.co.id",
              phone: "021-5551234",
              mobile_no: "081234567890",
              default_currency: "IDR",
              disabled: false,
            },
          ],
        },
      });
    }

    if (url === "/selling/customer-groups") {
      return Promise.resolve({
        data: {
          data: [
            { id: "cg-1", group_name: "Commercial", parent_group: "All Customer Groups" },
            { id: "cg-2", group_name: "Government", parent_group: "All Customer Groups" },
            { id: "cg-3", group_name: "Individual", parent_group: "All Customer Groups" },
          ],
        },
      });
    }

    if (url === "/selling/territories") {
      return Promise.resolve({
        data: {
          data: [
            { id: "t-1", territory_name: "DKI Jakarta", parent_territory: "Indonesia" },
            { id: "t-2", territory_name: "Jawa Barat", parent_territory: "Indonesia" },
          ],
        },
      });
    }

    if (url === "/currencies") {
      return Promise.resolve({
        data: {
          data: [
            { id: "IDR", currency_name: "Indonesian Rupiah", symbol: "Rp", enabled: true },
            { id: "USD", currency_name: "US Dollar", symbol: "$", enabled: true },
            { id: "SGD", currency_name: "Singapore Dollar", symbol: "S$", enabled: true },
          ],
        },
      });
    }

    return Promise.resolve({ data: {} });
  });
};

describe("Customer Module - CustomerListPage and CustomerFormPage", () => {
  it("renders customer list with data loaded from API", async () => {
    mockCustomerApis();

    render(
      <MemoryRouter initialEntries={["/desk/customer"]}>
        <Routes>
          <Route path="/desk/customer" element={<CustomerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("PT Mitra Perkasa Abadi")).toBeInTheDocument();
    });

    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText("finance@mitraperkasa.co.id")).toBeInTheDocument();
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });

  it("renders new Customer form, fetches customer groups, territories, and currencies, and submits", async () => {
    mockCustomerApis();
    apiPost.mockResolvedValueOnce({
      data: {
        id: "cust-new-99",
        customer_name: "PT Solusi Prima Nusantara",
        customer_type: "Company",
        customer_group: "Commercial",
        territory: "DKI Jakarta",
        email: "contact@solusiprima.id",
        default_currency: "USD",
        default_price_list: "Standard Selling",
        disabled: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/customer/new"]}>
        <Routes>
          <Route path="/desk/customer/new" element={<CustomerPage />} />
          <Route path="/desk/customer/:id" element={<CustomerPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify form header and tabs
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "New Customer" })).toBeInTheDocument();
      expect(screen.getByText("Detail Customer")).toBeInTheDocument();
      expect(screen.getByText("Kontak & Alamat")).toBeInTheDocument();
      expect(screen.getByText("Billing & Akuntansi")).toBeInTheDocument();
      expect(screen.getByText("Catatan & Status")).toBeInTheDocument();
    });

    // Fill customer name
    const nameInput = screen.getByPlaceholderText("Contoh: PT Sumber Berkah / Budi Santoso");
    fireEvent.change(nameInput, { target: { value: "PT Solusi Prima Nusantara" } });

    // Open Billing tab to check currency searchable select
    const billingTab = screen.getByText("Billing & Akuntansi");
    fireEvent.click(billingTab);

    // Verify billing currency SearchableSelect
    await waitFor(() => {
      expect(screen.getByText("Billing Currency")).toBeInTheDocument();
      expect(screen.getByText("Default Price List")).toBeInTheDocument();
      expect(screen.getByText("Credit Limit (Batas Kredit)")).toBeInTheDocument();
    });

    // Switch to Contact tab and fill email
    const contactTab = screen.getByText("Kontak & Alamat");
    fireEvent.click(contactTab);

    const emailInput = screen.getByPlaceholderText("customer@perusahaan.com");
    fireEvent.change(emailInput, { target: { value: "contact@solusiprima.id" } });

    // Click Simpan Customer
    const saveButton = screen.getAllByRole("button", { name: /Simpan Customer/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/customers",
        expect.objectContaining({
          customer_name: "PT Solusi Prima Nusantara",
          email: "contact@solusiprima.id",
        })
      );
    });
  });

  it("validates invalid email format and blocks submission", async () => {
    mockCustomerApis();

    render(
      <MemoryRouter initialEntries={["/desk/customer/new"]}>
        <Routes>
          <Route path="/desk/customer/new" element={<CustomerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "New Customer" })).toBeInTheDocument();
    });

    // Fill name
    const nameInput = screen.getByPlaceholderText("Contoh: PT Sumber Berkah / Budi Santoso");
    fireEvent.change(nameInput, { target: { value: "Customer Invalid Email" } });

    // Go to contact tab and fill wrong email
    fireEvent.click(screen.getByText("Kontak & Alamat"));
    const emailInput = screen.getByPlaceholderText("customer@perusahaan.com");
    fireEvent.change(emailInput, { target: { value: "bukan-email-valid" } });

    // Submit
    const saveButton = screen.getAllByRole("button", { name: /Simpan Customer/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Format email tidak valid/i)).toBeInTheDocument();
    });

    expect(apiPost).not.toHaveBeenCalled();
  });
});
