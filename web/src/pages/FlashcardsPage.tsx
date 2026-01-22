import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

type Rating = "again" | "hard" | "good" | "easy";

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

  // Combine due and new cards for review session
  const allCards = [...(dueCards ?? []), ...(newCards ?? [])];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const reviewCard = useMutation(api.flashcards.review);

  const currentCard = allCards[currentIndex];

  const handleRating = async (rating: Rating) => {
    if (!currentCard) return;

    try {
      await reviewCard({
        flashcardId: currentCard._id,
        rating,
      });

      setReviewedCount((prev) => prev + 1);
      setShowAnswer(false);

      if (currentIndex + 1 >= allCards.length) {
        setSessionComplete(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to review card:", error);
    }
  };

  const restartSession = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionComplete(false);
    setReviewedCount(0);
  };

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
        {allCards.length === 0 ? (
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
              <span>Card {currentIndex + 1} of {allCards.length}</span>
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
  const [showReading, setShowReading] = useState(false);
  const vocab = card.vocabulary;
  const isJapanese = vocab?.language === "japanese";
  const languageFont = isJapanese ? "var(--font-japanese)" : "inherit";

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
      {/* Front - Word */}
      <div className="text-center mb-6">
        <div
          className="text-4xl sm:text-5xl font-bold text-foreground mb-2"
          style={{ fontFamily: languageFont }}
        >
          {vocab?.word}
        </div>
        {isJapanese && vocab?.reading && (
          <button
            onClick={() => setShowReading(!showReading)}
            className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            {showReading ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showReading ? vocab.reading : "Show reading"}
          </button>
        )}
      </div>

      {/* Example Sentence */}
      <div className="bg-muted/50 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-lg text-foreground leading-relaxed"
            style={{ fontFamily: languageFont }}
          >
            {card.sentence}
          </p>
          {card.audioUrl && (
            <button
              onClick={() => new Audio(card.audioUrl!).play()}
              className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Show Answer Button / Answer */}
      {!showAnswer ? (
        <Button onClick={onShowAnswer} className="w-full" size="lg">
          Show Answer
        </Button>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {/* Definition */}
          <div className="text-center">
            <div className="text-sm text-foreground-muted mb-1">Definition</div>
            <div className="text-xl font-medium text-foreground">
              {vocab?.definitions.join("; ")}
            </div>
          </div>

          {/* Sentence Translation */}
          <div className="text-center pt-4 border-t border-border">
            <div className="text-sm text-foreground-muted mb-1">Translation</div>
            <div className="text-foreground">
              {card.sentenceTranslation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
