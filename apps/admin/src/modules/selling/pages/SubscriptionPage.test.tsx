import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import SubscriptionPage from "./SubscriptionPage";

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

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();

  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  apiDelete.mockReset();

  apiGet.mockImplementation((url: string) => {
    if (url === "/selling/subscriptions") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "sub-1",
              subscription_number: "SUB-2026-00001",
              party_type: "Customer",
              party: "PT Customer Utama",
              company: "Codeverta Enterprise",
              start_date: "2026-01-01",
              end_date: "2026-12-31",
              status: "Active",
              plans: [{ plan: "Pro Plan", qty: 2 }],
            },
          ],
        },
      });
    }
    if (url === "/selling/customers") {
      return Promise.resolve({
        data: {
          data: [
            { id: "c1", customer_name: "PT Customer Utama", customer_type: "Company" },
          ],
        },
      });
    }
    if (url === "/buying/suppliers") {
      return Promise.resolve({
        data: {
          data: [
            { id: "s1", supplier_name: "CV Supplier Jaya", supplier_group: "Local" },
          ],
        },
      });
    }
    if (url.includes("/companies") || url.includes("/stock/companies")) {
      return Promise.resolve({
        data: {
          data: [{ id: "1", company_name: "Codeverta Enterprise" }],
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  apiPost.mockImplementation((url: string) => {
    if (url === "/selling/subscriptions") {
      return Promise.resolve({
        data: {
          data: {
            id: "sub-2",
            subscription_number: "SUB-2026-00002",
          },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

describe("SubscriptionPage", () => {
  it("renders subscription list table with existing records", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/subscription"]}>
        <Routes>
          <Route path="/desk/subscription/*" element={<SubscriptionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("SUB-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("PT Customer Utama")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(2);
  });

  it("renders form and switches party options between Customer and Supplier", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/subscription/new"]}>
        <Routes>
          <Route path="/desk/subscription/*" element={<SubscriptionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("New Subscription")).toBeInTheDocument();
    expect(screen.getByText("Not Saved")).toBeInTheDocument();

    // Verify initial party type is Customer
    const partyTypeSelect = screen.getByLabelText(/Party Type/i);
    expect(partyTypeSelect).toHaveValue("Customer");

    // Open party dropdown and verify customer is present
    const partyTrigger = screen.getByText(/Begin typing for customer results.../i);
    fireEvent.click(partyTrigger);

    await waitFor(() => {
      expect(screen.getByText("PT Customer Utama")).toBeInTheDocument();
    });

    // Select customer
    fireEvent.click(screen.getByText("PT Customer Utama"));

    // Now change party type to Supplier
    fireEvent.change(partyTypeSelect, { target: { value: "Supplier" } });
    expect(partyTypeSelect).toHaveValue("Supplier");

    // Click party trigger for supplier
    const supplierTrigger = screen.getByText(/Begin typing for supplier results.../i);
    fireEvent.click(supplierTrigger);

    await waitFor(() => {
      expect(screen.getByText("CV Supplier Jaya")).toBeInTheDocument();
    });

    // Select supplier
    fireEvent.click(screen.getByText("CV Supplier Jaya"));

    // Add plan row
    const addPlanBtn = screen.getByRole("button", { name: /Tambah Baris/i });
    fireEvent.click(addPlanBtn);

    // Enter plan name into first input
    const planInputs = screen.getAllByPlaceholderText(/Masukkan nama paket/i);
    fireEvent.change(planInputs[0], { target: { value: "Enterprise Plan" } });

    const saveBtn = screen.getByRole("button", { name: "Save Subscription" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/subscriptions",
        expect.objectContaining({
          party_type: "Supplier",
          party: "CV Supplier Jaya",
          company: "Codeverta Enterprise",
        })
      );
    });
  });
});
