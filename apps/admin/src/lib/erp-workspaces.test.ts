import { describe, expect, it } from "vitest";
import { erpWorkspaces, flattenWorkspaceNavigation, getWorkspaceFromPath } from "./erp-workspaces";

describe("ERPNext workspaces", () => {
  it("provides a dashboard workspace for every desk module", () => {
    expect(Object.keys(erpWorkspaces)).toHaveLength(12);
  });

  it("contains the requested Selling, Buying, and Stock navigation", () => {
    expect(flattenWorkspaceNavigation(erpWorkspaces.selling).map((item) => item.name)).toContain("Sales Funnel");
    expect(flattenWorkspaceNavigation(erpWorkspaces.buying).map((item) => item.name)).toContain("Supplier Quotation Comparison");
    expect(flattenWorkspaceNavigation(erpWorkspaces.stock).map((item) => item.name)).toContain("Serial No and Batch Traceability");
  });

  it("keeps the selected workspace when navigating to a shared ERP route", () => {
    expect(getWorkspaceFromPath("/desk/item", "selling")?.slug).toBe("selling");
    expect(getWorkspaceFromPath("/desk/item", "stock")?.slug).toBe("stock");
  });
});

