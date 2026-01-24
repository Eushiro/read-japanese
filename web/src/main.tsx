import "./index.css";

import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ThemeProvider } from "./components/ThemeProvider";
import { AnalyticsProvider } from "./contexts/AnalyticsContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ReviewSessionProvider } from "./contexts/ReviewSessionContext";
import { StudySessionProvider } from "./contexts/StudySessionContext";
import { TranslationProvider } from "./lib/i18n";
import { router } from "./router.tsx";

// Register service worker for offline caching of audio/images
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        // Service worker registered successfully
      })
      .catch(() => {
        // Service worker registration failed - non-critical
      });
  });
}

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

// Create Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TranslationProvider>
      <ClerkProvider publishableKey={clerkPubKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <AuthProvider>
            <AnalyticsProvider>
              <ReviewSessionProvider>
                <StudySessionProvider>
                  <QueryClientProvider client={queryClient}>
                    <ThemeProvider>
                      <RouterProvider router={router} />
                    </ThemeProvider>
                  </QueryClientProvider>
                </StudySessionProvider>
              </ReviewSessionProvider>
            </AnalyticsProvider>
          </AuthProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </TranslationProvider>
  </StrictMode>
);
