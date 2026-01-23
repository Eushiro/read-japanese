import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/lib/convex-types";

/**
 * Hook to get the current user's Convex profile data
 * Returns the full user document from Convex, or null if not found
 */
export function useConvexUser(): {
  user: User | null | undefined;
  isLoading: boolean;
} {
  const { user: authUser, isAuthenticated } = useAuth();

  const convexUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && authUser ? { clerkId: authUser.id } : "skip"
  );

  return {
    user: convexUser,
    isLoading: convexUser === undefined,
  };
}
