import { useMutation } from "convex/react";

import { useAuth } from "@/contexts/AuthContext";

import { api } from "../../convex/_generated/api";
import { useCreditBalance } from "./useCreditBalance";

/**
 * Hook for managing credit alert dismissals
 * Tracks whether the user has dismissed 80% and 95% alerts this month
 */
export function useCreditAlerts() {
  const { user } = useAuth();
  const { alertDismissed80, alertDismissed95, percentage } = useCreditBalance();

  const dismissAlertMutation = useMutation(api.subscriptions.dismissCreditAlert);

  const dismissAlert = async (threshold: 80 | 95) => {
    if (!user?.id) return;

    await dismissAlertMutation({
      userId: user.id,
      threshold,
    });
  };

  // Determine which alert to show (if any)
  const shouldShowAlert95 = percentage >= 95 && !alertDismissed95;
  const shouldShowAlert80 = percentage >= 80 && percentage < 95 && !alertDismissed80;

  return {
    alertDismissed80,
    alertDismissed95,
    shouldShowAlert80,
    shouldShowAlert95,
    dismissAlert,
  };
}
