import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { preloadFlashcardAssets } from "@/hooks/useFlashcard";
import { Button } from "@/components/ui/button";
import {
  Brain,
  RotateCcw,
  Check,
  X,
  ChevronRight,
  Loader2,
  BookOpen,
  Volume2,
  Sparkles
} from "lucide-react";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

type Rating = "again" | "hard" | "good" | "easy";

type CardType = {
  _id: Id<"flashcards">;
  sentence: string;
  sentenceTranslation: string;
  audioUrl?: string | null;
  wordAudioUrl?: string | null;
  imageUrl?: string | null;
  vocabulary?: {
    word: string;
    reading?: string | null;
    definitions: string[];
    language: string;
  } | null;
};

export function FlashcardsPage() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? "anonymous";

  // Fetch due cards and stats
  const stats = useQuery(
    api.flashcards.getStats,
    isAuthenticated ? { userId } : "skip"
  );
  const dueCards = useQuery(
    api.flashcards.getDue,
    isAuthenticated ? { userId, limit: 50 } : "skip"
  );
  const newCards = useQuery(
    api.flashcards.getNew,
    isAuthenticated ? { userId, limit: 20 } : "skip"
  );

  // Session queue - includes original cards plus requeued "Again" cards
  const [sessionQueue, setSessionQueue] = useState<CardType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const reviewCard = useMutation(api.flashcards.review);

  // Initialize session queue when cards load
  const initialCards = useMemo(() => {
    return [...(dueCards ?? []), ...(newCards ?? [])] as CardType[];
  }, [dueCards, newCards]);

  useEffect(() => {
    if (initialCards.length > 0 && !isInitialized) {
      setSessionQueue(initialCards);
      setIsInitialized(true);
    }
  }, [initialCards, isInitialized]);

  const currentCard = sessionQueue[currentIndex];

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard) return;

    try {
      await reviewCard({
        flashcardId: currentCard._id,
        rating,
      });

      setReviewedCount((prev) => prev + 1);
      setShowAnswer(false);

      // If "Again", requeue the card at the end of the session
      if (rating === "again") {
        setSessionQueue((prev) => [...prev, currentCard]);
      }

      if (currentIndex + 1 >= sessionQueue.length) {
        // Check if there are requeued cards after current position
        if (rating === "again") {
          // Card was just added, continue to it
          setCurrentIndex((prev) => prev + 1);
        } else {
          setSessionComplete(true);
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to review card:", error);
    }
  }, [currentCard, currentIndex, sessionQueue.length, reviewCard]);

  const restartSession = () => {
    setSessionQueue(initialCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionComplete(false);
    setReviewedCount(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!currentCard || sessionComplete) return;

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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, showAnswer, sessionComplete, handleRating]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <Brain className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sign in to start reviewing</h2>
          <p className="text-foreground-muted mb-4">
            Track your progress and master your vocabulary with spaced repetition.
          </p>
          <SignInButton mode="modal">
            <Button>Sign In</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (stats === undefined || dueCards === undefined || newCards === undefined) {
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
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                Spaced Repetition
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Flashcards
            </h1>
            <p className="text-foreground-muted text-lg">
              Review your vocabulary with the FSRS algorithm
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-border bg-surface">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="flex flex-wrap gap-4 sm:gap-8">
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">Total Cards</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{stats.new}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">New</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{stats.learning + stats.relearning}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">Learning</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{stats.review}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">Review</div>
            </div>
            <div className="ml-auto">
              <div className="text-2xl font-bold text-accent">{stats.dueNow}</div>
              <div className="text-xs text-foreground-muted uppercase tracking-wide">Due Now</div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Area */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        {sessionQueue.length === 0 && isInitialized ? (
          // No cards to review
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              All caught up!
            </h2>
            <p className="text-foreground-muted mb-6">
              No cards are due for review right now. Add more vocabulary or check back later.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => window.location.href = "/vocabulary"}>
                <BookOpen className="w-4 h-4 mr-2" />
                Add Vocabulary
              </Button>
            </div>
          </div>
        ) : sessionComplete ? (
          // Session complete
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Session Complete!
            </h2>
            <p className="text-foreground-muted mb-2">
              You reviewed <span className="font-semibold text-foreground">{reviewedCount}</span> cards
            </p>
            <p className="text-sm text-foreground-muted mb-6">
              Great work! Keep up the consistent practice.
            </p>
            <Button onClick={restartSession}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Review Again
            </Button>
          </div>
        ) : currentCard ? (
          // Review card
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-foreground-muted">
              <span>Card {currentIndex + 1} of {sessionQueue.length}</span>
              <span>{reviewedCount} reviewed</span>
            </div>

            {/* Card */}
            <FlashcardDisplay
              card={currentCard}
              showAnswer={showAnswer}
              onShowAnswer={() => setShowAnswer(true)}
            />

            {/* Rating Buttons */}
            {showAnswer && (
              <div className="space-y-3 animate-fade-in-up">
                <p className="text-center text-sm text-foreground-muted">How well did you know this?</p>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleRating("again")}
                    className="flex-col h-auto py-3 border-red-500/30 hover:bg-red-500/10 hover:border-red-500"
                  >
                    <X className="w-5 h-5 text-red-500 mb-1" />
                    <span className="text-xs font-medium">Again</span>
                    <span className="text-[10px] text-foreground-muted">1m</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("hard")}
                    className="flex-col h-auto py-3 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500"
                  >
                    <span className="text-amber-500 font-bold mb-1">~</span>
                    <span className="text-xs font-medium">Hard</span>
                    <span className="text-[10px] text-foreground-muted">10m</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("good")}
                    className="flex-col h-auto py-3 border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
                  >
                    <Check className="w-5 h-5 text-green-500 mb-1" />
                    <span className="text-xs font-medium">Good</span>
                    <span className="text-[10px] text-foreground-muted">1d</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRating("easy")}
                    className="flex-col h-auto py-3 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500"
                  >
                    <ChevronRight className="w-5 h-5 text-blue-500 mb-1" />
                    <span className="text-xs font-medium">Easy</span>
                    <span className="text-[10px] text-foreground-muted">4d</span>
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
  card: {
    _id: string;
    sentence: string;
    sentenceTranslation: string;
    audioUrl?: string | null;
    wordAudioUrl?: string | null;
    imageUrl?: string | null;
    vocabulary?: {
      word: string;
      reading?: string | null;
      definitions: string[];
      language: string;
    } | null;
  };
  showAnswer: boolean;
  onShowAnswer: () => void;
}

