import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PointOfSalePage from "./PointOfSalePage";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: { get: apiGet, post: apiPost, patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  localStorage.clear();
});

const mockApi = () => {
  apiGet.mockImplementation((url: string) => {
    if (url === "/selling/pos/opening-entries/current") {
      return Promise.resolve({
        data: {
          data: {
            id: "opening-123",
            pos_profile: "Usaha Jualan Lilin",
            company: "Test Corp",
            balance_details: [
              { mode_of_payment: "Cash", opening_amount: 0 },
              { mode_of_payment: "Bank Transfer", opening_amount: 0 },
            ],
          },
          is_outdated: false,
        },
      });
    }
    if (
      url === "/selling/pos/items" ||
      url.includes("/selling/point-of-sale/items")
    ) {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "1",
              item_code: "LILIN-01",
              item_name: "Lilin Mati Lampu Sedang",
              item_group: "Products",
              rate: 15000,
              unit: "Nos",
              barcodes: [],
            },
          ],
        },
      });
    }
    if (url === "/selling/item-groups") {
      return Promise.resolve({
        data: {
          data: [
            { id: "ig-1", item_group_name: "Products", is_group: false },
          ],
        },
      });
    }
    if (url === "/selling/customers") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "c-1",
              customer_name: "Rabih",
              email: "rabih@example.com",
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });
};

