import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import PricingRulePage from "./PricingRulePage";
import { pricingRuleApi } from "../pricingRuleApi";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

vi.mock("../pricingRuleApi", () => ({
  pricingRuleApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listItems: vi.fn(),
    listItemGroups: vi.fn(),
    listPriceLists: vi.fn(),
    listWarehouses: vi.fn(),
    listCompanies: vi.fn(),
    listCurrencies: vi.fn(),
    listUOMs: vi.fn(),
  },
}));

describe("PricingRulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (pricingRuleApi.listItems as any).mockResolvedValue([
      { item_code: "ITEM-01", item_name: "Test Item", stock_uom: "Nos" },
    ]);
    (pricingRuleApi.listItemGroups as any).mockResolvedValue([
      { id: "1", item_group_name: "Products" },
    ]);
    (pricingRuleApi.listPriceLists as any).mockResolvedValue([
      { id: "1", price_list_name: "Standard Selling" },
    ]);
    (pricingRuleApi.listWarehouses as any).mockResolvedValue([
      { id: "1", warehouse_name: "Main Warehouse" },
    ]);
    (pricingRuleApi.listCompanies as any).mockResolvedValue([
      { id: "1", company_name: "Codeverta Enterprise" },
    ]);
    (pricingRuleApi.listCurrencies as any).mockResolvedValue([
      { code: "IDR", name: "Indonesian Rupiah" },
    ]);
    (pricingRuleApi.listUOMs as any).mockResolvedValue([
      { id: "1", uom_name: "Nos" },
    ]);
  });

  it("renders list view and displays existing pricing rules", async () => {
    (pricingRuleApi.list as any).mockResolvedValue([
      {
        id: "PRLE-0001",
        title: "Summer Promo 10%",
        apply_on: "Item Code",
        applicable_for: "Customer",
        party: "All",
        rate_or_discount: "Discount Percentage",
        discount_percentage: 10,
        disable: false,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/desk/pricing-rule"]}>
        <PricingRulePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Pricing Rule")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Summer Promo 10%")).toBeInTheDocument();
      expect(screen.getByText("PRLE-0001")).toBeInTheDocument();
    });
  });

  it("renders form view for new pricing rule with all tabs and fields", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/pricing-rule/new"]}>
        <PricingRulePage />
      </MemoryRouter>
    );

    expect(screen.getByText("New Pricing Rule")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Dynamic Condition")).toBeInTheDocument();
    expect(screen.getByText("Advanced Settings")).toBeInTheDocument();
    expect(screen.getByText("Help Article")).toBeInTheDocument();

    // Check tabs switching
    fireEvent.click(screen.getByText("Help Article"));
    expect(screen.getByText(/Help Article: How Pricing Rule Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Priority Resolution/i)).toBeInTheDocument();
  });
});
