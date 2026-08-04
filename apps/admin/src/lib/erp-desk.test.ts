import { describe, expect, it } from "vitest";
import { accountingMenus, getAuthenticatedLandingPath, hrSubmodules, isAdminRole } from "./erp-desk";

describe("ERP desk navigation", () => {
  it("sends admin and superadmin accounts to the desk", () => {
    expect(isAdminRole(99)).toBe(true);
    expect(isAdminRole(100)).toBe(true);
    expect(getAuthenticatedLandingPath({ role: 99 })).toBe("/desk");
  });

  it("keeps non-admin accounts on their dashboard", () => {
    expect(isAdminRole(20)).toBe(false);
    expect(getAuthenticatedLandingPath({ role: 20 })).toBe("/dashboard");
  });

  it("exposes the complete Accounting menu", () => {
    expect(accountingMenus.map((item) => item.name)).toEqual([
      "Invoicing",
      "Payments",
      "Financial Reports",
      "Accounts Setup",
      "Taxes",
      "Banking",
      "Budget",
      "Share Management",
      "Subscription",
    ]);
  });

  it("exposes the complete HR submodules", () => {
    expect(hrSubmodules.map((item) => item.name)).toEqual([
      "Expenses",
      "Performance",
      "Tenure",
      "HR Setup",
      "Recruitment",
      "Leaves",
      "Shift & Attendance",
      "Payroll",
      "Tax & Benefits",
    ]);
  });
});


