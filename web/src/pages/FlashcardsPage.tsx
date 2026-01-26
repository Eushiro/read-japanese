import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Redo2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useReviewSession } from "@/contexts/ReviewSessionContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useAIAction } from "@/hooks/useAIAction";
import { preloadFlashcardAssets } from "@/hooks/useFlashcard";
import { type ContentLanguage, contentLanguageMatchesUI } from "@/lib/contentLanguages";
import type { CardState, Id, Rating } from "@/lib/convex-types";
import { useT, useUILanguage } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Use Convex's inferred return type from the query
type CardType = FunctionReturnType<typeof api.flashcards.getDue>[number];

// History entry for undo/redo
type HistoryEntry = {
  cardId: Id<"flashcards">;
  card: CardType;
  rating: Rating;
  previousState: {
    sessionQueue: CardType[];
    currentIndex: number;
    reviewedCount: number;
    flashcardState: {
      state: CardState;
      due: number;
      stability: number;
      difficulty: number;
      elapsedDays: number;
      scheduledDays: number;
      reps: number;
      lapses: number;
      lastReview?: number;
    };
    vocabStats: {
      timesReviewed: number;
      timesCorrect: number;
    };
  };
};

export function FlashcardsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { trackEvent, events } = useAnalytics();
  const { setCardsLeft } = useReviewSession();
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const userId = user?.id ?? "anonymous";

  // User profile and subscription from shared context (prevents refetching on navigation)
  const { userProfile, isPremium: isPremiumUser } = useUserData();
  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];
  const firstLanguage = userLanguages[0];
  const hasMultipleLanguages = userLanguages.length > 1;

  // State for selected language (defaults to first language when loaded)
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);
  const activeLanguage = selectedLanguage ?? firstLanguage;

  // Sync selectedLanguage with first language when it loads
  useEffect(() => {
    if (firstLanguage && !selectedLanguage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional sync from async data
      setSelectedLanguage(firstLanguage);
    }
  }, [firstLanguage, selectedLanguage]);

  // Fetch due cards and stats - filtered by selected language
  const stats = useQuery(
    api.flashcards.getStats,
    isAuthenticated ? { userId, language: activeLanguage } : "skip"
  );

  const dueCards = useQuery(
    api.flashcards.getDue,
    isAuthenticated ? { userId, limit: 50, language: activeLanguage, uiLanguage } : "skip"
  );

  const newCards = useQuery(
    api.flashcards.getNew,
    isAuthenticated ? { userId, limit: 20, language: activeLanguage, uiLanguage } : "skip"
  );

  // Session queue - includes original cards plus requeued "Again" cards
  const [sessionQueue, setSessionQueue] = useState<CardType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const originalSessionSize = useRef(0);

  // Visual feedback state
  const [lastSelectedRating, setLastSelectedRating] = useState<Rating | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Undo/redo history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoneHistory, setUndoneHistory] = useState<HistoryEntry[]>([]);

  const reviewCard = useMutation(api.flashcards.review);
  const unreviewCard = useMutation(api.flashcards.unreview);

  // Initialize session queue when cards load
  const initialCards = useMemo(() => {
    return [...(dueCards ?? []), ...(newCards ?? [])];
  }, [dueCards, newCards]);

  // Store counts at initialization time to avoid dependency on changing values
  const dueCardsCount = dueCards?.length ?? 0;
  const newCardsCount = newCards?.length ?? 0;

  useEffect(() => {
    if (initialCards.length > 0 && !isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional one-time initialization from async data
      setSessionQueue(initialCards);
      setIsInitialized(true);
      originalSessionSize.current = initialCards.length;
      // Track session started
      trackEvent(events.FLASHCARD_SESSION_STARTED, {
        cards_due: dueCardsCount,
        cards_new: newCardsCount,
        total_cards: initialCards.length,
      });
    }
  }, [
    initialCards,
    isInitialized,
    trackEvent,
    events.FLASHCARD_SESSION_STARTED,
    dueCardsCount,
    newCardsCount,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  // Sync cards left with review session context for header badge
  useEffect(() => {
    if (isInitialized && !sessionComplete) {
      setCardsLeft(sessionQueue.length - currentIndex);
    } else {
      setCardsLeft(null);
    }
    return () => setCardsLeft(null);
  }, [sessionQueue.length, currentIndex, isInitialized, sessionComplete, setCardsLeft]);

  const currentCard = sessionQueue[currentIndex];

  const handleRating = useCallback(
    async (rating: Rating) => {
      if (!currentCard || isTransitioning) return;

      // Show visual feedback immediately and start transition
      setLastSelectedRating(rating);
      setIsTransitioning(true);

      // Capture current state BEFORE mutation for undo
      const historyEntry: HistoryEntry = {
        cardId: currentCard._id,
        card: currentCard,
        rating,
        previousState: {
          sessionQueue: [...sessionQueue],
          currentIndex,
          reviewedCount,
          flashcardState: {
            state: currentCard.state ?? "new",
            due: currentCard.due ?? Date.now(),
            stability: currentCard.stability ?? 0,
            difficulty: currentCard.difficulty ?? 0,
            elapsedDays: currentCard.elapsedDays ?? 0,
            scheduledDays: currentCard.scheduledDays ?? 0,
            reps: currentCard.reps ?? 0,
            lapses: currentCard.lapses ?? 0,
            lastReview: currentCard.lastReview,
          },
          vocabStats: {
            timesReviewed: currentCard.vocabulary?.timesReviewed ?? 0,
            timesCorrect: currentCard.vocabulary?.timesCorrect ?? 0,
          },
        },
      };

      try {
        await reviewCard({
          flashcardId: currentCard._id,
          rating,
        });

        // Save to history after successful mutation
        setHistory((prev) => [...prev, historyEntry]);
        setUndoneHistory([]); // Clear redo stack on new action

        // Track card rated
        trackEvent(events.FLASHCARD_RATED, {
          rating,
          card_state: currentCard.state ?? "new",
          word: currentCard.vocabulary?.word,
        });

        // Wait 200ms to show the highlight before advancing
        advanceTimeoutRef.current = setTimeout(() => {
          setReviewedCount((prev) => prev + 1);
          setShowAnswer(false);
          setLastSelectedRating(null);
          setIsTransitioning(false);

          // Advance index first, then requeue if "Again" - this keeps the count stable
          const isLastCard = currentIndex + 1 >= sessionQueue.length;

          if (isLastCard && rating !== "again") {
            setSessionComplete(true);
            trackEvent(events.FLASHCARD_SESSION_COMPLETED, {
              cards_reviewed: reviewedCount + 1,
              total_cards: sessionQueue.length,
            });
          } else {
            // Advance and optionally requeue together
            setCurrentIndex((prev) => prev + 1);
            if (rating === "again") {
              setSessionQueue((prev) => [...prev, currentCard]);
            }
          }
        }, 200);
      } catch (error) {
        console.error("Failed to review card:", error);
        setLastSelectedRating(null);
        setIsTransitioning(false);
      }
    },
    [
      currentCard,
      currentIndex,
      sessionQueue,
      reviewedCount,
      reviewCard,
      isTransitioning,
      trackEvent,
      events,
    ]
  );

  const restartSession = () => {
    setSessionQueue(initialCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionComplete(false);
    setReviewedCount(0);
    setHistory([]);
    setUndoneHistory([]);
  };

  // Reset session when language changes
  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    setSessionQueue([]);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionComplete(false);
    setReviewedCount(0);
    setIsInitialized(false);
    setHistory([]);
    setUndoneHistory([]);
  };

  // Undo last review
  const handleUndo = useCallback(async () => {
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];

    try {
      // Revert database state
      await unreviewCard({
        flashcardId: lastEntry.cardId,
        previousFlashcardState: lastEntry.previousState.flashcardState,
        previousVocabStats: lastEntry.previousState.vocabStats,
      });

      // Revert UI state
      setSessionQueue(lastEntry.previousState.sessionQueue);
      setCurrentIndex(lastEntry.previousState.currentIndex);
      setReviewedCount(lastEntry.previousState.reviewedCount);
      setShowAnswer(false);
      setSessionComplete(false);

      // Move to undone history for redo
      setHistory((prev) => prev.slice(0, -1));
      setUndoneHistory((prev) => [...prev, lastEntry]);
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  }, [history, unreviewCard]);

  // Redo last undone review
  const handleRedo = useCallback(async () => {
    if (undoneHistory.length === 0) return;

    const entryToRedo = undoneHistory[undoneHistory.length - 1];

    try {
      // Re-apply the review
      await reviewCard({
        flashcardId: entryToRedo.cardId,
        rating: entryToRedo.rating,
      });

      // Re-apply UI state changes
      setReviewedCount((prev) => prev + 1);
      setShowAnswer(false);

      // Handle session queue and index based on original rating
      if (entryToRedo.rating === "again") {
        setSessionQueue((prev) => [...prev, entryToRedo.card]);
      }

      const prevQueue = entryToRedo.previousState.sessionQueue;
      const prevIndex = entryToRedo.previousState.currentIndex;

      if (prevIndex + 1 >= prevQueue.length) {
        if (entryToRedo.rating === "again") {
          setCurrentIndex(prevIndex + 1);
        } else {
          setSessionComplete(true);
        }
      } else {
        setCurrentIndex(prevIndex + 1);
      }

      // Move back to history
      setUndoneHistory((prev) => prev.slice(0, -1));
      setHistory((prev) => [...prev, entryToRedo]);
    } catch (error) {
      console.error("Failed to redo:", error);
    }
  }, [undoneHistory, reviewCard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo: Cmd/Ctrl + Z (without Shift)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        (e.metaKey || e.ctrlKey) &&
        ((e.shiftKey && e.key.toLowerCase() === "z") || e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
        return;
      }

      if (!currentCard || sessionComplete || isTransitioning) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer) {
          setShowAnswer(true);
        }
      } else if (showAnswer) {
        switch (e.key) {
          case "1":
            handleRating("again");
            break;
          case "2":
            handleRating("hard");
            break;
          case "3":
            handleRating("good");
            break;
          case "4":
            handleRating("easy");
            break;
        }
      }
    };

    // Use capture phase to intercept before browser
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    currentCard,
    showAnswer,
    sessionComplete,
    isTransitioning,
    handleRating,
    handleUndo,
    handleRedo,
  ]);

  // Check if data is still loading (for inline skeletons)
  const isDataLoading =
    isAuthenticated &&
    (userProfile === undefined ||
      stats === undefined ||
      dueCards === undefined ||
      newCards === undefined ||
      (!isInitialized && initialCards.length > 0));

  // Don't show sign-in prompt while auth is still loading
  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <Brain className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t("flashcards.signIn.title")}
          </h2>
          <p className="text-foreground-muted mb-4">{t("flashcards.signIn.description")}</p>
          <SignInButton mode="modal">
            <Button>{t("flashcards.signIn.button")}</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Animated background */}
      <PremiumBackground colorScheme="cool" />

      {/* Header Section */}
      <div className="relative flex-shrink-0 pb-2">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative">
          <div>
            {/* Title Row */}
            <div className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                <h1
                  className="text-2xl font-bold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("flashcards.hero.title")}
                </h1>
                {/* Language selector - show dropdown if multiple languages, otherwise static badge */}
                {hasMultipleLanguages ? (
                  <Select value={activeLanguage} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="h-8 px-3 rounded-full bg-muted border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {userLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {t(`common.languages.${lang}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : activeLanguage ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-sm">
                    {t(`common.languages.${activeLanguage}`)}
                  </span>
                ) : null}
              </div>
              {/* Cards remaining badge */}
              <div className="inline-flex items-center gap-2">
                {isDataLoading ? (
                  <Skeleton className="w-8 h-6" />
                ) : (
                  <span className="text-xl font-bold text-green-500">
                    {sessionQueue.length - currentIndex}
                  </span>
                )}
                <span className="text-sm text-foreground-muted">
                  {t("flashcards.counter.cardsLeft")}
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-foreground-muted">{t("flashcards.hero.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Review Area */}
      <div className="container mx-auto px-4 sm:px-6 py-4 max-w-6xl flex-1 flex flex-col items-center overflow-y-auto">
        {isDataLoading ? (
          // Inline skeleton for flashcard area
          <div className="w-full space-y-4">
            {/* Undo/Redo buttons */}
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            {/* Flashcard */}
            <div className="rounded-2xl border border-border bg-surface/80 p-6 space-y-4">
              <div className="text-center py-8 space-y-3">
                <Skeleton className="w-32 h-10 mx-auto" />
                <Skeleton className="w-48 h-5 mx-auto" />
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <Skeleton className="w-full h-5" />
                <Skeleton className="w-3/4 h-5 mx-auto" />
              </div>
              <Skeleton className="w-full h-12 rounded-lg" />
            </div>
          </div>
        ) : sessionQueue.length === 0 && isInitialized ? (
          // No cards to review
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h2
                className="text-2xl font-bold text-foreground mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("flashcards.states.allCaughtUp.title")}
              </h2>
              <p className="text-foreground-muted mb-6">
                {t("flashcards.states.allCaughtUp.description")}
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/learn?tab=words")}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {t("flashcards.states.allCaughtUp.addVocabulary")}
                </Button>
              </div>
            </div>
          </div>
        ) : sessionComplete ? (
          // Session complete
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-accent" />
              </div>
              <h2
                className="text-2xl font-bold text-foreground mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("flashcards.states.sessionComplete.title")}
              </h2>
              <p className="text-foreground-muted mb-2">
                {t("flashcards.states.sessionComplete.cardsReviewed", { count: reviewedCount })
                  .split("<bold>")
                  .map((part, i) =>
                    i === 0 ? (
                      part
                    ) : (
                      <span key={i}>
                        <span className="font-semibold text-foreground">
                          {part.split("</bold>")[0]}
                        </span>
                        {part.split("</bold>")[1]}
                      </span>
                    )
                  )}
              </p>
              <p className="text-sm text-foreground-muted mb-6">
                {t("flashcards.states.sessionComplete.encouragement")}
              </p>
              <Button onClick={restartSession}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("flashcards.states.sessionComplete.reviewAgain")}
              </Button>
            </div>
          </div>
        ) : currentCard ? (
          // Review card
          <div className="w-full space-y-4">
            {/* Undo/Redo */}
            <div className="flex items-center justify-end gap-2 text-sm text-foreground-muted">
              <button
                onClick={handleUndo}
                disabled={history.length === 0 || isTransitioning}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={t("flashcards.actions.undo")}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={undoneHistory.length === 0 || isTransitioning}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={t("flashcards.actions.redo")}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Card */}
            <FlashcardDisplay
              card={currentCard}
              showAnswer={showAnswer}
              onShowAnswer={() => setShowAnswer(true)}
              isPremiumUser={!!isPremiumUser}
              onSentenceRefreshed={(newSentence, newTranslation, newAudioUrl) => {
                // Update the card in the session queue so the change persists
                setSessionQueue((prev) =>
                  prev.map((card) =>
                    card._id === currentCard._id && card.sentence
                      ? {
                          ...card,
                          sentence: {
                            ...card.sentence,
                            sentence: newSentence,
                            sentenceTranslation: newTranslation,
                            audioUrl: newAudioUrl ?? card.sentence.audioUrl,
                          },
                        }
                      : card
                  )
                );
              }}
            />

            {/* Rating Buttons */}
            {showAnswer && (
              <div className="space-y-3 animate-fade-in-up">
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleRating("again")}
                    disabled={isTransitioning}
                    className={`flex-col h-auto py-4 border-red-500/30 hover:bg-red-500/10 hover:border-red-500 transition-all ${
                      lastSelectedRating === "again"
                        ? "ring-2 ring-red-500 !bg-red-500/40 scale-95"
                        : ""
                    }`}
                  >
                    <X className="w-6 h-6 text-red-500 mb-1" />
                    <span className="text-sm font-medium">{t("flashcards.rating.again")}</span>
                    <span className="text-xs text-foreground-muted">
                      {t("flashcards.rating.intervals.again")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("hard")}
                    disabled={isTransitioning}
                    className={`flex-col h-auto py-4 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500 transition-all ${
                      lastSelectedRating === "hard"
                        ? "ring-2 ring-amber-500 !bg-amber-500/40 scale-95"
                        : ""
                    }`}
                  >
                    <span className="text-amber-500 font-bold text-lg mb-1">~</span>
                    <span className="text-sm font-medium">{t("flashcards.rating.hard")}</span>
                    <span className="text-xs text-foreground-muted">
                      {t("flashcards.rating.intervals.hard")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("good")}
                    disabled={isTransitioning}
                    className={`flex-col h-auto py-4 border-green-500/30 hover:bg-green-500/10 hover:border-green-500 transition-all ${
                      lastSelectedRating === "good"
                        ? "ring-2 ring-green-500 !bg-green-500/40 scale-95"
                        : ""
                    }`}
                  >
                    <Check className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-sm font-medium">{t("flashcards.rating.good")}</span>
                    <span className="text-xs text-foreground-muted">
                      {t("flashcards.rating.intervals.good")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("easy")}
                    disabled={isTransitioning}
                    className={`flex-col h-auto py-4 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500 transition-all ${
                      lastSelectedRating === "easy"
                        ? "ring-2 ring-blue-500 !bg-blue-500/40 scale-95"
                        : ""
                    }`}
                  >
                    <ChevronRight className="w-6 h-6 text-blue-500 mb-1" />
                    <span className="text-sm font-medium">{t("flashcards.rating.easy")}</span>
                    <span className="text-xs text-foreground-muted">
                      {t("flashcards.rating.intervals.easy")}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Flashcard display component
interface FlashcardDisplayProps {
  card: CardType;
  showAnswer: boolean;
  onShowAnswer: () => void;
  isPremiumUser: boolean;
  onSentenceRefreshed?: (
    newSentence: string,
    newTranslation: string | null,
    newAudioUrl?: string
  ) => void;
}

function FlashcardDisplay({
  card,
  showAnswer,
  onShowAnswer,
  isPremiumUser,
  onSentenceRefreshed,
}: FlashcardDisplayProps) {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const vocab = card.vocabulary;
  const isJapanese = vocab?.language === "japanese";
  const languageFont = isJapanese ? "var(--font-japanese)" : "inherit";
  // Hide translation if content language matches UI language
  const hideRedundantTranslation =
    vocab?.language && contentLanguageMatchesUI(vocab.language, uiLanguage);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSentence, setLocalSentence] = useState(card.sentence?.sentence);
  const [localTranslation, setLocalTranslation] = useState(card.sentence?.sentenceTranslation);
  const [localAudioUrl, setLocalAudioUrl] = useState(card.sentence?.audioUrl);
  const [showPaywall, setShowPaywall] = useState(false);

  const refreshSentence = useAIAction(api.ai.refreshFlashcardSentence);

  // Preload audio and images when card changes (before user clicks "Show Answer")
  useEffect(() => {
    preloadFlashcardAssets({
      wordAudioUrl: card.wordAudio?.audioUrl,
      audioUrl: card.sentence?.audioUrl,
      imageUrl: card.image?.imageUrl,
    });
  }, [card._id, card.wordAudio?.audioUrl, card.sentence?.audioUrl, card.image?.imageUrl]);

  // Reset local state when card changes
  useEffect(() => {
    setLocalSentence(card.sentence?.sentence);
    setLocalTranslation(card.sentence?.sentenceTranslation);
    setLocalAudioUrl(card.sentence?.audioUrl);
  }, [
    card._id,
    card.sentence?.sentence,
    card.sentence?.sentenceTranslation,
    card.sentence?.audioUrl,
  ]);

  const handleRefresh = async () => {
    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }

    setIsRefreshing(true);
    try {
      const result = await refreshSentence({
        flashcardId: card._id as Id<"flashcards">,
      });
      if (result.success && result.sentence && result.translation) {
        setLocalSentence(result.sentence);
        setLocalTranslation(result.translation);
        if (result.audioUrl) {
          setLocalAudioUrl(result.audioUrl);
        }
        onSentenceRefreshed?.(result.sentence, result.translation, result.audioUrl);
      }
    } catch (error) {
      console.error("Failed to refresh sentence:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const playAudio = (url: string) => {
    new Audio(url).play();
  };

  return (
    <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.05)] dark:border-white/10 dark:bg-white/[0.03]">
      {/* Image - only show after answer */}
      {showAnswer && card.image?.imageUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={card.image.imageUrl}
            alt={vocab?.word || "Flashcard image"}
            className="max-w-full h-auto max-h-48 rounded-xl object-contain"
          />
        </div>
      )}

      {/* Front - Word (no reading shown) */}
      <div className="text-center mb-6">
        <div
          className="text-5xl sm:text-6xl font-bold text-foreground mb-2"
          style={{ fontFamily: languageFont }}
        >
          {vocab?.word}
        </div>
        {/* Word Audio Button - only show after answer */}
        {showAnswer && card.wordAudio?.audioUrl && (
          <div className="mt-2">
            <button
              onClick={() => playAudio(card.wordAudio!.audioUrl)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {t("flashcards.card.playWord")}
            </button>
          </div>
        )}
      </div>

      {/* Example Sentence with Translation below - Centered */}
      <div className="bg-muted/50 rounded-xl p-4 mb-6">
        <p
          className="text-lg text-foreground leading-relaxed text-center"
          style={{ fontFamily: languageFont }}
        >
          {localSentence}
        </p>
        {/* Sentence Translation - shown directly below sentence (only if available and different from content language) */}
        {showAnswer && localTranslation && !hideRedundantTranslation && (
          <p className="text-sm text-foreground-muted text-center mt-2 italic">
            {localTranslation}
          </p>
        )}
        {/* Sentence Audio & Refresh Buttons - only show after answer */}
        {showAnswer && (
          <div className="flex justify-center items-center gap-2 mt-3">
            {localAudioUrl && (
              <button
                onClick={() => playAudio(localAudioUrl!)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                {t("flashcards.card.playSentence")}
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title={t("flashcards.card.newSentence")}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? t("flashcards.card.refreshing") : t("flashcards.card.newSentence")}
            </button>
          </div>
        )}
      </div>

      {/* Show Answer Button / Answer */}
      {!showAnswer ? (
        <Button
          onClick={onShowAnswer}
          variant="glass-accent"
          className="w-full shadow-[0_0_20px_rgba(249,115,22,0.2)]"
          size="lg"
        >
          {t("flashcards.card.showAnswer")}
        </Button>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {/* Reading (for Japanese) */}
          {isJapanese && vocab?.reading && (
            <div className="text-center">
              <div className="text-sm text-foreground-muted mb-1">
                {t("flashcards.card.reading")}
              </div>
              <div className="text-2xl text-foreground" style={{ fontFamily: languageFont }}>
                {vocab.reading}
              </div>
            </div>
          )}

          {/* Definition */}
          <div className="text-center">
            <div className="text-sm text-foreground-muted mb-1">
              {t("flashcards.card.definition")}
            </div>
            <div className="text-xl font-medium text-foreground">
              {vocab?.definitions.join("; ")}
            </div>
          </div>
        </div>
      )}

      {/* Paywall for sentence refresh */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="flashcards" />
    </div>
  );
}
