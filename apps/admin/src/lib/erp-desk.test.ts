import { describe, expect, it } from "vitest";
import { accountingMenus, accountingSubmodules, getAuthenticatedLandingPath, hrSubmodules, isAdminRole } from "./erp-desk";

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
      "Faktur & Penagihan",
      "Pembayaran",
      "Laporan Keuangan",
      "Pengaturan Akun (COA)",
      "Pajak & Tarif",
      "Perbankan",
      "Anggaran (Budget)",
      "Manajemen Saham",
      "Langganan",
    ]);
  });

  it("exposes the complete Accounting submodules matching dialog specifications", () => {
    expect(accountingSubmodules.map((item) => ({ name: item.name, href: item.href }))).toEqual([
      { name: "Invoicing", href: "/desk/invoicing?sidebar=Invoicing" },
      { name: "Payments", href: "/desk/dashboard-view/Payments?sidebar=Payments" },
      { name: "Financial Reports", href: "/desk/query-report/Balance%20Sheet" },
      { name: "Accounts Setup", href: "/desk/account?sidebar=Accounts%20Setup" },
      { name: "Taxes", href: "/desk/sales-taxes-and-charges-template?sidebar=Taxes" },
      { name: "Banking", href: "/desk/bank-clearance/Bank%20Clearance?sidebar=Banking" },
      { name: "Budget", href: "/desk/budget?sidebar=Budget" },
      { name: "Share Management", href: "/desk/shareholder?sidebar=Share%20Management" },
      { name: "Subscription", href: "/desk/subscription?sidebar=Subscription" },
    ]);
  });


  it("exposes the complete HR submodules", () => {
    expect(hrSubmodules.map((item) => item.name)).toEqual([
      "Klaim Biaya (Expenses)",
      "Penilaian Kinerja",
      "Masa Kerja & Karyawan",
      "Pengaturan HR",
      "Perekrutan (Recruitment)",
      "Cuti & Izin (Leaves)",
      "Shift & Kehadiran",
      "Penggajian (Payroll)",
      "Pajak & Tunjangan",
    ]);
  });
});

