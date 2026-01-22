import { useState } from "react";
import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth, SignInButton } from "@/contexts/AuthContext";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LandingPage } from "@/pages/LandingPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { ReaderPage } from "@/pages/ReaderPage";
import { ComprehensionPage } from "@/pages/ComprehensionPage";
import { VocabularyPage } from "@/pages/VocabularyPage";
import { FlashcardsPage } from "@/pages/FlashcardsPage";
import { PracticePage } from "@/pages/PracticePage";
import { GeneratePage } from "@/pages/GeneratePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LearnPage } from "@/pages/LearnPage";
import { PlacementTestPage } from "@/pages/PlacementTestPage";
import { BookOpen, GraduationCap, Settings, Home } from "lucide-react";

// Root layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const location = useLocation();

  // Check URL for onboarding trigger
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "true") {
      setForceOnboarding(true);
      // Clean up URL
      params.delete("onboarding");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  });

  // Check if user has completed onboarding
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Show onboarding if user is authenticated but has no profile, or if forced
  const showOnboarding =
    isAuthenticated &&
    user &&
    !isLoading &&
    (userProfile === null || forceOnboarding) &&
    !onboardingComplete;

  const handleOnboardingComplete = () => {
    setOnboardingComplete(true);
    setForceOnboarding(false);
    // Navigate to dashboard after onboarding
    if (window.location.pathname === "/" || window.location.pathname === "/settings") {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-background paper-texture">
      <Navigation />
      <main className="animate-fade-in">
        <Outlet />
      </main>
      {showOnboarding && (
        <OnboardingModal
          userId={user.id}
          userEmail={user.email}
          userName={user.displayName}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}

function Navigation() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Links visible to everyone (logged-out users see preview dashboard)
  const publicLinks = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/library", label: "Library", icon: BookOpen },
  ] as const;

  // Links only visible when signed in - simplified to 4 tabs
  const authLinks = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/learn", label: "Learn", icon: GraduationCap },
    { to: "/library", label: "Library", icon: BookOpen },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  // When authenticated, use full authLinks
  // When not authenticated, show publicLinks (includes preview dashboard)
  const links = isAuthenticated ? authLinks : publicLinks;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-japanese)' }}>読</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-semibold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                SanLang
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-accent"
                      : "text-foreground-muted hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <link.icon className={`w-4 h-4 ${active ? "text-accent" : ""}`} />
                  <span className="hidden sm:inline">{link.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Sign In button when not authenticated */}
            {!isAuthenticated && (
              <SignInButton mode="modal">
                <button className="ml-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn",
  component: LearnPage,
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: LibraryPage,
});

const readerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/read/$storyId",
  component: ReaderPage,
});

const comprehensionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/comprehension/$storyId",
  component: ComprehensionPage,
});

// Legacy routes - redirect to /learn with appropriate tab
const vocabularyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vocabulary",
  component: VocabularyPage,
});

const flashcardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/flashcards",
  component: FlashcardsPage,
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/practice",
  component: PracticePage,
  validateSearch: (search: Record<string, unknown>) => ({
    vocabularyId: search.vocabularyId as string | undefined,
  }),
});

const generateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/generate",
  component: GeneratePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const placementTestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/placement-test",
  component: PlacementTestPage,
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  learnRoute,
  libraryRoute,
  readerRoute,
  comprehensionRoute,
  vocabularyRoute,
  flashcardsRoute,
  practiceRoute,
  generateRoute,
  settingsRoute,
  placementTestRoute,
]);

// Router
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // Always scroll to top on navigation - prevents scroll position from persisting
  scrollRestoration: true,
  defaultOnScrollRestoration: () => {
    window.scrollTo(0, 0);
  },
});

// Type registration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
