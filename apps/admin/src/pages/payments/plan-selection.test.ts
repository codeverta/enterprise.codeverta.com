import { describe, expect, it } from "vitest";
import { getPlanSelectionState } from "./plan-selection";

const activeSubscription = (amount: number) => ({
  is_active: true,
  subscription: { amount },
});

describe("getPlanSelectionState", () => {
  it("disables plans cheaper than the active subscription", () => {
    expect(getPlanSelectionState({ amount: 100_000 }, activeSubscription(200_000))).toMatchObject({
      disabled: true,
      reason: "lower_price",
      label: "Paket Lebih Murah",
    });
  });

  it("labels equal-priced plans as renewals", () => {
    expect(getPlanSelectionState({ amount: 200_000 }, activeSubscription(200_000))).toMatchObject({
      disabled: false,
      isRenewal: true,
      label: "Perpanjang Paket",
    });
  });

  it("allows upgrades", () => {
    expect(getPlanSelectionState({ amount: 300_000 }, activeSubscription(200_000))).toMatchObject({
      disabled: false,
      isRenewal: false,
      label: "Pilih Paket",
    });
  });

  it("requires a selected child before comparing child plans", () => {
    expect(getPlanSelectionState(
      { amount: 100_000 },
      activeSubscription(200_000),
      { requiresStudent: true, hasSelectedStudent: false },
    )).toMatchObject({
      disabled: true,
      reason: "student_required",
      label: "Pilih Anak Dahulu",
    });
  });
});