describe("PointOfSalePage", () => {
  it("renders SearchableSelect for customer and item group fetched from API", async () => {
    mockApi();

    render(
      <MemoryRouter initialEntries={["/desk/point-of-sale"]}>
        <Routes>
          <Route path="/desk/point-of-sale" element={<PointOfSalePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for item to appear
    expect(await screen.findByText("Lilin Mati Lampu Sedang")).toBeInTheDocument();

    // Verify Item Group SearchableSelect trigger is rendered
    expect(screen.getByText("All Item Groups")).toBeInTheDocument();

    // Verify Customer SearchableSelect defaults to Walk-in Customer
    expect(screen.getByText("Walk-in Customer")).toBeInTheDocument();

    // Click Customer select and select Rabih
    fireEvent.click(screen.getByText("Walk-in Customer"));
    const customerOption = await screen.findByRole("button", { name: /Rabih/i });
    fireEvent.click(customerOption);

    // Verify selected customer appears
    expect(screen.getByText("Rabih")).toBeInTheDocument();
  });

  it("transitions to full Payment screen on checkout without popup dialog, supports numpad and edit cart", async () => {
    mockApi();

    render(
      <MemoryRouter initialEntries={["/desk/point-of-sale"]}>
        <Routes>
          <Route path="/desk/point-of-sale" element={<PointOfSalePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Add item to cart
    const itemCard = await screen.findByText("Lilin Mati Lampu Sedang");
    fireEvent.click(itemCard);

    // Click Checkout
    const checkoutBtn = screen.getByRole("button", { name: "Checkout" });
    fireEvent.click(checkoutBtn);

    // Ensure NO popup dialog with "Selesaikan transaksi"
    expect(screen.queryByText("Selesaikan transaksi")).not.toBeInTheDocument();

    // Verify full Payment Method UI is displayed
    expect(screen.getByRole("heading", { name: "Payment Method" })).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();

    // Verify numpad buttons
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+/-" })).toBeInTheDocument();

    // Verify bottom summary and Complete Order button
    expect(screen.getAllByText("Grand Total").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Paid Amount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Order" })).toBeInTheDocument();

    // Verify Edit Cart button exists and switches back
    const editCartBtn = screen.getByRole("button", { name: "Edit Cart" });
    fireEvent.click(editCartBtn);

    // Verify we're back in catalog view
    expect(screen.getByRole("heading", { name: "All Items" })).toBeInTheDocument();
  });

  it("completes order, displays receipt card, and handles Print, Email, and New Order actions", async () => {
    mockApi();
    apiPost.mockImplementation((url: string) => {
      if (url === "/selling/pos/invoices") {
        return Promise.resolve({
          data: {
            data: {
              invoice_number: "ACC-SINV-2026-00010",
              status: "Paid",
            },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/desk/point-of-sale"]}>
        <Routes>
          <Route path="/desk/point-of-sale" element={<PointOfSalePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Select customer Rabih
    fireEvent.click(await screen.findByText("Walk-in Customer"));
    const customerOption = await screen.findByRole("button", { name: /Rabih/i });
    fireEvent.click(customerOption);

    // Add item to cart
    const itemCard = await screen.findByText("Lilin Mati Lampu Sedang");
    fireEvent.click(itemCard);

    // Click Checkout
    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

    // Click Complete Order
    const completeBtn = screen.getByRole("button", { name: "Complete Order" });
    fireEvent.click(completeBtn);

    // Verify Receipt View is displayed with correct details
    expect(await screen.findByText("ACC-SINV-2026-00010")).toBeInTheDocument();
    expect(screen.getByText("Sold by: Administrator")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Totals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();

    // Verify Action buttons
    const printBtn = screen.getByRole("button", { name: "Print Receipt" });
    const emailBtn = screen.getByRole("button", { name: "Email Receipt" });
    const newOrderBtn = screen.getByRole("button", { name: "New Order" });
    expect(printBtn).toBeInTheDocument();
    expect(emailBtn).toBeInTheDocument();
    expect(newOrderBtn).toBeInTheDocument();

    // Test Print Receipt
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Test Email Receipt Dialog
    fireEvent.click(emailBtn);
    expect(await screen.findByRole("heading", { name: "Email Receipt" })).toBeInTheDocument();
    const emailInput = screen.getByPlaceholderText("customer@example.com");
    expect(emailInput).toHaveValue("rabih@example.com");
    const sendEmailBtn = screen.getByRole("button", { name: "Kirim Email" });
    fireEvent.click(sendEmailBtn);

    // Dialog closes
    expect(screen.queryByRole("heading", { name: "Email Receipt" })).not.toBeInTheDocument();

    // Test New Order returns to catalog
    fireEvent.click(newOrderBtn);
    expect(await screen.findByRole("heading", { name: "All Items" })).toBeInTheDocument();

    printSpy.mockRestore();
  }, 15000);

  it("defaults to Walk-in Customer even when another POS default exists", async () => {
    mockApi();
    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/pos/opening-entries/current") {
        return Promise.resolve({
          data: {
            data: {
              id: "opening-123",
              pos_profile: "Usaha Jualan Lilin",
              company: "Test Corp",
              balance_details: [{ mode_of_payment: "Cash", opening_amount: 0 }],
            },
            is_outdated: false,
          },
        });
      }
      if (url === "/selling/customers") {
        return Promise.resolve({
          data: {
            data: [
              { id: "c-1", customer_name: "Regular Customer", is_default_for_pos: false },
              { id: "c-2", customer_name: "Default POS Customer", is_default_for_pos: true },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/point-of-sale"]}>
        <Routes>
          <Route path="/desk/point-of-sale" element={<PointOfSalePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Walk-in Customer")).toBeInTheDocument();
    expect(screen.queryByText("Default POS Customer")).not.toBeInTheDocument();
  });

  it("renders item image in catalog card, side cart, and checkout view when item has an image", async () => {
    mockApi();
    apiGet.mockImplementation((url: string) => {
      if (url === "/selling/pos/opening-entries/current") {
        return Promise.resolve({
          data: {
            data: {
              id: "opening-123",
              pos_profile: "Usaha Jualan Lilin",
              company: "Test Corp",
              balance_details: [
                { mode_of_payment: "Cash", opening_amount: 0 },
                { mode_of_payment: "Bank Transfer", opening_amount: 0 },
              ],
            },
            is_outdated: false,
          },
        });
      }
      if (url === "/selling/pos/items" || url.includes("/selling/point-of-sale/items")) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "item-img-1",
                item_code: "LILIN-FOTO",
                item_name: "Lilin Aroma Foto",
                item_group: "Products",
                rate: 25000,
                unit: "Nos",
                image: "uploads/items/lilin-foto.png",
                barcodes: [],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter initialEntries={["/desk/point-of-sale"]}>
        <Routes>
          <Route path="/desk/point-of-sale" element={<PointOfSalePage />} />
        </Routes>
      </MemoryRouter>
    );

    // 1. In catalog card
    const catalogImages = await screen.findAllByAltText("Lilin Aroma Foto");
    expect(catalogImages.length).toBeGreaterThanOrEqual(1);
    expect(catalogImages[0]).toHaveAttribute(
      "src",
      expect.stringContaining("uploads/items/lilin-foto.png")
    );

    // 2. Click to add to cart
    fireEvent.click(screen.getByText("Lilin Aroma Foto"));

    // Verify side cart now also shows the image
    const cartImages = screen.getAllByAltText("Lilin Aroma Foto");
    expect(cartImages.length).toBe(2);

    // 3. Go to checkout view
    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

    // Verify checkout view shows image
    const checkoutImages = screen.getAllByAltText("Lilin Aroma Foto");
    expect(checkoutImages.length).toBeGreaterThanOrEqual(1);
  });
});
