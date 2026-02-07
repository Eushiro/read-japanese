import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";

import {
  AnalyticsEvents,
  identifyUser,
  initAnalytics,
  resetAnalytics,
  trackEvent,
  trackPageView,
} from "@/lib/analytics";

import { useAuth } from "./AuthContext";
import { useUserData } from "./UserDataContext";

interface AnalyticsContextType {
  trackEvent: typeof trackEvent;
  trackPageView: typeof trackPageView;
  events: typeof AnalyticsEvents;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { userProfile, subscription } = useUserData();
  const initialized = useRef(false);
  const lastIdentifiedUserId = useRef<string | null>(null);

  // Initialize PostHog once
  useEffect(() => {
    if (!initialized.current) {
      initAnalytics();
      initialized.current = true;
    }
  }, []);

  // Identify user when authenticated
  useEffect(() => {
    if (isAuthenticated && user && user.id !== lastIdentifiedUserId.current) {
      identifyUser(user.id, {
        email: user.email,
        name: user.displayName,
        subscription_tier: subscription?.tier ?? "free",
        languages_learning: userProfile?.languages ?? [],
        target_exams: userProfile?.targetExams ?? [],
      });
      lastIdentifiedUserId.current = user.id;

      // Track login if this is a new identification
      trackEvent(AnalyticsEvents.LOGIN_COMPLETED, {
        method: "clerk",
      });
    }
  }, [isAuthenticated, user, userProfile, subscription]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated && lastIdentifiedUserId.current) {
      trackEvent(AnalyticsEvents.LOGOUT_COMPLETED);
      resetAnalytics();
      lastIdentifiedUserId.current = null;
    }
  }, [isAuthenticated]);

  return (
    <AnalyticsContext.Provider
      value={{
        trackEvent,
        trackPageView,
        events: AnalyticsEvents,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
}
