import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import POSOpeningEntryPage from "./POSOpeningEntryPage";

const { listOpenings } = vi.hoisted(() => ({ listOpenings: vi.fn() }));

vi.mock("../posApi", () => ({
  isOpeningOutdated: () => false,
  posApi: {
    listOpenings,
    closeOpening: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("POSOpeningEntryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOpenings.mockResolvedValue([
      {
        id: "POS-OPEN-001",
        period_start_date: "2026-09-12T01:00:00.000Z",
        posting_date: "2026-09-12",
        company: "Company A",
        pos_profile: "Kasir Utama",
        user: "Administrator",
        status: "Closed",
        opening_balance_total: 150000,
        balance_details: [{ mode_of_payment: "Cash", opening_amount: 150000 }],
      },
      {
        id: "POS-OPEN-002",
        period_start_date: "2026-09-12T02:00:00.000Z",
        posting_date: "2026-09-12",
        company: "Company A",
        pos_profile: "Kasir Cabang",
        user: "Kasir 2",
        status: "Closed",
        opening_balance_total: 50000,
        balance_details: [],
      },
    ]);
  });

  it("uses the reusable searchable table and opens a selected entry", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/pos-opening-entry"]}>
        <Routes>
          <Route path="/desk/pos-opening-entry" element={<POSOpeningEntryPage />} />
          <Route path="/desk/pos-opening-entry/:id" element={<div>Opening detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("POS-OPEN-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort table" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search table" }), {
      target: { value: "Kasir Cabang" },
    });
    expect(screen.queryByText("POS-OPEN-001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("POS-OPEN-002"));

    await waitFor(() => expect(screen.getByText("Opening detail")).toBeInTheDocument());
  });
});
