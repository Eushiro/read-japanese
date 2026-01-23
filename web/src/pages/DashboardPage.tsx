import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth, SignInButton } from "@/contexts/AuthContext";
import { LearningLoopViz } from "@/components/dashboard/LearningLoopViz";
import { Button } from "@/components/ui/button";
import { Loader2, Home, BookOpen, Brain, PenLine, Sparkles, ChevronRight, ArrowRight, Target, Library, Play } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStories } from "@/hooks/useStories";
import { useRecommendedStories } from "@/hooks/useRecommendedStories";
import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, type VideoItem } from "@/components/library/VideoCard";

// Sample data for preview mode (logged-out users)
const SAMPLE_STATS = {
  contentConsumed: 12,
  wordsSaved: 247,
  cardsReviewed: 156,
  sentencesWritten: 34,
};

const SAMPLE_ACTIVITIES = {
  dueCards: 15,
  wordsToPractice: 8,
  totalWords: 247,
  masteredWords: 89,
  totalFlashcards: 203,
};

export function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? "anonymous";
  const navigate = useNavigate();

  // Fetch flashcard stats (only when authenticated)
  const flashcardStats = useQuery(
    api.flashcards.getStats,
    isAuthenticated ? { userId } : "skip"
  );

  // Fetch vocabulary (only when authenticated)
  const vocabulary = useQuery(
    api.vocabulary.list,
    isAuthenticated ? { userId } : "skip"
  );

  // Fetch user profile for proficiency levels
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Fetch stories for recommendations
  const { data: allStories } = useStories();
  const primaryLanguage = (userProfile?.primaryLanguage ?? "japanese") as "japanese" | "english" | "french";
  const { stories: recommendedStories, reason: recommendationReason } = useRecommendedStories(
    allStories,
    userProfile,
    primaryLanguage
  );

  // Fetch videos for recommendations
  const videos = useQuery(
    api.youtubeContent.list,
    { language: primaryLanguage }
  ) as VideoItem[] | undefined;
  const recommendedVideos = (videos ?? []).slice(0, 4);

  // Check subscription for premium status
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const devPremiumOverride = typeof window !== "undefined" && localStorage.getItem("isPremiumUser") === "true";
  const isPremiumUser = devPremiumOverride || (subscription?.tier && subscription.tier !== "free");

  // Calculate stats - use real data for authenticated, sample for preview
  const isPreviewMode = !isAuthenticated;

  const dueCards = isPreviewMode ? SAMPLE_ACTIVITIES.dueCards : (flashcardStats?.dueNow ?? 0);
  const wordsToPractice = isPreviewMode
    ? SAMPLE_ACTIVITIES.wordsToPractice
    : (vocabulary?.filter((v) => v.masteryState === "new" || v.masteryState === "learning").length ?? 0);
  const totalWords = isPreviewMode ? SAMPLE_ACTIVITIES.totalWords : (vocabulary?.length ?? 0);
  const masteredWords = isPreviewMode
    ? SAMPLE_ACTIVITIES.masteredWords
    : (vocabulary?.filter((v) => v.masteryState === "mastered").length ?? 0);
  const totalFlashcards = isPreviewMode ? SAMPLE_ACTIVITIES.totalFlashcards : (flashcardStats?.total ?? 0);

  // Calculate learning loop stats
  const loopStats = isPreviewMode ? SAMPLE_STATS : {
    contentConsumed: 0, // TODO: Track from reading/listening progress
    wordsSaved: totalWords,
    cardsReviewed: flashcardStats?.review ?? 0,
    sentencesWritten: 0, // TODO: Track from user sentences
  };

  // Loading state only for authenticated users
  if (isAuthenticated && (flashcardStats === undefined || vocabulary === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Home className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                {isPreviewMode ? "Preview" : "Dashboard"}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isPreviewMode ? "Your Learning Dashboard" : `Welcome back, ${user?.displayName?.split(" ")[0] || "learner"}`}
            </h1>
            <p className="text-foreground-muted text-lg mb-3">
              {isPreviewMode
                ? "See how SanLang helps you master vocabulary through a proven learning loop"
                : "Continue your learning journey"
              }
            </p>

            {/* Inline Stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span><strong className="text-foreground">{totalWords}</strong> <span className="text-foreground-muted">words</span></span>
              <span className="text-foreground-muted">·</span>
              <span><strong className="text-green-500">{masteredWords}</strong> <span className="text-foreground-muted">mastered</span></span>
              <span className="text-foreground-muted">·</span>
              <span><strong className="text-accent">{dueCards}</strong> <span className="text-foreground-muted">due</span></span>
              {isPreviewMode && (
                <>
                  <span className="text-foreground-muted">·</span>
                  <span className="text-foreground-muted text-xs">Sample data</span>
                </>
              )}
            </div>

            {/* CTA for preview mode */}
            {isPreviewMode && (
              <div className="mt-6">
                <SignInButton mode="modal">
                  <Button size="lg" className="gap-2">
                    <Sparkles className="w-5 h-5" />
                    Try it Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </SignInButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Placement Test Section - Only for authenticated users */}
          {!isPreviewMode && (
            <PlacementTestSection
              userProfile={userProfile}
              onTakeTest={(lang) => navigate({ to: "/placement-test", search: { language: lang } })}
            />
          )}

          {/* Today's Activities */}
          {isPreviewMode ? (
            <PreviewActivities dueCards={dueCards} wordsToPractice={wordsToPractice} />
          ) : (
            <AuthenticatedActivities
              dueCards={dueCards}
              wordsToPractice={wordsToPractice}
              totalWords={totalWords}
            />
          )}

          {/* Recommended Content */}
          {(recommendedStories.length > 0 || recommendedVideos.length > 0) && (
            <RecommendedContentSection
              stories={recommendedStories}
              videos={recommendedVideos}
              reason={recommendationReason}
              isPremiumUser={!!isPremiumUser}
              onStoryClick={(storyId) => navigate({ to: "/read/$storyId", params: { storyId } })}
              onVideoClick={(videoId) => navigate({ to: "/video/$videoId", params: { videoId } })}
            />
          )}

          {/* Learning Loop Visualization */}
          <LearningLoopViz stats={loopStats} />

          {/* Getting Started / CTA Section */}
          {isPreviewMode ? (
            <PreviewCTA />
          ) : totalWords === 0 ? (
            <GettingStarted />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Preview Activities for logged-out users
function PreviewActivities({ dueCards, wordsToPractice }: { dueCards: number; wordsToPractice: number }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2
        className="text-lg font-semibold text-foreground mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Today's Activities
      </h2>

      <div className="space-y-3">
        {/* Due flashcards */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">
                {dueCards} flashcards due
              </div>
              <div className="text-sm text-foreground-muted">
                Review to strengthen memory
              </div>
            </div>
          </div>
          <SignInButton mode="modal">
            <Button size="sm">
              Try it Free
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </SignInButton>
        </div>

        {/* Words to practice */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">
                {wordsToPractice} words to practice
              </div>
              <div className="text-sm text-foreground-muted">
                Write sentences to master vocabulary
              </div>
            </div>
          </div>
          <SignInButton mode="modal">
            <Button size="sm" variant="outline">
              Try it Free
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </SignInButton>
        </div>

        {/* Continue reading */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">
                Continue reading
              </div>
              <div className="text-sm text-foreground-muted">
                Graded stories at your level
              </div>
            </div>
          </div>
          <Link to="/library">
            <Button size="sm" variant="outline">
              Browse
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Authenticated Activities
function AuthenticatedActivities({
  dueCards,
  wordsToPractice,
  totalWords
}: {
  dueCards: number;
  wordsToPractice: number;
  totalWords: number;
}) {
  const hasActivities = dueCards > 0 || wordsToPractice > 0;

  if (!hasActivities && totalWords === 0) {
    return null; // Will show Getting Started instead
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2
        className="text-lg font-semibold text-foreground mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Today's Activities
      </h2>

      {!hasActivities ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-foreground-muted">
            All caught up! Read a story to discover new words.
          </p>
          <Link to="/library">
            <Button variant="outline" className="mt-4">
              <BookOpen className="w-4 h-4 mr-2" />
              Browse Library
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {dueCards > 0 && (
            <Link
              to="/learn?tab=review"
              className="flex items-center justify-between p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {dueCards} flashcard{dueCards !== 1 ? "s" : ""} due
                  </div>
                  <div className="text-sm text-foreground-muted">
                    Review to strengthen memory
                  </div>
                </div>
              </div>
              <Button size="sm" className="group-hover:bg-accent">
                Review
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}

          {wordsToPractice > 0 && (
            <Link
              to="/learn?tab=practice"
              className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <PenLine className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {wordsToPractice} word{wordsToPractice !== 1 ? "s" : ""} to practice
                  </div>
                  <div className="text-sm text-foreground-muted">
                    Write sentences to master vocabulary
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="group-hover:border-accent group-hover:text-accent">
                Practice
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Preview CTA section
function PreviewCTA() {
  return (
    <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20 p-6 text-center">
      <h2
        className="text-xl font-bold text-foreground mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Ready to start learning?
      </h2>
      <p className="text-foreground-muted mb-6 max-w-md mx-auto">
        Join for free and start building your vocabulary with AI-powered flashcards and personalized practice.
      </p>
      <SignInButton mode="modal">
        <Button size="lg" className="gap-2">
          <Sparkles className="w-5 h-5" />
          Try it Free
          <ArrowRight className="w-4 h-4" />
        </Button>
      </SignInButton>
      <p className="text-xs text-foreground-muted mt-3">
        No credit card required
      </p>
    </div>
  );
}

// Getting Started for new authenticated users
function GettingStarted() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2
        className="text-lg font-semibold text-foreground mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Getting Started
      </h2>
      <div className="space-y-4">
        <p className="text-foreground-muted">
          Welcome to SanLang! Here's how to begin your learning journey:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/library"
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">Read Stories</div>
              <div className="text-sm text-foreground-muted">
                Browse graded content at your level
              </div>
            </div>
          </Link>
          <Link
            to="/learn?tab=words"
            className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">Add Vocabulary</div>
              <div className="text-sm text-foreground-muted">
                Build your personal word list
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Placement Test Section
const LANGUAGE_CONFIG = {
  japanese: { flag: "\u{1F1EF}\u{1F1F5}", name: "Japanese", levels: ["N5", "N4", "N3", "N2", "N1"] },
  english: { flag: "\u{1F1EC}\u{1F1E7}", name: "English", levels: ["A1", "A2", "B1", "B2", "C1", "C2"] },
  french: { flag: "\u{1F1EB}\u{1F1F7}", name: "French", levels: ["A1", "A2", "B1", "B2", "C1", "C2"] },
} as const;

type Language = keyof typeof LANGUAGE_CONFIG;

interface UserProfile {
  languages?: string[];
  proficiencyLevels?: {
    japanese?: { level: string; assessedAt: number };
    english?: { level: string; assessedAt: number };
    french?: { level: string; assessedAt: number };
  };
}

function PlacementTestSection({
  userProfile,
  onTakeTest,
}: {
  userProfile: UserProfile | null | undefined;
  onTakeTest: (language: Language) => void;
}) {
  // Get user's languages, default to japanese if none set
  const userLanguages = (userProfile?.languages ?? ["japanese"]) as Language[];
  const proficiencyLevels = userProfile?.proficiencyLevels;

  // Check if any language needs a test
  const languagesWithoutLevel = userLanguages.filter(
    (lang) => !proficiencyLevels?.[lang]?.level
  );

  // If all languages have levels, show compact view
  if (languagesWithoutLevel.length === 0 && proficiencyLevels) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold text-foreground flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Target className="w-5 h-5 text-accent" />
            Your Levels
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {userLanguages.map((lang) => {
            const config = LANGUAGE_CONFIG[lang];
            const level = proficiencyLevels[lang]?.level;
            if (!level) return null;

            return (
              <button
                key={lang}
                onClick={() => onTakeTest(lang)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/5 border border-accent/20 hover:bg-accent/10 transition-colors"
              >
                <span>{config.flag}</span>
                <span className="font-medium text-foreground">{config.name}</span>
                <span className="text-lg font-bold text-accent">{level}</span>
                <span className="text-xs text-foreground-muted ml-1">Retake</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Show prompt to take placement test
  return (
    <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <Target className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1">
          <h2
            className="text-lg font-semibold text-foreground mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Know Your Level
          </h2>
          <p className="text-sm text-foreground-muted mb-4">
            Take an adaptive placement test to personalize your learning experience.
            Questions adjust to your level for accurate assessment.
          </p>
          <div className="flex flex-wrap gap-2">
            {languagesWithoutLevel.map((lang) => {
              const config = LANGUAGE_CONFIG[lang];
              return (
                <Button
                  key={lang}
                  size="sm"
                  onClick={() => onTakeTest(lang)}
                  className="gap-2"
                >
                  <span>{config.flag}</span>
                  Take {config.name} Test
                  <ChevronRight className="w-4 h-4" />
                </Button>
              );
            })}
            {userLanguages
              .filter((lang) => proficiencyLevels?.[lang]?.level)
              .map((lang) => {
                const config = LANGUAGE_CONFIG[lang];
                const level = proficiencyLevels?.[lang]?.level;
                return (
                  <Button
                    key={lang}
                    size="sm"
                    variant="outline"
                    onClick={() => onTakeTest(lang)}
                    className="gap-2"
                  >
                    <span>{config.flag}</span>
                    {level}
                    <span className="text-xs text-foreground-muted">Retake</span>
                  </Button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Recommended Content Section (Stories + Videos)
function RecommendedContentSection({
  stories,
  videos,
  reason,
  isPremiumUser,
  onStoryClick,
  onVideoClick,
}: {
  stories: import("@/types/story").StoryListItem[];
  videos: VideoItem[];
  reason: string;
  isPremiumUser: boolean;
  onStoryClick: (storyId: string) => void;
  onVideoClick: (videoId: string) => void;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-lg font-semibold text-foreground flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Library className="w-5 h-5 text-accent" />
            Suggested for You
          </h2>
          {reason && (
            <p className="text-sm text-foreground-muted mt-0.5">{reason}</p>
          )}
        </div>
        <Link to="/library">
          <Button variant="ghost" size="sm" className="gap-1">
            See all
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Stories */}
      {stories.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm font-medium text-foreground-muted">Stories</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible scrollbar-hide">
            {stories.map((story) => (
              <div key={story.id} className="flex-shrink-0 w-40 sm:w-auto">
                <StoryCard
                  story={story}
                  isPremiumUser={isPremiumUser}
                  onClick={() => onStoryClick(story.id)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <>
          <div className={`flex items-center gap-2 mb-3 ${stories.length > 0 ? "mt-6" : ""}`}>
            <Play className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm font-medium text-foreground-muted">Videos</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible scrollbar-hide">
            {videos.map((video) => (
              <div key={video._id} className="flex-shrink-0 w-56 sm:w-auto">
                <VideoCard
                  video={video}
                  onClick={() => onVideoClick(video._id)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
