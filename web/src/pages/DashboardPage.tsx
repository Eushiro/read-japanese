import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
import { useMemo,useState } from "react";

import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, type VideoItem } from "@/components/library/VideoCard";
import { Paywall } from "@/components/Paywall";
import { useAuth } from "@/contexts/AuthContext";
import { useStories } from "@/hooks/useStories";
import { useT } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import { buildSessionPlan, DURATION_OPTIONS,getSessionDescription } from "@/lib/sessionPlanner";
import { getRandomStudyPhrase } from "@/lib/studyPhrases";
import type { StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

export function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "anonymous";
  const navigate = useNavigate();
  const t = useT();

  const [selectedDuration, setSelectedDuration] = useState<number | null>(15); // Default to 15 min
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
        // For Japanese: filter to JLPT levels
        if (primaryLanguage === "japanese") {
          return ["N5", "N4", "N3", "N2", "N1"].includes(story.level);
        }
        // For French/English: filter to CEFR levels
        return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(story.level);
      })
      .slice(0, 6) ?? [];

  // Get suggested videos
  const suggestedVideos = videos?.slice(0, 4) ?? [];

  // Handle story click with premium check
  const handleStoryClick = (story: StoryListItem) => {
    if (story.isPremium && !isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    navigate({ to: "/read/$storyId", params: { storyId: story.id } });
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
    ? { type: "video" as const, id: firstVideo._id, title: firstVideo.title }
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

  // Only show skeleton on initial auth load, not during navigation
  // Convex will return cached data quickly, and we use ?? fallbacks for values
  if (authLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-background to-purple-500/5" />
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl relative">
          <div className="animate-fade-in-up text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-purple-500/20">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-semibold text-accent uppercase tracking-wider">
                {t("dashboard.title")}
              </span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isPreviewMode
                ? t("dashboard.preview.title")
                : t("dashboard.welcome", { name: user?.displayName?.split(" ")[0] ?? "" })}
            </h1>
            {isPreviewMode && (
              <p className="text-foreground mb-6">{t("dashboard.preview.subtitle")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Start Studying CTA */}
          <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-purple-500/10 p-6 sm:p-8">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              {isPreviewMode ? (
                <PreviewStartStudying />
              ) : needsPlacementTest ? (
                <>
                  <div className="text-center mb-6">
                    <button
                      onClick={handleStartStudying}
                      className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                    >
                      <span className="flex items-center justify-center gap-3">
                        <Target className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        {t("dashboard.cta.startPlacement")}
                      </span>
                    </button>
                  </div>

                  {/* Placement test explanation */}
                  <div className="text-center">
                    <p className="text-foreground font-medium mb-2">
                      {t("dashboard.cta.findLevel")}
                    </p>
                    <p className="text-sm text-foreground-muted max-w-md mx-auto">
                      {t("dashboard.cta.placementExplainer")}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    {/* Language badge */}
                    <div className="flex justify-center mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-sm text-foreground-muted">
                        {languageInfo?.flag} {languageInfo?.label}
                      </span>
                    </div>
                    <button
                      onClick={handleStartStudying}
                      className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                    >
                      <span className="flex items-center justify-center gap-3">
                        <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        {studyPhrase}
                      </span>
                    </button>
                  </div>

                  {/* Session description */}
                  <p className="text-center text-foreground mb-6 font-medium">
                    {sessionDescription}
                  </p>

                  {/* Duration selection */}
                  <div className="text-center">
                    <p className="text-sm text-foreground mb-3">
                      {t("dashboard.cta.durationQuestion")}
                    </p>
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
                              : "bg-background/50 text-foreground border-border/50 hover:border-accent/50 hover:bg-accent/5"
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
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            {isPreviewMode ? (
              <SignInButton mode="modal">
                <button className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-500/20 p-4 text-center hover:border-purple-500/40 hover:from-purple-500/15 transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{dueCards}</div>
                  <div className="text-xs text-foreground/80">{t("dashboard.stats.dueCards")}</div>
                </button>
              </SignInButton>
            ) : (
              <Link
                to="/flashcards"
                className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-500/20 p-4 text-center hover:border-purple-500/40 hover:from-purple-500/15 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">{dueCards}</div>
                <div className="text-xs text-foreground/80">{t("dashboard.stats.dueCards")}</div>
              </Link>
            )}

            {isPreviewMode ? (
              <SignInButton mode="modal">
                <button className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl border border-blue-500/20 p-4 text-center hover:border-blue-500/40 hover:from-blue-500/15 transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                    <BookmarkCheck className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{totalWords}</div>
                  <div className="text-xs text-foreground/80">{t("dashboard.stats.words")}</div>
                </button>
              </SignInButton>
            ) : (
              <Link
                to="/vocabulary"
                className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl border border-blue-500/20 p-4 text-center hover:border-blue-500/40 hover:from-blue-500/15 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                  <BookmarkCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">{totalWords}</div>
                <div className="text-xs text-foreground/80">{t("dashboard.stats.words")}</div>
              </Link>
            )}

            {isPreviewMode ? (
              <SignInButton mode="modal">
                <button className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border border-orange-500/20 p-4 text-center hover:border-orange-500/40 hover:from-orange-500/15 transition-all cursor-pointer w-full">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{currentStreak}</div>
                  <div className="text-xs text-foreground/80">{t("dashboard.stats.streak")}</div>
                </button>
              </SignInButton>
            ) : (
              <button
                onClick={handleStreakClick}
                className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border border-orange-500/20 p-4 text-center hover:border-orange-500/40 hover:from-orange-500/15 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
                  <Flame
                    className={`w-5 h-5 text-orange-400 ${streakAnimating ? "animate-flame-shake text-orange-300" : ""}`}
                  />
                </div>
                <div className="text-2xl font-bold text-foreground">{currentStreak}</div>
                <div className="text-xs text-foreground/80">{t("dashboard.stats.streak")}</div>
              </button>
            )}
          </div>

          {/* Suggested for You */}
          {(suggestedStories.length > 0 || suggestedVideos.length > 0) && (
            <section className="bg-surface rounded-2xl border border-border p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  <h2
                    className="text-lg font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("dashboard.sections.suggestedForYou")}
                  </h2>
                </div>
                <Link
                  to="/library"
                  className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
                >
                  {t("common.actions.viewAll")}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-sm text-foreground mb-4">{t("dashboard.sections.popularPicks")}</p>

              {/* Stories */}
              {suggestedStories.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">
                      {t("dashboard.sections.stories")}
                    </span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                    {suggestedStories.map((story) => (
                      <div
                        key={story.id}
                        className="flex-shrink-0 w-[160px] [&>article]:border [&>article]:border-border [&>article]:bg-background"
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
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide items-stretch">
                    {suggestedVideos.map((video) => (
                      <div
                        key={video._id}
                        className="flex-shrink-0 w-[240px] [&>article]:border [&>article]:border-border [&>article]:bg-background [&>article]:h-full"
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
            </section>
          )}

          {/* Browse Library */}
          <Link
            to="/library"
            className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/10 to-transparent rounded-xl border border-accent/20 hover:border-accent/40 hover:from-accent/15 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Library className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {t("dashboard.sections.browseLibrary")}
                </div>
                <div className="text-sm text-foreground/90">
                  {t("dashboard.sections.libraryDescription")}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-accent/60 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* CTA for preview mode */}
          {isPreviewMode && (
            <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20 p-6 text-center">
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
                <button className="group relative px-8 py-4 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {t("dashboard.signUpCta.button")}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </SignInButton>
              <p className="text-sm text-foreground mt-3">{t("dashboard.signUpCta.disclaimer")}</p>
            </div>
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
  return (
    <div className="text-center">
      <div className="mb-6">
        <SignInButton mode="modal">
          <button className="group relative w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-[length:200%_100%] animate-gradient-x shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
            <span className="flex items-center justify-center gap-3">
              <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
              Start Studying
            </span>
          </button>
        </SignInButton>
      </div>
      <p className="text-foreground font-medium mb-4">Review cards, read a story</p>
      <p className="text-sm text-foreground">Sign in to track your progress</p>
    </div>
  );
}

// Skeleton loading state
function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Section Skeleton */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl">
          <div className="text-center">
            <div className="h-8 sm:h-9 bg-border rounded-lg w-48 mx-auto animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Start Studying CTA Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <div className="text-center space-y-4">
              <div className="h-12 bg-border rounded-xl w-40 mx-auto animate-pulse" />
              <div className="h-5 bg-border rounded w-48 mx-auto animate-pulse" />
              <div className="flex justify-center gap-2 pt-2">
                <div className="h-10 bg-border rounded-xl w-16 animate-pulse" />
                <div className="h-10 bg-border rounded-xl w-16 animate-pulse" />
                <div className="h-10 bg-border rounded-xl w-16 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4 text-center">
                <div className="w-10 h-10 rounded-lg bg-border mx-auto mb-2 animate-pulse" />
                <div className="h-7 bg-border rounded w-12 mx-auto mb-1 animate-pulse" />
                <div className="h-4 bg-border rounded w-16 mx-auto animate-pulse" />
              </div>
            ))}
          </div>

          {/* Suggested Section Skeleton */}
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-border rounded animate-pulse" />
              <div className="h-5 bg-border rounded w-32 animate-pulse" />
            </div>
            <div className="h-4 bg-border rounded w-24 mb-4 animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[160px] rounded-xl border border-border bg-background overflow-hidden"
                >
                  <div className="aspect-[3/4] bg-border animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Browse Library Skeleton */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-border animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-border rounded w-28 animate-pulse" />
                <div className="h-4 bg-border rounded w-44 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
