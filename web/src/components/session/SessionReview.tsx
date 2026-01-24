import { useMutation, useQuery } from "convex/react";
import { Brain, Check, ChevronRight, Loader2, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { Id, Rating } from "@/lib/convex-types";
import { useT } from "@/lib/i18n";

import { api } from "../../../convex/_generated/api";

// CardType includes joined vocabulary data from the query
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

interface SessionReviewProps {
  cardCount: number;
  onComplete: (reviewedCount: number) => void;
}

export function SessionReview({ cardCount, onComplete }: SessionReviewProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const t = useT();

  // Fetch cards
  const dueCards = useQuery(api.flashcards.getDue, userId ? { userId, limit: cardCount } : "skip");
  const newCards = useQuery(
    api.flashcards.getNew,
    userId ? { userId, limit: Math.max(0, cardCount - (dueCards?.length ?? 0)) } : "skip"
  );

  // Session state
  const [sessionQueue, setSessionQueue] = useState<CardType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastSelectedRating, setLastSelectedRating] = useState<Rating | null>(null);

  const reviewCard = useMutation(api.flashcards.review);

  // Initialize session queue
  const initialCards = useMemo(() => {
    const cards = [...(dueCards ?? []), ...(newCards ?? [])] as CardType[];
    return cards.slice(0, cardCount);
  }, [dueCards, newCards, cardCount]);

  useEffect(() => {
    if (initialCards.length > 0 && !isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional one-time initialization from async data
      setSessionQueue(initialCards);
      setIsInitialized(true);
    }
  }, [initialCards, isInitialized]);

  // Handle rating
  const handleRating = useCallback(
    async (rating: Rating) => {
      const currentCard = sessionQueue[currentIndex];
      if (!currentCard || isTransitioning) return;

      setLastSelectedRating(rating);
      setIsTransitioning(true);

      try {
        await reviewCard({ flashcardId: currentCard._id, rating });

        setTimeout(() => {
          setReviewedCount((prev) => prev + 1);
          setShowAnswer(false);
          setLastSelectedRating(null);
          setIsTransitioning(false);

          const isLastCard = currentIndex + 1 >= sessionQueue.length;
          if (isLastCard && rating !== "again") {
            setSessionComplete(true);
            onComplete(reviewedCount + 1);
          } else {
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
    [sessionQueue, currentIndex, reviewedCount, reviewCard, isTransitioning, onComplete]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (sessionComplete || isTransitioning) return;

      const currentCard = sessionQueue[currentIndex];
      if (!currentCard) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer) setShowAnswer(true);
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

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [sessionQueue, currentIndex, showAnswer, sessionComplete, isTransitioning, handleRating]);

  // Loading state
  if (
    dueCards === undefined ||
    newCards === undefined ||
    (!isInitialized && initialCards.length === 0)
  ) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No cards
  if (sessionQueue.length === 0 && isInitialized) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t("flashcards.states.allCaughtUp.title")}
        </h2>
        <p className="text-foreground-muted mb-6">{t("flashcards.noCardsToReview")}</p>
        <Button onClick={() => onComplete(0)}>{t("common.buttons.continue")}</Button>
      </div>
    );
  }

  const currentCard = sessionQueue[currentIndex];
  const cardsLeft = sessionQueue.length - currentIndex;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Stats bar */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border">
          <Brain className="w-4 h-4 text-accent" />
          <span className="text-2xl font-bold text-green-500">{cardsLeft}</span>
          <span className="text-foreground-muted">{t("flashcards.counter.cardsLeft")}</span>
        </div>
      </div>

      {/* Card */}
      {currentCard && (
        <div className="space-y-6">
          <FlashcardDisplay
            card={currentCard}
            showAnswer={showAnswer}
            onShowAnswer={() => setShowAnswer(true)}
          />

          {/* Rating buttons */}
          {showAnswer && (
            <div className="space-y-3 animate-fade-in-up">
              <p className="text-center text-sm text-foreground-muted">
                {t("flashcards.rating.prompt")}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <RatingButton
                  rating="again"
                  selected={lastSelectedRating === "again"}
                  disabled={isTransitioning}
                  onClick={() => handleRating("again")}
                />
                <RatingButton
                  rating="hard"
                  selected={lastSelectedRating === "hard"}
                  disabled={isTransitioning}
                  onClick={() => handleRating("hard")}
                />
                <RatingButton
                  rating="good"
                  selected={lastSelectedRating === "good"}
                  disabled={isTransitioning}
                  onClick={() => handleRating("good")}
                />
                <RatingButton
                  rating="easy"
                  selected={lastSelectedRating === "easy"}
                  disabled={isTransitioning}
                  onClick={() => handleRating("easy")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Flashcard display
function FlashcardDisplay({
  card,
  showAnswer,
  onShowAnswer,
}: {
  card: CardType;
  showAnswer: boolean;
  onShowAnswer: () => void;
}) {
  const t = useT();
  const vocab = card.vocabulary;
  const isJapanese = vocab?.language === "japanese";
  const languageFont = isJapanese ? "var(--font-japanese)" : "inherit";

  const playAudio = (url: string) => {
    new Audio(url).play();
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
      {/* Image */}
      {showAnswer && card.imageUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={card.imageUrl}
            alt={vocab?.word || "Flashcard image"}
            className="max-w-full h-auto max-h-48 rounded-xl object-contain"
          />
        </div>
      )}

      {/* Word */}
      <div className="text-center mb-6">
        <div
          className="text-4xl sm:text-5xl font-bold text-foreground mb-2"
          style={{ fontFamily: languageFont }}
        >
          {vocab?.word}
        </div>
        {showAnswer && card.wordAudioUrl && (
          <button
            onClick={() => playAudio(card.wordAudioUrl!)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            {t("flashcards.card.playWord")}
          </button>
        )}
      </div>

      {/* Sentence */}
      <div className="bg-muted/50 rounded-xl p-4 mb-6">
        <p
          className="text-lg text-foreground leading-relaxed text-center"
          style={{ fontFamily: languageFont }}
        >
          {card.sentence}
        </p>
        {showAnswer && (
          <p className="text-sm text-foreground-muted text-center mt-2 italic">
            {card.sentenceTranslation}
          </p>
        )}
        {showAnswer && card.audioUrl && (
          <div className="flex justify-center mt-3">
            <button
              onClick={() => playAudio(card.audioUrl!)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {t("flashcards.card.playSentence")}
            </button>
          </div>
        )}
      </div>

      {/* Show answer / Answer */}
      {!showAnswer ? (
        <Button onClick={onShowAnswer} className="w-full" size="lg">
          Show Answer
        </Button>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {isJapanese && vocab?.reading && (
            <div className="text-center">
              <div className="text-sm text-foreground-muted mb-1">Reading</div>
              <div className="text-2xl text-foreground" style={{ fontFamily: languageFont }}>
                {vocab.reading}
              </div>
            </div>
          )}
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

// Rating button
function RatingButton({
  rating,
  selected,
  disabled,
  onClick,
}: {
  rating: Rating;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const config = {
    again: { icon: X, color: "red", label: "Again", time: "1m" },
    hard: { icon: null, color: "amber", label: "Hard", time: "10m" },
    good: { icon: Check, color: "green", label: "Good", time: "1d" },
    easy: { icon: ChevronRight, color: "blue", label: "Easy", time: "4d" },
  }[rating];

  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={`flex-col h-auto py-3 border-${config.color}-500/30 hover:bg-${config.color}-500/10 hover:border-${config.color}-500 transition-all ${
        selected ? `ring-2 ring-${config.color}-500 bg-${config.color}-500/20 scale-95` : ""
      }`}
    >
      {config.icon ? (
        <config.icon className={`w-5 h-5 text-${config.color}-500 mb-1`} />
      ) : (
        <span className={`text-${config.color}-500 font-bold mb-1`}>~</span>
      )}
      <span className="text-xs font-medium">{config.label}</span>
      <span className="text-[10px] text-foreground-muted">{config.time}</span>
    </Button>
  );
}