function FlashcardDisplay({ card, showAnswer, onShowAnswer }: FlashcardDisplayProps) {
  const vocab = card.vocabulary;
  const isJapanese = vocab?.language === "japanese";
  const languageFont = isJapanese ? "var(--font-japanese)" : "inherit";

  // Preload audio and images when card changes (before user clicks "Show Answer")
  useEffect(() => {
    preloadFlashcardAssets(card);
  }, [card._id, card.wordAudioUrl, card.audioUrl, card.imageUrl]);

  const playAudio = (url: string) => {
    new Audio(url).play();
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
      {/* Image - only show after answer */}
      {showAnswer && card.imageUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={card.imageUrl}
            alt={vocab?.word || "Flashcard image"}
            className="max-w-full h-auto max-h-48 rounded-xl object-contain"
          />
        </div>
      )}

      {/* Front - Word (no reading shown) */}
      <div className="text-center mb-6">
        <div
          className="text-4xl sm:text-5xl font-bold text-foreground mb-2"
          style={{ fontFamily: languageFont }}
        >
          {vocab?.word}
        </div>
        {/* Word Audio Button - only show after answer */}
        {showAnswer && card.wordAudioUrl && (
          <div className="mt-2">
            <button
              onClick={() => playAudio(card.wordAudioUrl!)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              Play Word
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
          {card.sentence}
        </p>
        {/* Sentence Translation - shown directly below sentence */}
        {showAnswer && (
          <p className="text-sm text-foreground-muted text-center mt-2 italic">
            {card.sentenceTranslation}
          </p>
        )}
        {/* Sentence Audio Button - only show after answer */}
        {showAnswer && card.audioUrl && (
          <div className="flex justify-center mt-3">
            <button
              onClick={() => playAudio(card.audioUrl!)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              Play Sentence
            </button>
          </div>
        )}
      </div>

      {/* Show Answer Button / Answer */}
      {!showAnswer ? (
        <Button onClick={onShowAnswer} className="w-full" size="lg">
          Show Answer
        </Button>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {/* Reading (for Japanese) */}
          {isJapanese && vocab?.reading && (
            <div className="text-center">
              <div className="text-sm text-foreground-muted mb-1">Reading</div>
              <div className="text-2xl text-foreground" style={{ fontFamily: languageFont }}>
                {vocab.reading}
              </div>
            </div>
          )}

          {/* Definition */}
          <div className="text-center">
            <div className="text-sm text-foreground-muted mb-1">Definition</div>
            <div className="text-xl font-medium text-foreground">
              {vocab?.definitions.join("; ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
