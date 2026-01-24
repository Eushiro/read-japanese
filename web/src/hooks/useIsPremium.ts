import { useQuery } from "convex/react";

import { useAuth } from "@/contexts/AuthContext";

import { api } from "../../convex/_generated/api";

/**
 * Hook to check if the current user has a premium subscription
 */
export function useIsPremium(): { isPremium: boolean; isLoading: boolean } {
  const { user, isAuthenticated } = useAuth();

  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );

  return {
    isPremium: subscription?.tier !== undefined && subscription.tier !== "free",
    isLoading: subscription === undefined,
  };
}
