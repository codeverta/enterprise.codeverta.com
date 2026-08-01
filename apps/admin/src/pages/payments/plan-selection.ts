export type PlanSelectionState = {
  disabled: boolean;
  label: string;
  reason: "student_required" | "lower_price" | null;
  isRenewal: boolean;
};

const numericAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

export const subscriptionAmount = (item: any): number | null =>
  numericAmount(item?.subscription?.amount ?? item?.amount ?? item?.plan?.amount);

export function getPlanSelectionState(
  plan: any,
  activeSubscriptionItem: any,
  options: { requiresStudent?: boolean; hasSelectedStudent?: boolean } = {},
): PlanSelectionState {
  if (options.requiresStudent && !options.hasSelectedStudent) {
    return {
      disabled: true,
      label: "Pilih Anak Dahulu",
      reason: "student_required",
      isRenewal: false,
    };
  }

  const planAmount = numericAmount(plan?.amount);
  const currentAmount = subscriptionAmount(activeSubscriptionItem);
  if (planAmount !== null && currentAmount !== null && planAmount < currentAmount) {
    return {
      disabled: true,
      label: "Paket Lebih Murah",
      reason: "lower_price",
      isRenewal: false,
    };
  }
  if (planAmount !== null && currentAmount !== null && planAmount === currentAmount) {
    return {
      disabled: false,
      label: "Perpanjang Paket",
      reason: null,
      isRenewal: true,
    };
  }

  return {
    disabled: false,
    label: "Pilih Paket",
    reason: null,
    isRenewal: false,
  };
}
