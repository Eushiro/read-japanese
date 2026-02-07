import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Brain,
  ChevronRight,
  Flame,
  Globe,
  MessageCircle,
  Play,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { useState } from "react";

import { CreditAlert } from "@/components/CreditAlert";
import { SkillsSection } from "@/components/dashboard/SkillsSection";
import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, type VideoItem } from "@/components/library/VideoCard";
import { Paywall } from "@/components/Paywall";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useStudySession } from "@/contexts/StudySessionContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useRecommendedStories } from "@/hooks/useRecommendedStories";
import { useRecommendedVideos } from "@/hooks/useRecommendedVideos";
import { useStoriesByLanguage } from "@/hooks/useStories";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

// Floating stat - no borders, just icons, numbers, and labels
function FloatingStat({
  icon: Icon,
  value,
  label,
  color,
  onClick,
  index,
  isLink,
  to,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: "purple" | "blue" | "orange";
  onClick?: () => void;
  index: number;
  isLink?: boolean;
  to?: string;
}) {
  const colorClasses = {
    purple: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      glow: "0 0 40px rgba(168,85,247,0.3)",
    },
    blue: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      glow: "0 0 40px rgba(59,130,246,0.3)",
    },
    orange: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      glow: "0 0 40px rgba(249,115,22,0.3)",
    },
  };

  const styles = colorClasses[color];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ y: -4 }}
      className="group relative cursor-pointer text-center px-4 py-3"
    >
      {/* Glow effect on hover - no borders */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: styles.glow }}
      />

      {/* Content - flowing layout */}
      <div className="relative flex flex-col items-center gap-2">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${styles.bg} flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${styles.text}`} />
        </motion.div>
        <div className="text-2xl sm:text-3xl font-bold text-foreground">{value}</div>
        <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
      </div>
    </motion.div>
  );

  if (isLink && to) {
    return <Link to={to}>{content}</Link>;
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="text-center">
        {content}
      </button>
    );
  }

  return content;
}

export function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "anonymous";
  const navigate = useNavigate();
  const t = useT();
  const { state: sessionState } = useStudySession();

  const [streakAnimating, setStreakAnimating] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleStreakClick = () => {
    setStreakAnimating(true);
    setTimeout(() => setStreakAnimating(false), 600);
  };

  // Fetch flashcard stats
  const flashcardStats = useQuery(api.flashcards.getStats, isAuthenticated ? { userId } : "skip");

  // Fetch vocabulary
  const vocabulary = useQuery(api.vocabulary.list, isAuthenticated ? { userId } : "skip");

  // User profile and subscription from shared context (prevents refetching on navigation)
  const { userProfile, isPremium: isPremiumUser, isLoading: isUserDataLoading } = useUserData();

  // Get user languages from shared context
  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];

  // Get primary language for adaptive content (first user language or default to japanese)
  const primaryLanguage = userLanguages[0] ?? "japanese";

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
  const dueCards = isPreviewMode ? 12 : (flashcardStats?.dueNow ?? 0) + (flashcardStats?.new ?? 0);
  const totalWords = isPreviewMode ? 247 : (vocabulary?.length ?? 0);
  const currentStreak = isPreviewMode ? 3 : (streakData?.currentStreak ?? 0);

  // Get user's learning goal for goal-aware stats
  const learningGoal = userProfile?.learningGoal;

  // Goal-specific stat configuration
  const getGoalAwareStat = () => {
    switch (learningGoal) {
      case "travel":
        // For travel: show phrases instead of raw word count
        return {
          icon: MessageCircle,
          value: Math.floor(totalWords * 0.6), // Estimate conversational phrases
          label: t("dashboard.stats.phrases"),
          color: "blue" as const,
          to: "/learn?tab=words",
        };
      case "media":
        // For media: emphasize listening content
        return {
          icon: BookmarkCheck,
          value: totalWords,
          label: t("dashboard.stats.words"),
          color: "blue" as const,
          to: "/learn?tab=words",
        };
      case "professional":
        // For professional: show business terms
        return {
          icon: BookmarkCheck,
          value: totalWords,
          label: t("dashboard.stats.businessTerms"),
          color: "blue" as const,
          to: "/learn?tab=words",
        };
      default:
        // Default: words
        return {
          icon: BookmarkCheck,
          value: totalWords,
          label: t("dashboard.stats.words"),
          color: "blue" as const,
          to: "/learn?tab=words",
        };
    }
  };

  const goalStat = getGoalAwareStat();

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
              <p className="text-muted-foreground mt-3 text-lg">
                {t("dashboard.preview.subtitle")}
              </p>
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
            <HybridCCardless
              config={getPrimaryCtaConfig({
                hasLanguages: userLanguages.length > 0,
                sessionStatus: sessionState.status,
                learningGoal: userProfile?.learningGoal,
                t,
              })}
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
          )}

          {/* Quick Stats - Floating horizontal row with subtle dividers */}
          <div className="flex justify-center items-center gap-4 sm:gap-8 lg:gap-12">
            {isPreviewMode ? (
              <>
                <SignInButton mode="modal">
                  <div>
                    <FloatingStat
                      icon={Brain}
                      value={dueCards}
                      label={t("dashboard.stats.dueCards")}
                      color="purple"
                      index={0}
                    />
                  </div>
                </SignInButton>
                <div className="w-px h-12 bg-border" />
                <SignInButton mode="modal">
                  <div>
                    <FloatingStat
                      icon={BookmarkCheck}
                      value={totalWords}
                      label={t("dashboard.stats.words")}
                      color="blue"
                      index={1}
                    />
                  </div>
                </SignInButton>
                <div className="w-px h-12 bg-border" />
                <SignInButton mode="modal">
                  <div>
                    <FloatingStat
                      icon={Flame}
                      value={currentStreak}
                      label={t("dashboard.stats.streak")}
                      color="orange"
                      index={2}
                    />
                  </div>
                </SignInButton>
              </>
            ) : (
              <>
                <FloatingStat
                  icon={Brain}
                  value={dueCards}
                  label={t("dashboard.stats.dueCards")}
                  color="purple"
                  index={0}
                  isLink
                  to="/learn?tab=review"
                />
                <div className="w-px h-12 bg-border" />
                <FloatingStat
                  icon={goalStat.icon}
                  value={goalStat.value}
                  label={goalStat.label}
                  color={goalStat.color}
                  index={1}
                  isLink
                  to={goalStat.to}
                />
                <div className="w-px h-12 bg-border" />
                <FloatingStat
                  icon={streakAnimating ? Flame : Flame}
                  value={currentStreak}
                  label={t("dashboard.stats.streak")}
                  color="orange"
                  index={2}
                  onClick={handleStreakClick}
                />
              </>
            )}
          </div>

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
                    className="text-sm text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors"
                  >
                    {t("common.actions.viewAll")}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {storyReason || t("dashboard.sections.popularPicks")}
                </p>

                {/* Stories */}
                {suggestedStories.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-foreground/80">
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
                      <span className="text-sm font-medium text-foreground/80">
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
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
                <p className="text-sm text-muted-foreground mt-3">
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
      <p className="text-sm text-muted-foreground">{t("dashboard.preview.signInPrompt")}</p>
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

          {/* Quick Stats Skeleton - Floating row */}
          <div className="flex justify-center items-center gap-8 lg:gap-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 px-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-8 bg-white/5 rounded w-12 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-16 animate-pulse" />
              </div>
            ))}
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

// Shared pill button with orbiting dot, shimmer, and gradient
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
      {/* Orbiting dot */}
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-[#feed7a] shadow-[0_0_8px_rgba(254,237,122,0.6)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          top: "50%",
          left: "50%",
          transformOrigin: "-60px 0px",
        }}
      />

      {/* Pill button */}
      <div className="relative px-8 py-4 rounded-full bg-gradient-to-r from-[#ff8400] to-[#df91f7] shadow-xl shadow-[#ff8400]/20 overflow-hidden">
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
  onAction,
}: {
  config: {
    title: string;
    subtitle: string;
    cta: string;
    action: PrimaryCtaAction;
    icon: React.ElementType;
  };
  onAction: (action: PrimaryCtaAction) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.5 }}
      className="relative"
    >
      <div className="flex flex-col items-center text-center gap-2 py-2">
        <p className="text-foreground/60 text-base">{config.subtitle}</p>
        <GradientPillButton
          icon={config.icon}
          label={config.cta}
          onClick={() => onAction(config.action)}
        />
      </div>
    </motion.div>
  );
}
