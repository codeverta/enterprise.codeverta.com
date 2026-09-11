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
    expect(flattenWorkspaceNavigation(erpWorkspaces.selling).map((item) => item.name)).toContain("Sales Register");
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

  it("contains Subscription workspace with Subscription and Setup groups", () => {
    expect(erpWorkspaces.subscription).toBeDefined();
    const subWs = erpWorkspaces.subscription;
    expect(subWs.name).toBe("Subscription");
    expect(subWs.slug).toBe("subscription");

    const groupNames = subWs.navigation.filter((item) => item.items?.length).map((g) => g.name);
    expect(groupNames).toEqual(["Subscription", "Setup"]);

    const subGroup = subWs.navigation.find((g) => g.name === "Subscription");
    expect(subGroup?.items?.map((item) => ({ name: item.name, href: item.href }))).toEqual([
      { name: "Subscription", href: "/desk/subscription" },
      { name: "Subscription Plan", href: "/desk/subscription-plan" },
      { name: "Subscription Settings", href: "/desk/subscription-settings/Subscription%20Settings" },
    ]);

    const setupGroup = subWs.navigation.find((g) => g.name === "Setup");
    expect(setupGroup?.items?.map((item) => ({ name: item.name, href: item.href }))).toEqual([
      { name: "Customer", href: "/desk/customer" },
      { name: "Supplier", href: "/desk/supplier" },
      { name: "Item", href: "/desk/item" },
    ]);

    expect(getWorkspaceFromPath("/desk/subscription")?.slug).toBe("subscription");
    expect(getWorkspaceFromPath("/desk/subscription", "Subscription")?.slug).toBe("subscription");
    expect(getWorkspaceFromPath("/desk/subscription-plan")?.slug).toBe("subscription");
    expect(getWorkspaceFromPath("/desk/subscription-settings/Subscription%20Settings")?.slug).toBe("subscription");
  });
});

