import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface MicroReviewWord {
  id: Id<"flashcards">;
  word: string;
  reading?: string;
  definitions: string[];
  language: ContentLanguage;
}

interface MicroReviewProps {
  words: MicroReviewWord[];
  onComplete: (results: { correct: number; total: number }) => void;
}

export function MicroReview({ words, onComplete }: MicroReviewProps) {
  const t = useT();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const reviewFlashcard = useMutation(api.flashcards.review);

  const currentWord = words[currentIndex];
  const isLastWord = currentIndex === words.length - 1;

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleResponse = async (remembered: boolean) => {
    // Record the review
    try {
      await reviewFlashcard({
        flashcardId: currentWord.id,
        rating: remembered ? "good" : "again",
      });
    } catch {
      // Silent failure - don't block the flow
    }

    const newResults = [...results, remembered];
    setResults(newResults);

    if (isLastWord) {
      const correct = newResults.filter(Boolean).length;
      onComplete({ correct, total: words.length });
    } else {
      setCurrentIndex((i) => i + 1);
      setShowAnswer(false);
    }
  };

  if (!currentWord) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mb-6">
        {words.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              index < currentIndex
                ? results[index]
                  ? "bg-green-500"
                  : "bg-red-400"
                : index === currentIndex
                  ? "bg-accent"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-surface rounded-2xl border border-border p-6 text-center"
      >
        <p className="text-xs text-foreground-muted mb-2">{t("microReview.doYouRemember")}</p>

        {/* Word */}
        <h2
          className="text-3xl font-bold text-foreground mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {currentWord.word}
        </h2>

        {/* Reading (for Japanese) */}
        {currentWord.reading && (
          <p className="text-lg text-foreground-muted mb-4">{currentWord.reading}</p>
        )}

        {/* Answer section */}
        {showAnswer ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-foreground">{currentWord.definitions.join("; ")}</p>
            </div>

            {/* Response buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-950"
                onClick={() => handleResponse(false)}
              >
                <X className="w-4 h-4" />
                {t("microReview.forgot")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-green-200 hover:bg-green-50 hover:text-green-600 dark:border-green-900 dark:hover:bg-green-950"
                onClick={() => handleResponse(true)}
              >
                <Check className="w-4 h-4" />
                {t("microReview.remembered")}
              </Button>
            </div>
          </motion.div>
        ) : (
          <Button onClick={handleReveal} className="mt-6 gap-2">
            {t("microReview.showAnswer")}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </motion.div>

      {/* Skip option */}
      <p className="text-center mt-4">
        <button
          onClick={() =>
            onComplete({ correct: results.filter(Boolean).length, total: words.length })
          }
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          {t("microReview.skipRemaining")}
        </button>
      </p>
    </div>
  );
}
