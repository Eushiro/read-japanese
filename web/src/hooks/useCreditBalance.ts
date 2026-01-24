import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the current user's credit balance
 * Returns credit usage stats for the current billing period
 */
export function useCreditBalance() {
  const { user } = useAuth();

  const balance = useQuery(
    api.subscriptions.getCreditBalance,
    user?.clerkId ? { userId: user.clerkId } : "skip"
  );

  return {
    used: balance?.used ?? 0,
    limit: balance?.limit ?? 50,
    remaining: balance?.remaining ?? 50,
    percentage: balance?.percentage ?? 0,
    nearLimit: balance?.nearLimit ?? false,
    tier: balance?.tier ?? "free",
    billingPeriod: balance?.billingPeriod,
    resetDate: balance?.resetDate,
    alertDismissed80: balance?.alertDismissed80 ?? false,
    alertDismissed95: balance?.alertDismissed95 ?? false,
    isLoading: balance === undefined,
  };
}
