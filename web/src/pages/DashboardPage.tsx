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
  Library,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CreditAlert } from "@/components/CreditAlert";
import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, type VideoItem } from "@/components/library/VideoCard";
import { Paywall } from "@/components/Paywall";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useStories } from "@/hooks/useStories";
import { LANGUAGES } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { buildSessionPlan, DURATION_OPTIONS, getSessionDescription } from "@/lib/sessionPlanner";
import { getRandomStudyPhrase } from "@/lib/studyPhrases";
import type { StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

// Floating stars component for background decoration
function FloatingStars({ count }: { count: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            left: `${(i * 17 + 5) % 100}%`,
            top: `${(i * 23 + 10) % 100}%`,
            opacity: 0.1 + (i % 4) * 0.1,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 3 + (i % 5),
            repeat: Infinity,
            delay: (i % 8) * 0.6,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}

// Animated background orbs
function AnimatedOrbs() {
  return (
    <>
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
        style={{
          background: "radial-gradient(circle, #ff8400 0%, transparent 70%)",
          top: "0%",
          left: "30%",
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full blur-[80px] opacity-15"
        style={{
          background: "radial-gradient(circle, #df91f7 0%, transparent 70%)",
          top: "20%",
          right: "20%",
        }}
        animate={{
          x: [0, -40, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[250px] h-[250px] rounded-full blur-[70px] opacity-15"
        style={{
          background: "radial-gradient(circle, #feed7a 0%, transparent 70%)",
          bottom: "30%",
          left: "10%",
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, -40, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

// Stat card with glass morphism and color-tinted hover glow
function StatCard({
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
      glow: "rgba(168,85,247,0.2)",
      gradient: "from-purple-500/10 via-transparent to-transparent",
    },
    blue: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      glow: "rgba(59,130,246,0.2)",
      gradient: "from-blue-500/10 via-transparent to-transparent",
    },
    orange: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      glow: "rgba(249,115,22,0.2)",
      gradient: "from-orange-500/10 via-transparent to-transparent",
    },
  };

  const styles = colorClasses[color];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ y: -4, boxShadow: `0 0 40px ${styles.glow}` }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
    >
      {/* Glass background */}
      <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-2xl" />
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

      {/* Color accent gradient on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      {/* Content */}
      <div className="relative p-5 text-center">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`w-12 h-12 rounded-xl ${styles.bg} flex items-center justify-center mx-auto mb-3`}
        >
          <Icon className={`w-6 h-6 ${styles.text}`} />
        </motion.div>
        <div className="text-3xl font-bold text-white">{value}</div>
        <div className="text-sm text-white/50 mt-1">{label}</div>
      </div>
    </motion.div>
  );

  if (isLink && to) {
    return <Link to={to}>{content}</Link>;
  }

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }

  return content;
}

export function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "anonymous";
  const navigate = useNavigate();
  const t = useT();

  const [selectedDuration, setSelectedDuration] = useState<number | null>(15);
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

  // Fetch user profile for streak
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Fetch streak data
  const streakData = useQuery(
    api.users.getStreak,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Fetch videos for recommendations
  const primaryLanguage = userProfile?.primaryLanguage ?? "japanese";

  // Get language info and random study phrase (stable per page load)
  const languageInfo = LANGUAGES.find((l) => l.value === primaryLanguage);
  const studyPhrase = useMemo(() => getRandomStudyPhrase(primaryLanguage), [primaryLanguage]);

  // Check subscription for premium content
  const subscription = useQuery(api.subscriptions.get, isAuthenticated ? { userId } : "skip");
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Check if user needs placement test for their primary language
  const needsPlacementTest =
    userProfile &&
    !userProfile.proficiencyLevels?.[primaryLanguage as keyof typeof userProfile.proficiencyLevels];

  const videos = useQuery(api.youtubeContent.list, { language: primaryLanguage }) as
    | VideoItem[]
    | undefined;

  // Fetch stories for recommendations
  const { data: allStories } = useStories();

  // Filter stories by user's language/level
  const suggestedStories =
    allStories
      ?.filter((story) => {
        if (primaryLanguage === "japanese") {
          return ["N5", "N4", "N3", "N2", "N1"].includes(story.level);
        }
        return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(story.level);
      })
      .slice(0, 10) ?? [];

  // Get suggested videos
  const suggestedVideos = videos?.slice(0, 4) ?? [];

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
  const vocabToReview = isPreviewMode
    ? 8
    : (vocabulary?.filter((v) => v.masteryState === "new" || v.masteryState === "learning")
        .length ?? 0);

  // Build session plan
  const firstVideo = videos?.[0];
  const recommendedContent = firstVideo
    ? {
        type: "video" as const,
        id: firstVideo._id,
        title: firstVideo.title,
        language: firstVideo.language,
      }
    : null;

  const sessionPlan = buildSessionPlan({
    dueCardCount: flashcardStats?.dueNow ?? 0,
    newCardCount: flashcardStats?.new ?? 0,
    vocabToReview,
    recommendedContent,
    selectedDuration,
  });

  const sessionDescription = getSessionDescription(sessionPlan);

  // Handle start studying
  const handleStartStudying = () => {
    if (needsPlacementTest) {
      navigate({ to: "/placement-test", search: { language: primaryLanguage } });
    } else {
      navigate({ to: "/study-session" });
    }
  };

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section - Now with animated orbs and stars */}
      <section className="relative pt-8 pb-16 overflow-hidden">
        {/* Animated background orbs */}
        <AnimatedOrbs />

        {/* Floating stars */}
        <FloatingStars count={12} />

        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isPreviewMode
                ? t("dashboard.preview.title")
                : t("dashboard.welcome", { name: user?.displayName?.split(" ")[0] ?? "" })}
            </h1>
            {isPreviewMode && (
              <p className="text-white/60 mt-3 text-lg">{t("dashboard.preview.subtitle")}</p>
            )}
          </motion.div>
        </div>

        {/* Fade-out gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        {/* Credit Alert */}
        {isAuthenticated && <CreditAlert />}

        <div className="space-y-8">
          {/* Start Studying CTA - Glass Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            whileHover={{ boxShadow: "0 0 60px rgba(255,132,0,0.15)" }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Glass background */}
            <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03] border border-white/10" />

            {/* Inner shadow for depth */}
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-3xl" />

            {/* Gradient accent overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-purple-500/5" />

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            {/* Content */}
            <div className="relative p-8 sm:p-10">
              {isPreviewMode ? (
                <PreviewStartStudying />
              ) : needsPlacementTest ? (
                <>
                  <div className="text-center mb-6">
                    <button
                      onClick={handleStartStudying}
                      className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-purple-500 dark:from-yellow-300 dark:via-orange-400 dark:to-purple-400 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
                    >
                      {/* Shimmer effect */}
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <span className="relative flex items-center justify-center gap-3">
                        <Target className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        {t("dashboard.cta.startPlacement")}
                      </span>
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium mb-2">{t("dashboard.cta.findLevel")}</p>
                    <p className="text-sm text-white/50 max-w-md mx-auto">
                      {t("dashboard.cta.placementExplainer")}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-white/60">
                        {languageInfo?.label}
                      </span>
                    </div>
                    <button
                      onClick={handleStartStudying}
                      className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-purple-500 dark:from-yellow-300 dark:via-orange-400 dark:to-purple-400 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
                    >
                      {/* Shimmer effect */}
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <span className="relative flex items-center justify-center gap-3">
                        <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        {studyPhrase}
                      </span>
                    </button>
                  </div>
                  <p className="text-center text-white/80 mb-6 font-medium">{sessionDescription}</p>
                  <div className="text-center">
                    <p className="text-sm text-white/50 mb-3">{t("dashboard.cta.durationQuestion")}</p>
                    <div className="flex justify-center gap-2">
                      {DURATION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() =>
                            setSelectedDuration(
                              selectedDuration === option.value ? null : option.value
                            )
                          }
                          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                            selectedDuration === option.value
                              ? "bg-accent text-white border-accent shadow-md shadow-accent/25"
                              : "bg-white/5 text-white/80 border-white/10 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Quick Stats - Glass Cards with Color Glows */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            {isPreviewMode ? (
              <>
                <SignInButton mode="modal">
                  <div className="w-full">
                    <StatCard
                      icon={Brain}
                      value={dueCards}
                      label={t("dashboard.stats.dueCards")}
                      color="purple"
                      index={0}
                    />
                  </div>
                </SignInButton>
                <SignInButton mode="modal">
                  <div className="w-full">
                    <StatCard
                      icon={BookmarkCheck}
                      value={totalWords}
                      label={t("dashboard.stats.words")}
                      color="blue"
                      index={1}
                    />
                  </div>
                </SignInButton>
                <SignInButton mode="modal">
                  <div className="w-full">
                    <StatCard
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
                <StatCard
                  icon={Brain}
                  value={dueCards}
                  label={t("dashboard.stats.dueCards")}
                  color="purple"
                  index={0}
                  isLink
                  to="/flashcards"
                />
                <StatCard
                  icon={BookmarkCheck}
                  value={totalWords}
                  label={t("dashboard.stats.words")}
                  color="blue"
                  index={1}
                  isLink
                  to="/vocabulary"
                />
                <StatCard
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

          {/* Suggested for You - Glass Section */}
          {(suggestedStories.length > 0 || suggestedVideos.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-3xl overflow-hidden"
            >
              {/* Glass background */}
              <div className="absolute inset-0 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-3xl" />

              <div className="relative p-6">
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
                      className="text-xl font-semibold text-white"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {t("dashboard.sections.suggestedForYou")}
                    </h2>
                  </div>
                  <Link
                    to="/library"
                    className="text-sm text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors"
                  >
                    {t("common.actions.viewAll")}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="text-sm text-white/50 mb-4">{t("dashboard.sections.popularPicks")}</p>

                {/* Stories */}
                {suggestedStories.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-white/80">
                        {t("dashboard.sections.stories")}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide lg:hidden">
                      {suggestedStories.map((story) => (
                        <div
                          key={story.id}
                          className="flex-shrink-0 w-[160px] [&>article]:border [&>article]:border-white/10 [&>article]:bg-white/[0.02]"
                        >
                          <StoryCard
                            story={story}
                            isPremiumUser={!!isPremiumUser}
                            onClick={() => handleStoryClick(story)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="hidden lg:grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {suggestedStories.map((story) => (
                        <div
                          key={story.id}
                          className="[&>article]:border [&>article]:border-white/10 [&>article]:bg-white/[0.02]"
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
                      <span className="text-sm font-medium text-white/80">
                        {t("dashboard.sections.videos")}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide items-stretch lg:hidden">
                      {suggestedVideos.map((video) => (
                        <div
                          key={video._id}
                          className="flex-shrink-0 w-[240px] [&>article]:border [&>article]:border-white/10 [&>article]:bg-white/[0.02] [&>article]:h-full"
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
                    <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {suggestedVideos.map((video) => (
                        <div
                          key={video._id}
                          className="[&>article]:border [&>article]:border-white/10 [&>article]:bg-white/[0.02] [&>article]:h-full"
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

          {/* Browse Library - Glass CTA */}
          <Link
            to="/library"
            className="group relative flex items-center justify-between p-5 rounded-2xl overflow-hidden"
          >
            {/* Glass background */}
            <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-white/10 group-hover:border-orange-500/30 transition-colors" />
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

            <div className="relative flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center"
              >
                <Library className="w-6 h-6 text-orange-400" />
              </motion.div>
              <div>
                <div className="font-medium text-white">{t("dashboard.sections.browseLibrary")}</div>
                <div className="text-sm text-white/50">
                  {t("dashboard.sections.libraryDescription")}
                </div>
              </div>
            </div>

            <ChevronRight className="relative w-5 h-5 text-white/30 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
          </Link>

          {/* Sign-Up CTA (Preview Mode) - Glass with dramatic glow */}
          {isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden"
            >
              {/* Glass background */}
              <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03] border border-white/10" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10" />

              {/* Floating particles */}
              <FloatingStars count={6} />

              <div className="relative p-8 text-center">
                <h2
                  className="text-xl font-bold text-white mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("dashboard.signUpCta.title")}
                </h2>
                <p className="text-white/60 mb-6 max-w-md mx-auto">
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
                <p className="text-sm text-white/40 mt-3">{t("dashboard.signUpCta.disclaimer")}</p>
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
      <p className="text-white font-medium mb-4">{t("dashboard.preview.reviewCards")}</p>
      <p className="text-sm text-white/50">{t("dashboard.preview.signInPrompt")}</p>
    </div>
  );
}

// Skeleton loading state
function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Section Skeleton */}
      <div className="relative pt-8 pb-16 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center">
            <div className="h-10 bg-white/5 rounded-full w-32 mx-auto mb-4 animate-pulse" />
            <div className="h-12 bg-white/5 rounded-lg w-64 mx-auto animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Start Studying CTA Skeleton */}
          <div className="rounded-3xl bg-white/[0.02] border border-white/10 p-8 sm:p-10">
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

          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 mx-auto mb-3 animate-pulse" />
                <div className="h-8 bg-white/5 rounded w-12 mx-auto mb-1 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-16 mx-auto animate-pulse" />
              </div>
            ))}
          </div>

          {/* Suggested Section Skeleton */}
          <div className="rounded-3xl bg-white/[0.02] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-6 bg-white/5 rounded w-40 animate-pulse" />
            </div>
            <div className="h-4 bg-white/5 rounded w-28 mb-4 animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[160px] rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden"
                >
                  <div className="aspect-[3/4] bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Browse Library Skeleton */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5">
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
