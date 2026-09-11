import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MasterListPage from "./MasterListPage";

const { apiGet, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    delete: apiDelete,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("MasterListPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiDelete.mockReset();
  });

  it("navigates directly to item detail page when row is clicked without opening a modal dialog", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/buying/items" || url === "/stock/items") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "item-123",
                item_code: "LILIN-MK",
                item_name: "Lilin Million Kecil",
                item_group: "Products",
                stock_uom: "Nos",
                standard_rate: 2500,
                is_stock_item: true,
                disabled: false,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/item?workspace=selling"]}>
        <Routes>
          <Route path="/desk/item" element={<MasterListPage type="item" workspace="selling" />} />
          <Route path="/desk/item/:id" element={<div data-testid="item-detail-page">Item Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Lilin Million Kecil")).toBeInTheDocument();
    });

    // Ensure no dialog is in the document
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click the item row
    const row = screen.getByText("Lilin Million Kecil").closest("tr");
    expect(row).not.toBeNull();
    if (row) {
      fireEvent.click(row);
    }

    // Should navigate directly to detail page
    await waitFor(() => {
      expect(screen.getByTestId("item-detail-page")).toBeInTheDocument();
    });

    // Dialog still does not exist
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
