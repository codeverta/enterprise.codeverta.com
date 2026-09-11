import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountSetupPage from "./AccountSetupPage";

const mocks = vi.hoisted(() => ({
  companies: vi.fn(),
  currencies: vi.fn(),
  options: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../accountApi", () => ({ accountApi: mocks }));

const accounts = [
  { id: "asset", company_id: "company-1", parent_account_id: null, account_name: "Aktiva", account_number: "1000.000", is_group: true, account_type: "Current Asset", account_category: "", account_currency: "IDR", balance: 0, disabled: false },
  { id: "cash", company_id: "company-1", parent_account_id: "asset", account_name: "Kas", account_number: "1110.000", is_group: true, account_type: "Cash", account_category: "", account_currency: "IDR", balance: 0, disabled: false },
  { id: "petty", company_id: "company-1", parent_account_id: "cash", account_name: "Kas Kecil", account_number: "1111.001", is_group: false, account_type: "Cash", account_category: "", account_currency: "IDR", balance: 125000, disabled: false },
];

describe("AccountSetupPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    mocks.companies.mockResolvedValue([{ id: "company-1", name: "PT ZENIT TECHNOLOGY SOLUTION", abbreviation: "PZTS", currency: "IDR" }]);
    mocks.currencies.mockResolvedValue(["IDR", "USD"]);
    mocks.options.mockResolvedValue({ account_types: ["Bank", "Cash", "Current Asset"], account_categories: ["Balance Sheet"] });
    mocks.list.mockResolvedValue(accounts);
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.remove.mockResolvedValue(undefined);
  });

  it("renders a company-scoped tree with nested accounts and balances", async () => {
    render(<MemoryRouter><AccountSetupPage /></MemoryRouter>);

    expect((await screen.findAllByText("PT ZENIT TECHNOLOGY SOLUTION")).length).toBeGreaterThan(0);
    expect(await screen.findByTestId("account-1000.000")).toBeInTheDocument();
    expect(screen.getByTestId("account-1110.000")).toBeInTheDocument();
    expect(screen.getByTestId("account-1111.001")).toHaveTextContent("Kas Kecil");
    expect(screen.getByTestId("account-1111.001")).toHaveTextContent("Rp");
    expect(mocks.list).toHaveBeenCalledWith("company-1");
  });

  it("creates a child account under the selected group", async () => {
    render(<MemoryRouter><AccountSetupPage /></MemoryRouter>);
    const cashRow = await screen.findByTestId("account-1110.000");

    fireEvent.click(within(cashRow).getByTitle("Tambah child account"));

    const dialog = await screen.findByRole("dialog", { name: "New Account" });
    fireEvent.change(within(dialog).getByLabelText(/New Account Name/), { target: { value: "Kas Event" } });
    fireEvent.change(within(dialog).getByLabelText(/Account Number/), { target: { value: "1110.001" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      company_id: "company-1",
      parent_account_id: "cash",
      account_name: "Kas Event",
      account_number: "1110.001",
      account_currency: "IDR",
    })));
  });
});
