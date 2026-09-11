import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuotationPage from "./QuotationPage";
import TaxCategoryPage from "./TaxCategoryPage";

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

const mockApis = () => {
  apiGet.mockImplementation((url: string) => {
    if (url === "/selling/customers") {
      return Promise.resolve({
        data: {
          data: [
            { id: "c-1", customer_name: "Rabih Utomo", email: "rabih@example.com" },
            { id: "c-2", customer_name: "Codeverta Enterprise", email: "corp@codeverta.com" },
          ],
        },
      });
    }
    if (url === "/selling/pos/items" || url.includes("/selling/point-of-sale/items")) {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "item-1",
              item_code: "LILIN-01",
              item_name: "Lilin Mati Lampu Sedang",
              rate: 15000,
              stock: 100,
              unit: "Nos",
            },
            {
              id: "item-2",
              item_code: "LILIN-02",
              item_name: "Lilin Aromaterapi",
              rate: 25000,
              stock: 50,
              unit: "Nos",
            },
          ],
        },
      });
    }
    if (url === "/selling/tax-categories") {
      return Promise.resolve({
        data: {
          data: [
            { id: "tc-1", title: "In State", disabled: false },
            { id: "tc-2", title: "Out of State", disabled: false },
            { id: "tc-3", title: "Export", disabled: false },
          ],
        },
      });
    }
    if (url === "/stock/warehouses/companies") {
      return Promise.resolve({
        data: {
          data: [
            { company_name: "PT ZENIT TECHNOLOGY SOLUTION" },
          ],
        },
      });
    }
    if (url === "/selling/quotations") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "q-1",
              quotation_number: "SAL-QTN-2026-00001",
              party_name: "Rabih Utomo",
              transaction_date: "2026-09-10",
              valid_till: "2026-10-10",
              grand_total: 15000,
              status: "Draft",
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });
};

describe("QuotationPage", () => {
  it("renders Quotation list page with saved quotations", async () => {
    mockApis();

    render(
      <MemoryRouter initialEntries={["/desk/quotation"]}>
        <Routes>
          <Route path="/desk/quotation" element={<QuotationPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("SAL-QTN-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Rabih Utomo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Quotation/i })).toBeInTheDocument();
  });

  it("renders new Quotation form, uses SearchableSelect for customer, items, and tax category, and auto-calculates amount", async () => {
    mockApis();
    apiPost.mockImplementation((url: string, data: any) => {
      if (url === "/selling/quotations") {
        return Promise.resolve({
          data: {
            data: {
              ...data,
              id: "q-new-123",
              quotation_number: "SAL-QTN-2026-00002",
            },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/quotation/new"]}>
        <Routes>
          <Route path="/desk/quotation/new" element={<QuotationPage />} />
          <Route path="/desk/quotation/:id" element={<QuotationPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify Title and Tabs
    expect(await screen.findByRole("heading", { name: "New Quotation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Address & Contact" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Terms" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "More Info" })).toBeInTheDocument();

    // 1. Customer SearchableSelect
    const customerTriggers = screen.getAllByRole("button", { name: /Begin typing for results\./i });
    expect(customerTriggers.length).toBeGreaterThanOrEqual(1);

    // Click customer dropdown (the first one)
    fireEvent.click(customerTriggers[0]);
    const rabihOption = await screen.findByRole("button", { name: /Rabih Utomo/i });
    fireEvent.click(rabihOption);
    expect(screen.getByText("Rabih Utomo")).toBeInTheDocument();

    // 2. Item Code SearchableSelect
    const itemTrigger = screen.getByRole("button", { name: /Pilih item code\.\.\./i });
    fireEvent.click(itemTrigger);
    const itemOption = await screen.findByRole("button", { name: /LILIN-01/i });
    fireEvent.click(itemOption);

    // Verify item name and rate are filled and amount is calculated
    expect(screen.getByText("Lilin Mati Lampu Sedang")).toBeInTheDocument();
    // Default quantity is 1, rate is 15000 -> amount Rp 15.000
    expect(screen.getAllByText(/15\.000/i).length).toBeGreaterThanOrEqual(1);

    // 3. Tax Category SearchableSelect
    const taxCatTrigger = screen.getByRole("button", { name: /Begin typing for results\./i });
    fireEvent.click(taxCatTrigger);
    const taxOption = await screen.findByRole("button", { name: /In State/i });
    fireEvent.click(taxOption);
    expect(screen.getByText("In State")).toBeInTheDocument();

    // 4. Test changing quantity
    const qtyInput = screen.getByDisplayValue("1");
    fireEvent.change(qtyInput, { target: { value: "3" } });

    // Amount should update: 3 * 15000 = 45000
    expect(screen.getAllByText(/45\.000/i).length).toBeGreaterThanOrEqual(1);

    // 5. Test Save button
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/quotations",
        expect.objectContaining({
          party_name: "Rabih Utomo",
          tax_category: "In State",
          total_qty: 3,
          total: 45000,
          grand_total: 45000,
        })
      );
    });
  });
});

describe("TaxCategoryPage", () => {
  it("creates and saves new Tax Category", async () => {
    mockApis();
    apiPost.mockImplementation((url: string, data: any) => {
      if (url === "/selling/tax-categories") {
        return Promise.resolve({
          data: {
            data: {
              ...data,
              id: "tc-new-99",
            },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/tax-category/new"]}>
        <Routes>
          <Route path="/desk/tax-category/new" element={<TaxCategoryPage />} />
          <Route path="/desk/tax-category/:id" element={<TaxCategoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "New Tax Category" })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("e.g. In State, Out of State, Export");
    fireEvent.change(titleInput, { target: { value: "Special Export" } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/tax-categories",
        expect.objectContaining({
          title: "Special Export",
          disabled: false,
        })
      );
    });
  });
});
