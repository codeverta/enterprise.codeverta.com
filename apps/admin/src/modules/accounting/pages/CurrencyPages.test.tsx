import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CurrencyListPage from "./CurrencyListPage";
import CurrencyFormPage from "./CurrencyFormPage";
import { currencyApi } from "../currencyApi";

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

const mockCurrencies = [
  {
    id: "IDR",
    currency_name: "Indonesian Rupiah",
    enabled: true,
    fraction: "Sen",
    fraction_units: 100,
    smallest_currency_fraction_value: 100,
    symbol: "Rp",
    symbol_on_right: false,
    number_format: "#.###,##",
  },
  {
    id: "USD",
    currency_name: "US Dollar",
    enabled: true,
    fraction: "Cent",
    fraction_units: 100,
    smallest_currency_fraction_value: 0.01,
    symbol: "$",
    symbol_on_right: false,
    number_format: "#,###.##",
  },
];

describe("Currency Module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    apiGet.mockImplementation((url: string) => {
      if (url === "/currencies") {
        return Promise.resolve({ data: { data: mockCurrencies } });
      }
      if (url.startsWith("/currencies/")) {
        return Promise.resolve({ data: mockCurrencies[0] });
      }
      return Promise.reject(new Error(`Unhandled GET: ${url}`));
    });
  });

  it("renders CurrencyListPage and shows currency records", async () => {
    vi.spyOn(currencyApi, "list").mockResolvedValue(mockCurrencies);

    render(
      <MemoryRouter initialEntries={["/desk/currency"]}>
        <Routes>
          <Route path="/desk/currency" element={<CurrencyListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(currencyApi.list).toHaveBeenCalled();
    });

    expect(await screen.findByText("IDR")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getAllByText("Rp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$").length).toBeGreaterThanOrEqual(1);
  });

  it("renders CurrencyFormPage for new currency and creates record", async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        id: "EUR",
        currency_name: "Euro",
        enabled: true,
        fraction: "Cent",
        fraction_units: 100,
        smallest_currency_fraction_value: 0.01,
        symbol: "€",
        symbol_on_right: false,
        number_format: "#.###,##",
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/currency/new"]}>
        <Routes>
          <Route path="/desk/currency/new" element={<CurrencyFormPage />} />
          <Route path="/desk/currency/:id" element={<CurrencyFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "New Currency" })).toBeInTheDocument();

    // Fill in ID and Symbol
    const idInput = screen.getByPlaceholderText("IDR");
    fireEvent.change(idInput, { target: { value: "EUR" } });

    const symbolInput = screen.getByPlaceholderText("Rp");
    fireEvent.change(symbolInput, { target: { value: "€" } });

    // Submit
    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/currencies",
        expect.objectContaining({
          id: "EUR",
          symbol: "€",
          enabled: true,
        }),
      );
    });
  });

  it("renders CurrencyFormPage for existing currency and updates record", async () => {
    apiPut.mockResolvedValueOnce({
      data: { ...mockCurrencies[0], fraction: "Sen-Updated" },
    });

    render(
      <MemoryRouter initialEntries={["/desk/currency/IDR"]}>
        <Routes>
          <Route path="/desk/currency/:id" element={<CurrencyFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IDR" })).toBeInTheDocument();
    });

    const fractionInput = screen.getByPlaceholderText("Sen");
    fireEvent.change(fractionInput, { target: { value: "Sen-Updated" } });

    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/currencies/IDR",
        expect.objectContaining({
          id: "IDR",
          fraction: "Sen-Updated",
        }),
      );
    });
  });

  it("dynamically loads supplier groups, countries, and currencies on SupplierFormPage", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/master/options") {
        return Promise.resolve({
          data: {
            supplier_groups: [],
            countries: [],
            currencies: [],
            price_lists: ["Standard Buying"],
            languages: ["English"],
          },
        });
      }
      if (url === "/buying/supplier-groups") {
        return Promise.resolve({
          data: {
            data: [
              { id: "g-1", group_name: "Hardware Electronics", is_group: false },
            ],
          },
        });
      }
      if (url === "/currencies") {
        return Promise.resolve({
          data: {
            data: [
              { id: "SGD", currency_name: "Singapore Dollar", enabled: true, symbol: "S$" },
            ],
          },
        });
      }
      if (url === "/countries") {
        return Promise.resolve({
          data: {
            data: [
              { id: "Singapore", country_name: "Singapore", code: "sg" },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unhandled GET: ${url}`));
    });

    const { default: SupplierFormPage } = await import("@/modules/buying/pages/SupplierFormPage");

    render(
      <MemoryRouter initialEntries={["/desk/supplier/new"]}>
        <Routes>
          <Route path="/desk/supplier/new" element={<SupplierFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/buying/supplier-groups");
      expect(apiGet).toHaveBeenCalledWith("/currencies", expect.anything());
      expect(apiGet).toHaveBeenCalledWith("/countries", expect.anything());
    });
  });
});
