import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import SubscriptionPlanPage from "./SubscriptionPlanPage";

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
    if (url === "/selling/subscription-plans") {
      return Promise.resolve({
        data: {
          data: [
            {
              id: "plan-1",
              plan_name: "Gold Monthly",
              currency: "IDR",
              item: "ITEM-001",
              price_determination: "Fixed Rate",
              cost: 150000,
              billing_interval: "Month",
              billing_interval_count: 1,
              payment_gateway: "Midtrans",
              cost_center: "Main - CE",
              disabled: false,
              status: "Active",
            },
          ],
        },
      });
    }
    if (url === "/selling/pos/items") {
      return Promise.resolve({
        data: {
          data: [
            { id: "1", item_code: "ITEM-001", item_name: "Cloud Hosting Pro", rate: 150000 },
          ],
        },
      });
    }
    if (url === "/selling/price-lists") {
      return Promise.resolve({
        data: {
          data: [{ name: "Standard Selling" }, { name: "Standard Buying" }],
        },
      });
    }
    if (url === "/selling/subscription-plans/plan-1") {
      return Promise.resolve({
        data: {
          data: {
            id: "plan-1",
            plan_name: "Gold Monthly",
            currency: "IDR",
            item: "ITEM-001",
            price_determination: "Fixed Rate",
            cost: 150000,
            billing_interval: "Month",
            billing_interval_count: 1,
            payment_gateway: "Midtrans",
            cost_center: "Main - CE",
            disabled: false,
            status: "Active",
          },
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  apiPost.mockImplementation((url: string) => {
    if (url === "/selling/subscription-plans") {
      return Promise.resolve({
        data: {
          data: { id: "plan-2", plan_name: "Silver Annual" },
          message: "Subscription Plan berhasil dibuat",
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

describe("SubscriptionPlanPage", () => {
  it("renders subscription plan list view", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/subscription-plan"]}>
        <Routes>
          <Route path="/desk/subscription-plan/*" element={<SubscriptionPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Gold Monthly")).toBeInTheDocument();
    expect(screen.getByText("ITEM-001")).toBeInTheDocument();
    expect(screen.getByText("Add Subscription Plan")).toBeInTheDocument();
  });

  it("renders new subscription plan form with all required fields and saves", async () => {
    render(
      <MemoryRouter initialEntries={["/desk/subscription-plan/new"]}>
        <Routes>
          <Route path="/desk/subscription-plan/*" element={<SubscriptionPlanPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("New Subscription Plan")).toBeInTheDocument();
    expect(screen.getByText("Not Saved")).toBeInTheDocument();

    // Verify key fields
    expect(screen.getByLabelText(/Plan Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subscription Price Based On/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Billing Interval$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Billing Interval Count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Product Price ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Disabled/i)).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/Plan Name/i);
    fireEvent.change(nameInput, { target: { value: "Silver Annual" } });

    const costInput = screen.getByLabelText(/Cost \/ Rate/i);
    fireEvent.change(costInput, { target: { value: "500000" } });

    const intervalCountInput = screen.getByLabelText(/Billing Interval Count/i);
    fireEvent.change(intervalCountInput, { target: { value: "2" } });

    const productPriceInput = screen.getByLabelText(/Product Price ID/i);
    fireEvent.change(productPriceInput, { target: { value: "price_silver_123" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/selling/subscription-plans",
        expect.objectContaining({
          plan_name: "Silver Annual",
          cost: 500000,
          billing_interval_count: 2,
          product_price_id: "price_silver_123",
        })
      );
    });
  });
});
