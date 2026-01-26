/* eslint-disable react-refresh/only-export-components -- Router files intentionally export both components and route configs */
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BookOpen, CreditCard, Crown, Home, Shield, User, Zap } from "lucide-react";
import { useEffect, useState } from "react";

// Admin pages
import { AdminLayout } from "@/components/admin/AdminLayout";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/admin";
import { trackPageView } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AIUsagePage } from "@/pages/admin/AIUsagePage";
import { ConfigPage } from "@/pages/admin/ConfigPage";
import { DeckDetailPage } from "@/pages/admin/DeckDetailPage";
import { DecksPage } from "@/pages/admin/DecksPage";
import { JobsPage } from "@/pages/admin/JobsPage";
import { MediaPage } from "@/pages/admin/MediaPage";
import { StoriesPage } from "@/pages/admin/StoriesPage";
import { StoryQuestionsPage } from "@/pages/admin/StoryQuestionsPage";
import { VideoFormPage } from "@/pages/admin/VideoFormPage";
import { VideosPage } from "@/pages/admin/VideosPage";
import { ComprehensionPage } from "@/pages/ComprehensionPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ExamResultsPage } from "@/pages/ExamResultsPage";
import { ExamsPage } from "@/pages/ExamsPage";
import { ExamTakingPage } from "@/pages/ExamTakingPage";
import { FlashcardsPage } from "@/pages/FlashcardsPage";
import { GeneratePage } from "@/pages/GeneratePage";
import { LandingPage } from "@/pages/LandingPage";
import { LearnPage } from "@/pages/LearnPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { PlacementTestPage } from "@/pages/PlacementTestPage";
import { PracticePage } from "@/pages/PracticePage";
import { PricingPage } from "@/pages/PricingPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { ReaderPage } from "@/pages/ReaderPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StudySessionPage } from "@/pages/StudySessionPage";
import { TermsPage } from "@/pages/TermsPage";
import { UsageHistoryPage } from "@/pages/UsageHistoryPage";
import { VideoPage } from "@/pages/VideoPage";
import { VideoQuizPage } from "@/pages/VideoQuizPage";
import { VocabularyPage } from "@/pages/VocabularyPage";

import { api } from "../convex/_generated/api";

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

  // Track page views on navigation
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

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

  // Hide navigation during study session
  const isStudySession = location.pathname === "/study-session";

  return (
    <div className="min-h-screen bg-background paper-texture relative">
      {/* Premium animated background for authenticated users */}
      {isAuthenticated && <PremiumBackground variant="subtle" />}
      {!isStudySession && <Navigation />}
      <main className="relative z-10 animate-fade-in">
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
  const t = useT();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const userIsAdmin = isAdmin(user?.email);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position for blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Check initial state
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Get subscription tier for premium badge
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const tier = subscription?.tier;

  // Links visible to everyone (logged-out users see preview dashboard)
  const publicLinks = [
    { to: "/dashboard", labelKey: "common.nav.home", icon: Home },
    { to: "/library", labelKey: "common.nav.library", icon: BookOpen },
    { to: "/pricing", labelKey: "common.nav.pricing", icon: CreditCard },
  ] as const;

  // Links only visible when signed in - simplified to 3 tabs
  const authLinks = [
    { to: "/dashboard", labelKey: "common.nav.home", icon: Home },
    { to: "/library", labelKey: "common.nav.library", icon: BookOpen },
    { to: "/settings", labelKey: "common.nav.profile", icon: User },
  ] as const;

  // When authenticated, use full authLinks
  // When not authenticated, show publicLinks (includes preview dashboard)
  const links = isAuthenticated ? authLinks : publicLinks;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? "backdrop-blur-2xl" : "bg-transparent"
      }`}
    >
      {/* Rainbow glass effect - colorful gradient behind blur */}
      {isScrolled && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,132,0,0.3) 0%, rgba(223,145,247,0.3) 25%, rgba(6,182,212,0.25) 50%, rgba(254,237,122,0.3) 75%, rgba(255,132,0,0.3) 100%)",
            }}
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Tier Badge */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent/80 dark:from-siri-purple dark:to-siri-cyan flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105 dark:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <span
                  className="text-white text-lg font-bold drop-shadow-sm"
                  style={{ fontFamily: "var(--font-japanese)" }}
                >
                  読
                </span>
              </div>
              <div className="hidden sm:block">
                <span
                  className="text-lg font-semibold text-foreground tracking-tight dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:to-white/80 dark:bg-clip-text"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  SanLang
                </span>
              </div>
            </Link>
            {/* Premium Tier Badge */}
            {tier && tier !== "free" && (
              <Link
                to="/settings"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 backdrop-blur-sm ${
                  tier === "pro"
                    ? "bg-gradient-to-r from-accent/15 to-accent/25 text-accent border border-accent/20 shadow-sm dark:from-siri-purple/20 dark:to-siri-purple/30 dark:text-siri-purple dark:border-siri-purple/30 dark:shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                    : "bg-gradient-to-r from-blue-500/15 to-blue-600/25 text-blue-500 border border-blue-500/20 shadow-sm dark:from-siri-cyan/20 dark:to-siri-cyan/30 dark:text-siri-cyan dark:border-siri-cyan/30 dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                }`}
              >
                {tier === "pro" ? <Crown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                <span className="hidden sm:inline capitalize">{tier}</span>
              </Link>
            )}
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-accent bg-accent/10 dark:bg-orange-500/15 dark:border dark:border-orange-500/20 dark:shadow-[0_0_12px_rgba(255,132,0,0.15)] backdrop-blur-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/5 dark:hover:backdrop-blur-sm"
                  }`}
                >
                  <link.icon className={`w-4 h-4 ${active ? "text-accent" : ""}`} />
                  <span className="hidden sm:inline">{t(link.labelKey)}</span>
                </Link>
              );
            })}

            {/* Admin link - only visible to admins */}
            {userIsAdmin && (
              <Link
                to="/admin"
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname.startsWith("/admin")
                    ? "text-amber-500 bg-amber-500/10 dark:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "text-foreground-muted hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/5"
                }`}
              >
                <Shield
                  className={`w-4 h-4 ${location.pathname.startsWith("/admin") ? "text-amber-500" : ""}`}
                />
                <span className="hidden sm:inline">{t("common.nav.admin")}</span>
              </Link>
            )}

            {/* Sign In button when not authenticated - Glass styled */}
            {!isAuthenticated && (
              <SignInButton mode="modal">
                <button className="ml-2 px-4 py-2 rounded-xl text-sm font-semibold backdrop-blur-xl bg-white/10 dark:bg-white/10 border border-white/20 dark:border-white/20 text-foreground dark:text-white hover:bg-white/15 dark:hover:bg-white/15 hover:border-white/30 dark:hover:border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,132,0,0.15)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                  {t("common.nav.signIn")}
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
  path: "/read/$language/$storyId",
  component: ReaderPage,
});

const comprehensionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/comprehension/$language/$storyId",
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

const usageHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/usage",
  component: UsageHistoryPage,
});

const placementTestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/placement-test",
  component: PlacementTestPage,
});

const videoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/video/$videoId",
  component: VideoPage,
});

const videoQuizRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/video-quiz/$videoId",
  component: VideoQuizPage,
});

const studySessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study-session",
  component: StudySessionPage,
});

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pricing",
  component: PricingPage,
});

// Exam routes
const examsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exams",
  component: ExamsPage,
});

const examTakingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exams/$templateId",
  component: ExamTakingPage,
});

const examResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exams/$templateId/results/$attemptId",
  component: ExamResultsPage,
});

// Progress route
const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progress",
  component: ProgressPage,
});

// Legal pages
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});

// Admin routes - wrapped in AdminLayout which handles auth
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminLayout,
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: AdminDashboard,
});

const adminVideosRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/videos",
  component: VideosPage,
});

const adminVideoFormRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/videos/$id",
  component: VideoFormPage,
});

const adminDecksRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/decks",
  component: DecksPage,
});

const adminDeckDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/decks/$deckId",
  component: DeckDetailPage,
});

const adminJobsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/jobs",
  component: JobsPage,
});

const adminStoriesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/stories",
  component: StoriesPage,
});

const adminStoryQuestionsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/stories/$language/$storyId",
  component: StoryQuestionsPage,
});

const adminConfigRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/config",
  component: ConfigPage,
});

const adminMediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/media",
  component: MediaPage,
});

const adminAIUsageRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/ai-usage",
  component: AIUsagePage,
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  learnRoute,
  libraryRoute,
  readerRoute,
  comprehensionRoute,
  videoRoute,
  videoQuizRoute,
  vocabularyRoute,
  flashcardsRoute,
  practiceRoute,
  generateRoute,
  settingsRoute,
  usageHistoryRoute,
  placementTestRoute,
  studySessionRoute,
  pricingRoute,
  // Exam routes
  examsRoute,
  examTakingRoute,
  examResultsRoute,
  progressRoute,
  // Legal pages
  privacyRoute,
  termsRoute,
  // Admin routes
  adminRoute.addChildren([
    adminDashboardRoute,
    adminVideosRoute,
    adminVideoFormRoute,
    adminDecksRoute,
    adminDeckDetailRoute,
    adminJobsRoute,
    adminStoriesRoute,
    adminStoryQuestionsRoute,
    adminConfigRoute,
    adminMediaRoute,
    adminAIUsageRoute,
  ]),
]);

// Router
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // Always scroll to top on navigation - prevents scroll position from persisting
  scrollRestoration: true,
});

// Type registration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
