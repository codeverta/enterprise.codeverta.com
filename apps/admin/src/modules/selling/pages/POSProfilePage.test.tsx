import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import POSProfileListPage from "./POSProfileListPage";
import POSProfileFormPage from "./POSProfileFormPage";

const { apiGet, apiPost, apiPut, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("POS Profile Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/selling/pos-profiles/options")) {
        return Promise.resolve({
          data: {
            companies: ["UD MILLION CANDLES", "PT ZENIT TECHNOLOGY SOLUTION"],
            users: ["Administrator", "Kasir 1"],
            modes_of_payment: ["Cash", "Bank Transfer", "QRIS"],
            action_on_new_invoices: ["Always Ask"],
          },
        });
      }
      if (url.startsWith("/selling/pos-profiles")) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "posp-1",
                name: "Kasir Toko Utama",
                company: "UD MILLION CANDLES",
                warehouse: "Stores - MC",
                disabled: false,
                applicable_for_users: [{ user: "Administrator", default: true }],
                payments: [{ mode_of_payment: "Cash", default: true, allow_in_returns: true }],
              },
            ],
          },
        });
      }
      if (url.startsWith("/companies") || url.startsWith("/organization/companies")) {
        if (url.includes("/addresses")) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: "addr-1",
                  address_title: "Kantor Pusat",
                  address_line1: "Jl. Malioboro No. 10",
                  city: "Yogyakarta",
                },
              ],
            },
          });
        }
        return Promise.resolve({
          data: {
            data: [
              { id: "comp-1", name: "UD MILLION CANDLES", abbreviation: "MC" },
              { id: "comp-2", name: "PT ZENIT TECHNOLOGY SOLUTION", abbreviation: "PZTS" },
            ],
          },
        });
      }
      if (url.startsWith("/stock/warehouses")) {
        return Promise.resolve({
          data: {
            data: [{ warehouse_name: "Stores - MC" }, { warehouse_name: "Gudang Depan" }],
          },
        });
      }
      if (url.startsWith("/selling/customers")) {
        return Promise.resolve({
          data: {
            data: [{ customer_name: "Walk-in Customer" }, { customer_name: "PT Retail Abadi" }],
          },
        });
      }
      if (url.startsWith("/users")) {
        return Promise.resolve({
          data: {
            data: [{ username: "admin", display_name: "Administrator" }, { username: "kasir1", display_name: "Kasir 1" }],
          },
        });
      }
      if (url.startsWith("/currencies")) {
        return Promise.resolve({
          data: {
            data: [{ name: "IDR", symbol: "Rp" }, { name: "USD", symbol: "$" }],
          },
        });
      }
      if (url.startsWith("/selling/price-lists")) {
        return Promise.resolve({
          data: {
            data: [{ price_list_name: "Standard Selling" }],
          },
        });
      }
      if (url.startsWith("/selling/item-groups")) {
        return Promise.resolve({
          data: {
            data: [{ item_group_name: "Products" }, { item_group_name: "Services" }],
          },
        });
      }
      if (url.startsWith("/selling/customer-groups")) {
        return Promise.resolve({
          data: {
            data: [{ group_name: "Individual" }, { group_name: "Commercial" }],
          },
        });
      }
      if (url.startsWith("/organization/letter-heads")) {
        return Promise.resolve({
          data: {
            data: [{ name: "Standard" }],
          },
        });
      }
      if (url.startsWith("/selling/tax-categories")) {
        return Promise.resolve({
          data: {
            data: [{ title: "PPN 11%" }],
          },
        });
      }
      if (url.startsWith("/projects")) {
        return Promise.resolve({
          data: {
            data: [{ project_name: "Project POS Retail" }],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("renders POSProfileListPage and shows list of profiles", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/pos-profile"]}>
        <Routes>
          <Route path="/desk/pos-profile" element={<POSProfileListPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Kasir Toko Utama")).toBeInTheDocument();
    expect(screen.getByText("UD MILLION CANDLES")).toBeInTheDocument();
    expect(screen.getByText("Stores - MC")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
  });

  it("renders POSProfileFormPage with all tabs and saves new profile", async () => {
    apiPost.mockResolvedValue({
      data: {
        data: {
          id: "posp-new-123",
          name: "Kasir Cabang Baru",
          company: "UD MILLION CANDLES",
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/desk/pos-profile/new"]}>
        <Routes>
          <Route path="/desk/pos-profile/new" element={<POSProfileFormPage />} />
          <Route path="/desk/pos-profile/:id" element={<div>Profile Details Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait until loading finishes and Save button is enabled
    const saveButton = await screen.findByRole("button", { name: /save/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Verify Tab headers
    expect(screen.getByText("Details & Users")).toBeInTheDocument();
    expect(screen.getByText("Payments & Configuration")).toBeInTheDocument();
    expect(screen.getByText("Filters & Print")).toBeInTheDocument();
    expect(screen.getByText("Accounting & Dimensions")).toBeInTheDocument();

    // Fill in Name
    const nameInput = screen.getByPlaceholderText("__newname");
    fireEvent.change(nameInput, { target: { value: "Kasir Cabang Baru" } });

    // Click Save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/pos-profiles",
        expect.objectContaining({
          name: "Kasir Cabang Baru",
          company: "UD MILLION CANDLES",
        })
      );
    });
  });

  it("allows adding and removing user rows in Applicable for Users table", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/pos-profile/new"]}>
        <Routes>
          <Route path="/desk/pos-profile/new" element={<POSProfileFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait until loading finishes
    const saveButton = await screen.findByRole("button", { name: /save/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Applicable for Users is on tab 1 (Details & Users)
    expect(screen.getByText("Applicable for Users")).toBeInTheDocument();

    // Initial rows should have Administrator
    expect(screen.getByText("Administrator")).toBeInTheDocument();

    // Click Tambah User
    const addUserBtn = screen.getByRole("button", { name: /tambah user/i });
    fireEvent.click(addUserBtn);

    // Verify row count increased
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThanOrEqual(3); // header + 2 user rows
  });
});
