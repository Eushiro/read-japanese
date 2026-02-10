import { Link, useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  Globe,
  Play,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CreditAlert } from "@/components/CreditAlert";
import { SkillsSection } from "@/components/dashboard/SkillsSection";
import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, type VideoItem } from "@/components/library/VideoCard";
import { Paywall } from "@/components/Paywall";
import { Badge } from "@/components/ui/badge";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useStudySession } from "@/contexts/StudySessionContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useRecommendedStories } from "@/hooks/useRecommendedStories";
import { useRecommendedVideos } from "@/hooks/useRecommendedVideos";
import { useStoriesByLanguage } from "@/hooks/useStories";
import { isAdmin } from "@/lib/admin";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { getPracticeSessionKey } from "@/lib/practiceSession";
import type { StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

export function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "anonymous";
  const navigate = useNavigate();
  const t = useT();
  const { state: sessionState } = useStudySession();

  const [showPaywall, setShowPaywall] = useState(false);

  // User profile and subscription from shared context (prevents refetching on navigation)
  const { userProfile, isPremium: isPremiumUser, isLoading: isUserDataLoading } = useUserData();

  // Get user languages from shared context
  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];

  // Get primary language for adaptive content (first user language or default to japanese)
  const primaryLanguage = userLanguages[0] ?? "japanese";

  // Admin mode flag
  const adminEnabled = isAdmin(user?.email) && userProfile?.isAdminMode === true;

  // Admin: poll prefetch status
  const prefetchStatus = useQuery(
    api.adaptivePracticeQueries.getPrefetchStatus,
    adminEnabled && user ? { userId: user.id, language: primaryLanguage } : "skip"
  );

  // Prefetch practice set in background so it's ready when user clicks "Start Practice"
  const triggerPrefetch = useAction(api.adaptivePractice.triggerPrefetch);
  const prefetchTriggeredRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !userProfile || prefetchTriggeredRef.current) return;
    // Only prefetch if there's no active session in sessionStorage
    const hasActiveSession = !!sessionStorage.getItem(getPracticeSessionKey(primaryLanguage));
    if (hasActiveSession) return;
    prefetchTriggeredRef.current = true;
    triggerPrefetch({ language: primaryLanguage }).catch(() => {
      // Best-effort — ignore errors
    });
  }, [isAuthenticated, userProfile, primaryLanguage, triggerPrefetch]);

  // Fetch streak data
  const streakData = useQuery(
    api.users.getStreak,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Use adaptive video recommendations based on learner model
  const { videos: adaptiveVideos } = useRecommendedVideos(
    primaryLanguage,
    4,
    isAuthenticated ? userId : undefined
  );

  // Fetch stories for this language only (dashboard only shows primary language)
  const { data: allStories } = useStoriesByLanguage(primaryLanguage);

  // Use adaptive story recommendations based on learner model
  const { stories: adaptiveStories, reason: storyReason } = useRecommendedStories(
    allStories,
    userProfile,
    primaryLanguage,
    8,
    isAuthenticated ? userId : undefined
  );

  // Use adaptive stories directly (single language)
  const suggestedStories = adaptiveStories;

  // Use adaptive videos directly
  const suggestedVideos = adaptiveVideos as VideoItem[];

  // Handle story click with premium check
  const handleStoryClick = (story: StoryListItem) => {
    if (story.isPremium && !isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    navigate({
      to: "/read/$language/$storyId",
      params: { language: story.language, storyId: story.id },
    });
  };

  // Calculate stats
  const isPreviewMode = !isAuthenticated;
  const currentStreak = isPreviewMode ? 3 : (streakData?.currentStreak ?? 0);

  // No longer gated on placement test — always ready for practice

  if (authLoading || isUserDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Full-page animated background */}
      <PremiumBackground />

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-20 pb-8">
        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isPreviewMode
                ? t("dashboard.preview.title")
                : t("dashboard.welcome", { name: user?.displayName?.split(" ")[0] ?? "" })}
            </h1>
            {isPreviewMode && (
              <p className="text-foreground mt-3 text-lg">{t("dashboard.preview.subtitle")}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-8 max-w-6xl relative z-10">
        {/* Credit Alert */}
        {isAuthenticated && <CreditAlert />}

        <div className="space-y-10">
          {/* Primary CTA */}
          {isPreviewMode ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="relative"
            >
              <div className="relative py-10 sm:py-12">
                <PreviewStartStudying />
              </div>
            </motion.div>
          ) : (
            <>
              <HybridCCardless
                config={getPrimaryCtaConfig({
                  hasLanguages: userLanguages.length > 0,
                  sessionStatus: sessionState.status,
                  learningGoal: userProfile?.learningGoal,
                  hasSavedPractice: !!sessionStorage.getItem(
                    getPracticeSessionKey(primaryLanguage)
                  ),
                  t,
                })}
                currentStreak={currentStreak}
                onAction={(action) => {
                  if (action === "setup") {
                    navigate({ to: "/settings" });
                    return;
                  }
                  if (action === "practice") {
                    navigate({ to: "/adaptive-practice" });
                    return;
                  }
                  navigate({ to: "/study-session" });
                }}
              />
              {adminEnabled && prefetchStatus !== undefined && (
                <div className="flex justify-center mt-2">
                  <Badge
                    variant="outline"
                    className="text-xs gap-1.5"
                    title={
                      prefetchStatus?.status === "failed" ? prefetchStatus.errorMessage : undefined
                    }
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        prefetchStatus === null
                          ? "bg-gray-400"
                          : prefetchStatus.status === "generating"
                            ? "bg-yellow-400"
                            : prefetchStatus.status === "failed"
                              ? "bg-red-400"
                              : "bg-green-400"
                      }`}
                    />
                    {prefetchStatus === null
                      ? "No prefetch"
                      : prefetchStatus.status === "generating"
                        ? "Prefetch: generating"
                        : prefetchStatus.status === "failed"
                          ? "Prefetch: failed"
                          : "Prefetch: ready"}
                  </Badge>
                </div>
              )}
            </>
          )}

          {/* Your Skills - Radar charts for each language */}
          <SkillsSection userId={userId} userLanguages={userLanguages} isPreview={isPreviewMode} />

          {/* Suggested for You - Open floating section */}
          {(suggestedStories.length > 0 || suggestedVideos.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              {/* Ambient purple glow pool */}
              <div className="absolute -inset-12 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 rounded-[4rem] blur-3xl pointer-events-none" />

              <div className="relative py-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"
                    >
                      <TrendingUp className="w-5 h-5 text-orange-400" />
                    </motion.div>
                    <h2
                      className="text-xl font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {t("dashboard.sections.suggestedForYou")}
                    </h2>
                  </div>
                  <Link
                    to="/library"
                    className="text-sm text-foreground flex items-center gap-1 transition-colors"
                  >
                    {t("common.actions.viewAll")}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="text-sm text-foreground mb-4">
                  {storyReason || t("dashboard.sections.popularPicks")}
                </p>

                {/* Stories */}
                {suggestedStories.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">
                        {t("dashboard.sections.stories")}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide lg:hidden">
                      {suggestedStories.map((story) => (
                        <div
                          key={story.id}
                          className="flex-shrink-0 w-[160px] [&>article]:border [&>article]:border-border [&>article]:bg-white/[0.02]"
                        >
                          <StoryCard
                            story={story}
                            isPremiumUser={!!isPremiumUser}
                            onClick={() => handleStoryClick(story)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-4 gap-4">
                      {suggestedStories.map((story) => (
                        <div
                          key={story.id}
                          className="[&>article]:border [&>article]:border-border [&>article]:bg-white/[0.02]"
                        >
                          <StoryCard
                            story={story}
                            isPremiumUser={!!isPremiumUser}
                            onClick={() => handleStoryClick(story)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {suggestedVideos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Video className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">
                        {t("dashboard.sections.videos")}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide items-stretch lg:hidden">
                      {suggestedVideos.map((video) => (
                        <div
                          key={video._id}
                          className="flex-shrink-0 w-[240px] [&>article]:border [&>article]:border-border [&>article]:bg-white/[0.02] [&>article]:h-full"
                        >
                          <VideoCard
                            video={{ ...video, description: undefined }}
                            onClick={() =>
                              navigate({ to: "/video/$videoId", params: { videoId: video._id } })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-4 gap-4">
                      {suggestedVideos.map((video) => (
                        <div
                          key={video._id}
                          className="[&>article]:border [&>article]:border-border [&>article]:bg-white/[0.02] [&>article]:h-full"
                        >
                          <VideoCard
                            video={{ ...video, description: undefined }}
                            onClick={() =>
                              navigate({ to: "/video/$videoId", params: { videoId: video._id } })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* Sign-Up CTA (Preview Mode) - Floating with dramatic glow */}
          {isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl"
            >
              {/* Ambient glow pool */}
              <div className="absolute -inset-10 bg-gradient-to-br from-orange-500/15 via-purple-500/10 to-transparent rounded-[3rem] blur-2xl pointer-events-none" />

              {/* Subtle background - no border */}
              <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.02] rounded-3xl" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-3xl" />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-purple-500/5 rounded-3xl" />

              <div className="relative p-10 text-center">
                <h2
                  className="text-xl font-bold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("dashboard.signUpCta.title")}
                </h2>
                <p className="text-foreground mb-6 max-w-md mx-auto">
                  {t("dashboard.signUpCta.subtitle")}
                </p>
                <SignInButton mode="modal">
                  <button className="group relative px-8 py-4 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-purple-500 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden">
                    {/* Shimmer effect */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      {t("dashboard.signUpCta.button")}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </SignInButton>
                <p className="text-sm text-foreground mt-3">
                  {t("dashboard.signUpCta.disclaimer")}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
    </div>
  );
}

// Preview Start Studying for logged-out users
function PreviewStartStudying() {
  const t = useT();

  return (
    <div className="text-center">
      <div className="mb-6">
        <SignInButton mode="modal">
          <button className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-purple-500 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden">
            {/* Shimmer effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative flex items-center justify-center gap-3">
              <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
              {t("dashboard.preview.startStudying")}
            </span>
          </button>
        </SignInButton>
      </div>
      <p className="text-foreground font-medium mb-4">{t("dashboard.preview.reviewCards")}</p>
      <p className="text-sm text-foreground">{t("dashboard.preview.signInPrompt")}</p>
    </div>
  );
}

// Skeleton loading state
function DashboardSkeleton() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background placeholder */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-10 bg-orange-500 top-0 left-1/4" />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-10 bg-purple-500 top-1/3 right-1/4" />
      </div>

      {/* Hero Section Skeleton */}
      <div className="relative pt-8 pb-8">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center">
            <div className="h-12 bg-white/5 rounded-lg w-64 mx-auto animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 pt-12 pb-8 max-w-6xl relative z-10">
        <div className="space-y-10">
          {/* Start Studying CTA Skeleton */}
          <div className="rounded-3xl bg-white/[0.02] p-10 sm:p-12">
            <div className="text-center space-y-4">
              <div className="h-14 bg-white/5 rounded-2xl w-48 mx-auto animate-pulse" />
              <div className="h-5 bg-white/5 rounded w-56 mx-auto animate-pulse" />
              <div className="flex justify-center gap-2 pt-2">
                <div className="h-10 bg-white/5 rounded-xl w-16 animate-pulse" />
                <div className="h-10 bg-white/5 rounded-xl w-16 animate-pulse" />
                <div className="h-10 bg-white/5 rounded-xl w-16 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Suggested Section Skeleton */}
          <div className="py-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-6 bg-white/5 rounded w-40 animate-pulse" />
            </div>
            <div className="h-4 bg-white/5 rounded w-28 mb-4 animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[160px] rounded-xl bg-white/[0.02] overflow-hidden"
                >
                  <div className="aspect-[3/4] bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Browse Library Skeleton */}
          <div className="rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-white/5 rounded w-32 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-48 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type PrimaryCtaAction = "session" | "practice" | "setup";

function getPrimaryCtaConfig(args: {
  hasLanguages: boolean;
  sessionStatus: "idle" | "planning" | "active" | "complete";
  learningGoal?: "exam" | "travel" | "professional" | "media" | "casual";
  hasSavedPractice: boolean;
  t: ReturnType<typeof useT>;
}) {
  const t = args.t;
  if (!args.hasLanguages) {
    return {
      title: t("dashboard.primaryCta.setupTitle"),
      subtitle: t("dashboard.primaryCta.setupSubtitle"),
      cta: t("dashboard.primaryCta.setupButton"),
      action: "setup" as const,
      icon: Globe,
      gradient: "from-slate-500/10 to-slate-500/5",
    };
  }

  if (args.sessionStatus === "active" || args.sessionStatus === "planning") {
    return {
      title: t("dashboard.primaryCta.continueTitle"),
      subtitle: t("dashboard.primaryCta.continueSubtitle"),
      cta: t("dashboard.primaryCta.continueButton"),
      action: "session" as const,
      icon: Play,
      gradient: "from-emerald-500/10 to-sky-500/10",
    };
  }

  if (args.hasSavedPractice) {
    return {
      title: t("dashboard.primaryCta.startTitle"),
      subtitle: t("dashboard.primaryCta.resumeSubtitle"),
      cta: t("dashboard.primaryCta.resumeButton"),
      action: "practice" as const,
      icon: Play,
      gradient: "from-emerald-500/10 to-sky-500/10",
    };
  }

  const goalSubtitle =
    args.learningGoal === "exam"
      ? t("dashboard.primaryCta.startSubtitleExam")
      : t("dashboard.primaryCta.startSubtitleDefault");

  return {
    title: t("dashboard.primaryCta.startTitle"),
    subtitle: goalSubtitle,
    cta: t("dashboard.primaryCta.startButton"),
    action: "practice" as const,
    icon: Sparkles,
    gradient: "from-orange-500/10 to-purple-500/10",
  };
}

// Shared pill button with shimmer and warm orange gradient
function GradientPillButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative group/pill"
    >
      {/* Pill button */}
      <div className="relative px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 shadow-2xl shadow-orange-500/30 overflow-hidden">
        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          style={{ width: "40%" }}
        />

        <span className="relative flex items-center gap-3 text-white font-semibold text-base">
          <Icon className="w-5 h-5" />
          {label}
          <ArrowRight className="w-4 h-4 group-hover/pill:translate-x-1 transition-transform" />
        </span>
      </div>
    </motion.button>
  );
}

// Card-less / Airy CTA — subtitle + gradient pill, no duplicated title
function HybridCCardless({
  config,
  currentStreak,
  onAction,
}: {
  config: {
    title: string;
    subtitle: string;
    cta: string;
    action: PrimaryCtaAction;
    icon: React.ElementType;
  };
  currentStreak: number;
  onAction: (action: PrimaryCtaAction) => void;
}) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.5 }}
      className="relative"
    >
      <div className="flex flex-col items-center text-center gap-2 py-2">
        <GradientPillButton
          icon={config.icon}
          label={config.cta}
          onClick={() => onAction(config.action)}
        />
        {/* Streak badge */}
        {currentStreak > 0 && (
          <span className="text-sm text-orange-400 flex items-center gap-1.5 mt-1">
            <Flame className="w-4 h-4" />
            {currentStreak} {t("dashboard.stats.streak")}
          </span>
        )}
      </div>
    </motion.div>
  );
}
