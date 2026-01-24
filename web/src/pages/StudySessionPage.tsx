import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, BookOpen, ChevronRight, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SessionComplete } from "@/components/session/SessionComplete";
import { SessionInput } from "@/components/session/SessionInput";
import { SessionOutput } from "@/components/session/SessionOutput";
import { SessionProgress } from "@/components/session/SessionProgress";
import { SessionReview } from "@/components/session/SessionReview";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { type SessionActivity, useStudySession } from "@/contexts/StudySessionContext";
import { useT } from "@/lib/i18n";
import { buildSessionPlan } from "@/lib/sessionPlanner";

import { api } from "../../convex/_generated/api";

export function StudySessionPage() {
  const t = useT();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    state,
    startSession,
    advanceToNextActivity,
    completeSession,
    exitSession,
    recordCardsReviewed,
    recordContentConsumed,
    recordSentencesWritten,
  } = useStudySession();

  const [selectedDuration] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const userId = user?.id ?? "";

  // Fetch data for planning
  const flashcardStats = useQuery(api.flashcards.getStats, isAuthenticated ? { userId } : "skip");
  const vocabulary = useQuery(api.vocabulary.list, isAuthenticated ? { userId } : "skip");
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Get recommended content
  const primaryLanguage = userProfile?.primaryLanguage ?? "japanese";
  const videos = useQuery(api.youtubeContent.list, { language: primaryLanguage });

  // Streak update mutation
  const updateStreak = useMutation(api.users.updateStreak);

  // Calculate session plan data
  const planData = useMemo(() => {
    if (!flashcardStats || !vocabulary) return null;

    const dueCardCount = flashcardStats.dueNow ?? 0;
    const newCardCount = flashcardStats.new ?? 0;
    const vocabToReview = vocabulary.filter(
      (v) => v.masteryState === "new" || v.masteryState === "learning"
    ).length;

    // Get recommended content
    const firstVideo = videos?.[0];
    const recommendedContent = firstVideo
      ? {
          type: "video" as const,
          id: firstVideo._id,
          title: firstVideo.title,
          duration: firstVideo.duration,
        }
      : null;

    return {
      dueCardCount,
      newCardCount,
      vocabToReview,
      recommendedContent,
    };
  }, [flashcardStats, vocabulary, videos]);

  // Build session plan when duration changes or data loads
  const sessionPlan = useMemo(() => {
    if (!planData) return null;
    return buildSessionPlan({
      ...planData,
      selectedDuration,
    });
  }, [planData, selectedDuration]);

  // Initialize session automatically when data is ready
  useEffect(() => {
    if (sessionPlan && isInitializing && state.status === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: one-time initialization
      setIsInitializing(false);
      startSession(sessionPlan);
    }
  }, [sessionPlan, isInitializing, state.status, startSession]);

  // Handle activity completion
  const handleActivityComplete = async () => {
    if (state.status !== "active") return;

    const nextIndex = state.currentActivityIndex + 1;
    if (nextIndex >= state.plan.activities.length) {
      // Session complete - update streak
      try {
        const streakResult = await updateStreak({ clerkId: userId });
        completeSession({
          currentStreak: streakResult.currentStreak,
          longestStreak: streakResult.longestStreak,
          isNewRecord: streakResult.isNewRecord ?? false,
        });
      } catch (error) {
        console.error("Failed to update streak:", error);
        completeSession(null);
      }
    } else {
      advanceToNextActivity();
    }
  };

  // Handle exit
  const handleExit = () => {
    if (state.status === "active") {
      setShowExitConfirm(true);
    } else {
      exitSession();
      navigate({ to: "/dashboard" });
    }
  };

  const confirmExit = () => {
    exitSession();
    navigate({ to: "/dashboard" });
  };

  // Handle session complete actions
  const handleContinue = () => {
    // Reset and start a new session
    setIsInitializing(true);
    exitSession();
  };

  const handleDone = () => {
    exitSession();
    navigate({ to: "/dashboard" });
  };

  // Loading state
  if (!isAuthenticated) {
    navigate({ to: "/dashboard" });
    return null;
  }

  if (!sessionPlan || state.status === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Empty session - no activities available
  if (sessionPlan.activities.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h2
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("studySession.emptyState.title")}
          </h2>
          <p className="text-foreground-muted mb-6">{t("studySession.emptyState.description")}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate({ to: "/library" })} className="w-full gap-2">
              {t("studySession.buttons.browseLibrary")}
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard" })}
              className="w-full"
            >
              {t("studySession.buttons.backToDashboard")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Session complete
  if (state.status === "complete") {
    return (
      <SessionComplete results={state.results} onContinue={handleContinue} onDone={handleDone} />
    );
  }

  // Active session
  if (state.status === "active") {
    const currentActivity = state.plan.activities[state.currentActivityIndex];

    return (
      <div className="min-h-screen bg-background">
        {/* Session header */}
        <div className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-md">
          <div className="container mx-auto px-4 py-3 max-w-4xl">
            <div className="flex items-center justify-between">
              <button
                onClick={handleExit}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
              <SessionProgress
                activities={state.plan.activities}
                currentIndex={state.currentActivityIndex}
              />
              <div className="w-9" /> {/* Spacer for centering */}
            </div>
          </div>
        </div>

        {/* Activity content */}
        <div className="animate-fade-in">
          <ActivityRenderer
            activity={currentActivity}
            onComplete={handleActivityComplete}
            onRecordCards={recordCardsReviewed}
            onRecordContent={recordContentConsumed}
            onRecordSentences={recordSentencesWritten}
          />
        </div>

        {/* Exit confirmation modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm mx-4 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t("studySession.exitModal.title")}
                </h3>
              </div>
              <p className="text-foreground-muted mb-6">
                {t("studySession.exitModal.description")}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1"
                >
                  {t("studySession.buttons.keepLearning")}
                </Button>
                <Button variant="destructive" onClick={confirmExit} className="flex-1">
                  {t("studySession.buttons.exit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return null;
}

// Activity renderer component
interface ActivityRendererProps {
  activity: SessionActivity;
  onComplete: () => void;
  onRecordCards: (count: number) => void;
  onRecordContent: (content: { type: "story" | "video"; title: string }) => void;
  onRecordSentences: (count: number) => void;
}

function ActivityRenderer({
  activity,
  onComplete,
  onRecordCards,
  onRecordContent,
  onRecordSentences,
}: ActivityRendererProps) {
  switch (activity.type) {
    case "review":
      return (
        <SessionReview
          cardCount={activity.cardCount}
          onComplete={(reviewedCount) => {
            onRecordCards(reviewedCount);
            onComplete();
          }}
        />
      );
    case "input":
      return (
        <SessionInput
          contentType={activity.contentType}
          contentId={activity.contentId}
          title={activity.title}
          onComplete={() => {
            onRecordContent({ type: activity.contentType, title: activity.title });
            onComplete();
          }}
          onSkip={onComplete}
        />
      );
    case "output":
      return (
        <SessionOutput
          wordCount={activity.wordCount}
          onComplete={(sentenceCount) => {
            onRecordSentences(sentenceCount);
            onComplete();
          }}
          onSkip={onComplete}
        />
      );
  }
}
