import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionalAnalyticsReport, type AnalyticsReportRow } from "./TransactionalAnalyticsReport";

const row: AnalyticsReportRow = { id: "1", date: new Date().toISOString().slice(0, 10), voucher: "DOC-001", party: "PT Supplier", company: "Company A", itemCode: "ITEM-001", itemName: "Item Test", quantity: 2, rate: 1000, amount: 2000 };

describe("TransactionalAnalyticsReport", () => {
  it("reuses the same report UI for configurable customer or supplier reports", () => {
    render(<TransactionalAnalyticsReport moduleLabel="Buying" title="Purchase Analytics" description="Purchase report" partyLabel="Supplier" rows={[row]} onRefresh={vi.fn()} />);
    expect(screen.getByText("Buying / Reports")).toBeInTheDocument();
    expect(screen.getByText("Purchase Analytics")).toBeInTheDocument();
    expect(screen.getAllByText("Supplier").length).toBeGreaterThan(0);
    expect(screen.getByText("ITEM-001")).toBeInTheDocument();
    expect(screen.getByText("PT Supplier")).toBeInTheDocument();
  });
});
