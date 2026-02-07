import { useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import type { TierId } from "@/lib/tiers";

import { api } from "../../convex/_generated/api";

// Type definitions based on actual Convex schema
type LearningGoal = "exam" | "travel" | "professional" | "media" | "casual";

interface FoundationsProgress {
  wordsUnlocked: number;
  wordsLearned: number;
  storiesUnlocked: number;
  completedAt?: number;
}

interface UserProfile {
  _id: string;
  clerkId: string;
  email?: string;
  name?: string;
  languages?: ContentLanguage[];
  targetExams?: string[];
  proficiencyLevels?: Record<string, string>;
  isAdminMode?: boolean;
  learningGoal?: LearningGoal;
  interests?: string[];
  foundationsProgress?: FoundationsProgress;
}

interface Subscription {
  _id: string;
  userId: string;
  tier: TierId;
  stripeCustomerId?: string;
}

interface CreditBalance {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  nearLimit: boolean;
  tier: string;
  billingPeriod?: string;
  resetDate?: string;
  alertDismissed80: boolean;
  alertDismissed95: boolean;
}

interface UserDataContextValue {
  userProfile: UserProfile | null | undefined;
  subscription: Subscription | null | undefined;
  creditBalance: CreditBalance | undefined;
  isPremium: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  isSubscriptionLoading: boolean;
}

const UserDataContext = createContext<UserDataContextValue>({
  userProfile: undefined,
  subscription: undefined,
  creditBalance: undefined,
  isPremium: false,
  isLoading: true,
  isProfileLoading: true,
  isSubscriptionLoading: true,
});

interface UserDataProviderProps {
  children: ReactNode;
}

/**
 * UserDataProvider keeps user profile and subscription queries alive at app root.
 * This prevents re-fetching and loading spinners when navigating between pages.
 *
 * Subscriptions stay active for the app's lifetime, so data is always fresh
 * without the unmount/remount flash issue.
 */
export function UserDataProvider({ children }: UserDataProviderProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // These subscriptions stay alive for the app's lifetime
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  ) as UserProfile | null | undefined;

  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  ) as Subscription | null | undefined;

  // Single root-level credit balance subscription
  const creditBalanceRaw = useQuery(
    api.subscriptions.getCreditBalance,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const creditBalance = useMemo(
    () =>
      creditBalanceRaw
        ? {
            used: creditBalanceRaw.used,
            limit: creditBalanceRaw.limit,
            remaining: creditBalanceRaw.remaining,
            percentage: creditBalanceRaw.percentage,
            nearLimit: creditBalanceRaw.nearLimit,
            tier: creditBalanceRaw.tier,
            billingPeriod: creditBalanceRaw.billingPeriod,
            resetDate: creditBalanceRaw.resetDate,
            alertDismissed80: creditBalanceRaw.alertDismissed80,
            alertDismissed95: creditBalanceRaw.alertDismissed95,
          }
        : undefined,
    [creditBalanceRaw]
  );

  // Calculate derived values
  const isPremium = useMemo(() => {
    if (!subscription) return false;
    return subscription.tier !== "free";
  }, [subscription]);

  const isProfileLoading = isAuthenticated && userProfile === undefined;
  const isSubscriptionLoading = isAuthenticated && subscription === undefined;
  const isLoading = authLoading || isProfileLoading || isSubscriptionLoading;

  const value = useMemo(
    () => ({
      userProfile,
      subscription,
      creditBalance,
      isPremium,
      isLoading,
      isProfileLoading,
      isSubscriptionLoading,
    }),
    [
      userProfile,
      subscription,
      creditBalance,
      isPremium,
      isLoading,
      isProfileLoading,
      isSubscriptionLoading,
    ]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

/**
 * Hook to access user profile and subscription data from the shared context.
 * Use this instead of making direct useQuery calls for user/subscription data.
 */
export function useUserData(): UserDataContextValue {
  return useContext(UserDataContext);
}
