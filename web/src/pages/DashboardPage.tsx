import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth, SignInButton } from "@/contexts/AuthContext";
import { LearningLoopViz } from "@/components/dashboard/LearningLoopViz";
import { Button } from "@/components/ui/button";
import { Loader2, Home, BookOpen, Brain, PenLine, Sparkles, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
              {isPreviewMode ? "Your Learning Dashboard" : "Welcome back"}
            </h1>
            <p className="text-foreground-muted text-lg">
              {isPreviewMode
                ? "See how SanLang helps you master vocabulary through a proven learning loop"
                : "Continue your learning journey"
              }
            </p>

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

      {/* Quick Stats Bar */}
      <div className="border-b border-border bg-surface">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="flex flex-wrap gap-6 sm:gap-10">
            <div>
              <div className="text-2xl font-bold text-foreground">{totalWords}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">
                Words Saved
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{masteredWords}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">
                Mastered
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">{totalFlashcards}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">
                Flashcards
              </div>
            </div>
            <div className="ml-auto">
              <div className="text-2xl font-bold text-accent">{dueCards}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">
                Due Now
              </div>
            </div>
          </div>
          {isPreviewMode && (
            <div className="mt-2 text-xs text-foreground-muted">
              Sample data shown • Sign up to track your own progress
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Daily Activities - Different for preview vs authenticated */}
          {isPreviewMode ? (
            <PreviewActivities dueCards={dueCards} wordsToPractice={wordsToPractice} />
          ) : (
            <AuthenticatedActivities
              dueCards={dueCards}
              wordsToPractice={wordsToPractice}
              totalWords={totalWords}
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

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-3">
            {isPreviewMode ? (
              <>
                <PreviewActionCard
                  icon={BookOpen}
                  iconColor="text-amber-500"
                  bgColor="bg-amber-500/10"
                  title="Vocabulary"
                  subtitle={`${totalWords} words`}
                />
                <PreviewActionCard
                  icon={Brain}
                  iconColor="text-purple-500"
                  bgColor="bg-purple-500/10"
                  title="Review"
                  subtitle={`${dueCards} due`}
                />
                <PreviewActionCard
                  icon={PenLine}
                  iconColor="text-green-500"
                  bgColor="bg-green-500/10"
                  title="Practice"
                  subtitle={`${wordsToPractice} to practice`}
                />
              </>
            ) : (
              <>
                <Link
                  to="/learn?tab=words"
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-colors text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-amber-500" />
                  </div>
                  <span className="font-medium text-foreground">Vocabulary</span>
                  <span className="text-sm text-foreground-muted">{totalWords} words</span>
                </Link>
                <Link
                  to="/learn?tab=review"
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-colors text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-purple-500" />
                  </div>
                  <span className="font-medium text-foreground">Review</span>
                  <span className="text-sm text-foreground-muted">{dueCards} due</span>
                </Link>
                <Link
                  to="/learn?tab=practice"
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-colors text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <PenLine className="w-6 h-6 text-green-500" />
                  </div>
                  <span className="font-medium text-foreground">Practice</span>
                  <span className="text-sm text-foreground-muted">{wordsToPractice} to practice</span>
                </Link>
              </>
            )}
          </div>
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

// Preview Action Card (non-clickable, with sign-up CTA)
function PreviewActionCard({
  icon: Icon,
  iconColor,
  bgColor,
  title,
  subtitle
}: {
  icon: typeof BookOpen;
  iconColor: string;
  bgColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <SignInButton mode="modal">
      <button className="flex flex-col items-center gap-2 p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-colors text-center w-full">
        <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-sm text-foreground-muted">{subtitle}</span>
        <span className="text-xs text-accent mt-1">Try it Free</span>
      </button>
    </SignInButton>
  );
}
