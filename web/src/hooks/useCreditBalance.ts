import { useUserData } from "@/contexts/UserDataContext";

/**
 * Hook to get the current user's credit balance.
 * Reads from the single root-level subscription in UserDataContext
 * instead of creating per-component Convex subscriptions.
 */
export function useCreditBalance() {
  const { creditBalance } = useUserData();

  return {
    used: creditBalance?.used ?? 0,
    limit: creditBalance?.limit ?? 50,
    remaining: creditBalance?.remaining ?? 50,
    percentage: creditBalance?.percentage ?? 0,
    nearLimit: creditBalance?.nearLimit ?? false,
    tier: creditBalance?.tier ?? "free",
    billingPeriod: creditBalance?.billingPeriod,
    resetDate: creditBalance?.resetDate,
    alertDismissed80: creditBalance?.alertDismissed80 ?? false,
    alertDismissed95: creditBalance?.alertDismissed95 ?? false,
    isLoading: creditBalance === undefined,
  };
}
