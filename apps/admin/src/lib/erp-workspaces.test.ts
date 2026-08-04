import { describe, expect, it } from "vitest";
import { erpWorkspaces, flattenWorkspaceNavigation, getWorkspaceFromPath } from "./erp-workspaces";

describe("ERPNext workspaces", () => {
  it("provides a dashboard workspace for desk modules", () => {
    expect(Object.keys(erpWorkspaces).length).toBeGreaterThanOrEqual(14);
    expect(erpWorkspaces.communication).toBeDefined();
    expect(erpWorkspaces.administration).toBeDefined();
    expect(erpWorkspaces.hr).toBeDefined();
    expect(erpWorkspaces["shift-and-attendance"]).toBeDefined();
    expect(erpWorkspaces.expenses).toBeDefined();
    expect(erpWorkspaces.recruitment).toBeDefined();
    expect(erpWorkspaces["hr-setup"]).toBeDefined();
    expect(erpWorkspaces.payroll).toBeDefined();
    expect(erpWorkspaces.performance).toBeDefined();
    expect(erpWorkspaces.tenure).toBeDefined();
  });

  it("contains the requested Selling, Buying, Stock, and HR navigation", () => {
    expect(flattenWorkspaceNavigation(erpWorkspaces.selling).map((item) => item.name)).toContain("Sales Funnel");
    expect(flattenWorkspaceNavigation(erpWorkspaces.buying).map((item) => item.name)).toContain("Supplier Quotation Comparison");
    expect(flattenWorkspaceNavigation(erpWorkspaces.stock).map((item) => item.name)).toContain("Serial No and Batch Traceability");
    expect(flattenWorkspaceNavigation(erpWorkspaces["shift-and-attendance"]).map((item) => item.name)).toContain("Monthly Attendance Sheet");
    expect(flattenWorkspaceNavigation(erpWorkspaces.expenses).map((item) => item.name)).toContain("Expense Claim");
    expect(flattenWorkspaceNavigation(erpWorkspaces.recruitment).map((item) => item.name)).toContain("Hiring Pipeline");
    expect(flattenWorkspaceNavigation(erpWorkspaces.payroll).map((item) => item.name)).toContain("Salary Slip");
  });

  it("keeps the selected workspace when navigating to a shared ERP route", () => {
    expect(getWorkspaceFromPath("/desk/item", "selling")?.slug).toBe("selling");
    expect(getWorkspaceFromPath("/desk/item", "stock")?.slug).toBe("stock");
  });

  it("uses diverse icons across workspace items", () => {
    const sellingItems = flattenWorkspaceNavigation(erpWorkspaces.selling);
    const icons = new Set(sellingItems.map((item) => item.icon));
    expect(icons.size).toBeGreaterThan(15);
  });
});

