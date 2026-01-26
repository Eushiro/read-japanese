import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAudioUrl } from "@/api/stories";
import { Paywall } from "@/components/Paywall";
import { AudioPlayer } from "@/components/reader/AudioPlayer";
import { ChapterView } from "@/components/reader/ChapterView";
import { FuriganaText } from "@/components/reader/FuriganaText";
import { WordPopup } from "@/components/reader/WordPopup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useSettings } from "@/hooks/useSettings";
import { useStory } from "@/hooks/useStory";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { ProficiencyLevel, Token } from "@/types/story";
import { difficultyLevelToTestLevel, testLevelToDifficultyLevel } from "@/types/story";

import { api } from "../../convex/_generated/api";

type BadgeVariant = "n5" | "n4" | "n3" | "n2" | "n1" | "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

const levelVariantMap: Record<ProficiencyLevel, BadgeVariant> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
  A1: "a1",
  A2: "a2",
  B1: "b1",
  B2: "b2",
  C1: "c1",
  C2: "c2",
};

export function ReaderPage() {
  const { storyId, language } = useParams({ from: "/read/$language/$storyId" });
  const navigate = useNavigate();
  const t = useT();
  const { story, isLoading, error } = useStory(storyId, language as ContentLanguage);
  const { user, isAuthenticated } = useAuth();
  const { trackEvent, events } = useAnalytics();
  const userId = user?.id ?? "anonymous";

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedSegmentText, setSelectedSegmentText] = useState<string | undefined>(undefined);
  const [audioTime, setAudioTime] = useState(0);
  const [manualNavigation, setManualNavigation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Check for existing comprehension quiz (to avoid re-generating)
  const existingComprehension = useQuery(
    api.storyComprehension.getForStory,
    isAuthenticated ? { userId, storyId } : "skip"
  );

  // Check subscription for AI features
  const subscription = useQuery(api.subscriptions.get, isAuthenticated ? { userId } : "skip");
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Check if user can read stories (credit-based system now handles limits)
  // Legacy limit check removed - credits are checked at generation time
  const canReadStory = null as { allowed: boolean; used: number; limit: number } | null;
  const hasReachedStoryLimit = false;

  // Get user profile for proficiency level (needed for difficulty)
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Action to generate comprehension questions
  const generateQuestions = useAIAction(api.ai.generateComprehensionQuestions);
  const hasStartedGeneration = useRef(false);

  // Track story reading for usage limits
  const incrementUsage = useMutation(api.subscriptions.incrementUsage);
  const hasTrackedReading = useRef(false);

  // Reset scroll position when entering the reader or changing story
  useEffect(() => {
    window.scrollTo(0, 0);
    hasTrackedReading.current = false; // Reset tracking for new story
  }, [storyId]);

  // Track reader opened when story loads and increment usage
  // Only track if user has access (not blocked by premium check or limit)
  useEffect(() => {
    if (story && isAuthenticated && !hasTrackedReading.current) {
      // Check if this is a premium story the user can't access
      const storyIsPremium = story?.metadata?.isPremium ?? false;
      const userIsPremium = subscription?.tier && subscription.tier !== "free";
      const blockedByPremium = storyIsPremium && !userIsPremium;

      // Don't track if blocked
      if (blockedByPremium) {
        return;
      }

      hasTrackedReading.current = true;

      trackEvent(events.READER_OPENED, {
        story_id: storyId,
        story_title: story.metadata.title,
        level: story.metadata.level,
        chapter_count: story.chapters?.length ?? 1,
      });

      // Increment story reading usage for metering
      incrementUsage({
        userId,
        action: "readStory",
      }).catch((err) => {
        console.error("Failed to track story reading usage:", err);
      });
    }
  }, [
    story,
    isAuthenticated,
    subscription?.tier,
    trackEvent,
    events,
    storyId,
    incrementUsage,
    userId,
  ]);

  // Get settings from Convex
  const { settings, setShowFurigana } = useSettings();
  const showFurigana = settings.showFurigana;

  // Memoize chapters to avoid unstable dependency in effects
  const chapters = useMemo(() => story?.chapters || [], [story?.chapters]);
  const currentChapter = chapters[currentChapterIndex];
  const isOnLastChapter = currentChapterIndex === chapters.length - 1 && chapters.length > 0;

  // Pre-generate comprehension questions when reaching the last chapter
  useEffect(() => {
    // Only generate once per story visit
    if (hasStartedGeneration.current) return;
    // Must be on last chapter
    if (!isOnLastChapter) return;
    // Need story data and auth
    if (!story || !isAuthenticated) return;
    // Don't generate if quiz already exists
    if (existingComprehension !== undefined && existingComprehension !== null) return;
    // Wait for existingComprehension query to load
    if (existingComprehension === undefined) return;
    // Wait for subscription to load
    if (subscription === undefined) return;
    // Only pre-generate for premium users (AI features are paywalled)
    if (!isPremiumUser) return;

    hasStartedGeneration.current = true;

    // Get story content
    const getStoryContent = () => {
      const chaptersData = story.chapters || [];
      return chaptersData
        .map((chapter) => {
          const segments = chapter.segments || chapter.content || [];
          return segments
            .map((s) => {
              if (s.tokens && s.tokens.length > 0) {
                return s.tokens.map((t) => t.surface).join("");
              }
              return s.text || "";
            })
            .join(" ");
        })
        .join("\n\n");
    };

    // Derive language from story level
    const getLanguage = (): ContentLanguage => {
      const level = story.metadata.level;
      if (level.startsWith("N")) return "japanese";
      if (story.id.includes("french") || story.id.includes("fr_")) return "french";
      if (story.id.includes("english") || story.id.includes("en_")) return "english";
      return "english";
    };

    // Get user's difficulty level for the story's language
    const getUserDifficulty = (): number => {
      const language = getLanguage();
      const proficiency =
        userProfile?.proficiencyLevels?.[language as keyof typeof userProfile.proficiencyLevels];
      if (proficiency?.level) {
        return testLevelToDifficultyLevel(proficiency.level);
      }
      // Default to intermediate (3) if no level set
      return 3;
    };

    // Get user's display level
    const getUserDisplayLevel = (): string => {
      const language = getLanguage();
      const proficiency =
        userProfile?.proficiencyLevels?.[language as keyof typeof userProfile.proficiencyLevels];
      if (proficiency?.level) {
        return proficiency.level;
      }
      return difficultyLevelToTestLevel(3, language);
    };

    // Start generation in background (no await, fire and forget)
    generateQuestions({
      storyId,
      storyTitle: story.metadata.title,
      storyContent: getStoryContent(),
      language: getLanguage(),
      userId,
      difficulty: getUserDifficulty(),
      userLevel: getUserDisplayLevel(),
    }).catch((err) => {
      console.error("Background comprehension question generation failed:", err);
    });
  }, [
    isOnLastChapter,
    story,
    isAuthenticated,
    existingComprehension,
    storyId,
    userId,
    generateQuestions,
    subscription,
    isPremiumUser,
    userProfile,
  ]);

  // Use refs to access latest values in the time update callback without causing re-renders
  const chaptersRef = useRef(chapters);
  const currentChapterIndexRef = useRef(currentChapterIndex);
  const manualNavigationRef = useRef(manualNavigation);

  // Keep refs in sync
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);
  useEffect(() => {
    currentChapterIndexRef.current = currentChapterIndex;
  }, [currentChapterIndex]);
  useEffect(() => {
    manualNavigationRef.current = manualNavigation;
  }, [manualNavigation]);

  // Handle audio time updates - this callback is called by the external audio system
  const handleTimeUpdate = useCallback((newTime: number) => {
    setAudioTime(newTime);

    const currentChapters = chaptersRef.current;
    const currentIdx = currentChapterIndexRef.current;
    const isManualNav = manualNavigationRef.current;

    if (!currentChapters.length || newTime === 0) return;

    // Find which chapter contains the current audio time
    for (let i = 0; i < currentChapters.length; i++) {
      const chapter = currentChapters[i];
      const segments = chapter.segments || chapter.content || [];

      if (segments.length === 0) continue;

      const firstSegmentWithTime = segments.find((s) => s.audioStartTime !== undefined);
      const lastSegmentWithTime = [...segments].reverse().find((s) => s.audioEndTime !== undefined);

      if (!firstSegmentWithTime || !lastSegmentWithTime) continue;

      const chapterStart = firstSegmentWithTime.audioStartTime!;
      const chapterEnd = lastSegmentWithTime.audioEndTime!;

      if (newTime >= chapterStart && newTime <= chapterEnd) {
        // If in manual navigation mode, check if audio has caught up to re-enable auto-advance
        if (isManualNav && i === currentIdx) {
          setManualNavigation(false);
        }
        // Auto-advance chapters (skip if user manually navigated)
        if (!isManualNav && i !== currentIdx) {
          setCurrentChapterIndex(i);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        break;
      }
    }
  }, []);

  const handlePreviousChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setManualNavigation(true);
      setCurrentChapterIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      trackEvent(events.CHAPTER_CHANGED, {
        story_id: storyId,
        chapter_index: currentChapterIndex - 1,
        navigation_type: "manual",
      });
    }
  }, [currentChapterIndex, storyId, trackEvent, events]);

  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      setManualNavigation(true);
      setCurrentChapterIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      trackEvent(events.CHAPTER_CHANGED, {
        story_id: storyId,
        chapter_index: currentChapterIndex + 1,
        navigation_type: "manual",
      });
    }
  }, [currentChapterIndex, chapters.length, storyId, trackEvent, events]);

  const handleTakeQuiz = useCallback(() => {
    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    navigate({
      to: "/comprehension/$language/$storyId",
      params: { language, storyId: story?.id ?? storyId },
    });
  }, [isPremiumUser, navigate, story?.id, storyId, language]);

  const handleTokenClick = useCallback(
    (token: Token, event: React.MouseEvent, segmentText?: string) => {
      // Don't show popup for punctuation
      if (token.partOfSpeech === "punctuation" || token.partOfSpeech === "symbol") {
        return;
      }

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
      setSelectedToken(token);
      setSelectedSegmentText(segmentText);

      // Track word tap
      trackEvent(events.WORD_TAPPED, {
        word: token.surface,
        story_id: storyId,
        proficiency_level: token.proficiencyLevel,
      });
    },
    [storyId, trackEvent, events]
  );

  const handleClosePopup = useCallback(() => {
    setSelectedToken(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded-lg w-1/3" />
            <div className="h-6 bg-muted rounded-lg w-1/4" />
            <div className="aspect-[16/9] bg-muted rounded-xl" />
            <div className="space-y-3 pt-4">
              <div className="h-5 bg-muted rounded" />
              <div className="h-5 bg-muted rounded w-5/6" />
              <div className="h-5 bg-muted rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-foreground-muted">
            <p className="text-lg font-medium text-destructive">
              {error?.message || t("reader.errors.storyNotFound")}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/library" })}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("reader.navigation.backToLibrary")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show paywall if trying to access premium story without Basic+ subscription
  const isPremiumStory = story?.metadata?.isPremium ?? false;
  const needsPremiumAccess = isPremiumStory && !isPremiumUser;

  if (needsPremiumAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-accent" />
            </div>
            <h2
              className="text-2xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("reader.premium.title")}
            </h2>
            <p className="text-foreground-muted mb-6">{t("reader.premium.description")}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate({ to: "/library" })}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("reader.navigation.backToLibrary")}
              </Button>
              <Button onClick={() => setShowPaywall(true)}>
                {t("reader.premium.upgradePlan")}
              </Button>
            </div>
          </div>
        </div>
        <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
      </div>
    );
  }

  // Show paywall if user has reached their story reading limit
  if (hasReachedStoryLimit) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <BookOpen className="w-16 h-16 text-foreground-muted mb-4" />
            <h2
              className="text-2xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("reader.limit.title")}
            </h2>
            <p className="text-foreground-muted mb-6">
              {t("reader.limit.description", {
                used: canReadStory?.used ?? 0,
                limit: canReadStory?.limit ?? 0,
              })}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate({ to: "/library" })}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("reader.navigation.backToLibrary")}
              </Button>
              <Button onClick={() => setShowPaywall(true)}>
                {t("reader.premium.upgradePlan")}
              </Button>
            </div>
          </div>
        </div>
        <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background orbs */}
      <PremiumBackground colorScheme="warm" starCount={10} showOrbs={true} animateStars={false} />

      {/* Header - Non-sticky, blends with background */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/library" })}
                className="shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1
                  className="font-semibold text-foreground truncate"
                  style={{ fontFamily: "var(--font-japanese)" }}
                >
                  {story.metadata.titleTokens
                    ? story.metadata.titleTokens.map((token, i) => (
                        <FuriganaText
                          key={i}
                          token={token}
                          showFurigana={showFurigana}
                          onClick={(e) => handleTokenClick(token, e)}
                        />
                      ))
                    : story.metadata.titleJapanese || story.metadata.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Badge variant={levelVariantMap[story.metadata.level]} className="text-xs">
                    {story.metadata.level}
                  </Badge>
                  <span>{story.metadata.genre}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Player (compact in header) */}
              {story.metadata.audioURL && (
                <div className="hidden sm:block">
                  <AudioPlayer
                    src={getAudioUrl(story.metadata.audioURL)}
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
              )}

              {/* Furigana Toggle */}
              <button
                onClick={() => setShowFurigana(!showFurigana)}
                title={showFurigana ? t("reader.furigana.hide") : t("reader.furigana.show")}
                className={`relative px-2 py-1 rounded-lg transition-all ${
                  showFurigana
                    ? "bg-accent/10 text-accent"
                    : "bg-muted text-foreground-muted hover:bg-background-subtle"
                }`}
                style={{ fontFamily: "var(--font-japanese)" }}
              >
                <span className="text-[10px] block leading-none mb-0.5 opacity-70">
                  {showFurigana ? "あ" : ""}
                </span>
                {/* eslint-disable-next-line i18next/no-literal-string -- Kanji toggle icon */}
                <span className="text-sm font-medium leading-none">漢</span>
                {!showFurigana && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-6 h-[2px] bg-foreground-muted rotate-[-20deg] rounded-full" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Audio Player (shown below header on small screens) */}
          {story.metadata.audioURL && (
            <div className="sm:hidden mt-3">
              <AudioPlayer
                src={getAudioUrl(story.metadata.audioURL)}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Book-like reading area with glass morphism */}
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Glass background */}
          <div className="absolute inset-0 backdrop-blur-xl bg-background/80 border border-border dark:border-white/10 rounded-2xl" />
          <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

          {/* Content */}
          <div className="relative p-6 sm:p-8">
            {currentChapter ? (
              <ChapterView
                chapter={currentChapter}
                chapterIndex={currentChapterIndex}
                totalChapters={chapters.length}
                showFurigana={showFurigana}
                onTokenClick={handleTokenClick}
                currentAudioTime={story.metadata.audioURL ? audioTime : undefined}
                selectedToken={selectedToken}
                headerAction={
                  currentChapterIndex === chapters.length - 1 && chapters.length > 0 ? (
                    <Button onClick={handleTakeQuiz} className="gap-2" size="sm">
                      <BookOpen className="w-4 h-4" />
                      {t("reader.quiz.takeQuiz")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="text-center text-foreground-muted py-12">
                {t("reader.empty.noChapters")}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Chapter Navigation - Blends with background */}
      {chapters.length > 1 && (
        <nav className="relative z-10 py-4">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePreviousChapter}
                disabled={currentChapterIndex === 0}
                className="text-base font-medium !bg-background dark:!bg-background hover:!bg-muted dark:hover:!bg-muted border-border"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                {t("reader.navigation.previous")}
              </Button>

              <div className="flex items-center gap-2">
                {chapters.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setManualNavigation(true);
                      setCurrentChapterIndex(index);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentChapterIndex
                        ? "bg-accent w-6 shadow-[0_0_10px_rgba(255,132,0,0.5)]"
                        : "bg-foreground/20 hover:bg-foreground/30"
                    }`}
                    aria-label={t("reader.navigation.goToChapter", { number: index + 1 })}
                  />
                ))}
              </div>

              {currentChapterIndex === chapters.length - 1 ? (
                <Button onClick={handleTakeQuiz} size="lg" className="gap-1 text-base font-medium">
                  <BookOpen className="w-5 h-5" />
                  {t("reader.quiz.takeQuiz")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleNextChapter}
                  className="text-base font-medium !bg-background dark:!bg-background hover:!bg-muted dark:hover:!bg-muted border-border"
                >
                  {t("reader.navigation.next")}
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Word Popup */}
      {selectedToken && (
        <WordPopup
          token={selectedToken}
          position={popupPosition}
          storyId={story.id}
          storyTitle={story.metadata.title}
          sourceContext={selectedSegmentText}
          onClose={handleClosePopup}
        />
      )}

      {/* Paywall for AI features */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="sentences"
        title={t("reader.paywall.title")}
        description={t("reader.paywall.description")}
      />
    </div>
  );
}
