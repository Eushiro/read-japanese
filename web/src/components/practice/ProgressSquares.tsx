import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { QuestionResult } from "./types";

interface ProgressSquaresProps {
  totalQuestions: number;
  currentIndex: number;
  previousResults: QuestionResult[];
  /** Whether the current question has been answered (stops pulsing) */
  isAnswered: boolean;
  /** Navigate to a previously answered question by its queue index */
  onGoToQuestion?: (index: number) => void;
  /** Whether more questions are being generated */
  isGeneratingMore?: boolean;
  /** Message to display when generating */
  generatingMessage?: string;
  /** Optional badge to show below the squares (e.g. difficulty level) */
  difficultyBadge?: React.ReactNode;
  /** Whether the current user is an admin (makes all squares clickable) */
  isAdmin?: boolean;
}

export function ProgressSquares({
  totalQuestions,
  currentIndex,
  previousResults,
  onGoToQuestion,
  isGeneratingMore,
  generatingMessage,
  difficultyBadge,
  isAdmin,
}: ProgressSquaresProps) {
  // Track previous total to detect newly added squares.
  // Uses "adjust state during render" pattern so animatingFrom is
  // available on the same render where new squares first appear.
  const [animState, setAnimState] = useState({
    prevTotal: totalQuestions,
    animatingFrom: null as number | null,
  });

  if (totalQuestions > animState.prevTotal) {
    setAnimState({ prevTotal: totalQuestions, animatingFrom: animState.prevTotal });
  } else if (totalQuestions < animState.prevTotal) {
    setAnimState({ prevTotal: totalQuestions, animatingFrom: null });
  }

  const { animatingFrom } = animState;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <AnimatePresence initial={false}>
          {Array.from({ length: totalQuestions }).map((_, i) => {
            const result = previousResults[i];
            const isCurrent = i === currentIndex;
            const isFuture = result === null && !isCurrent;
            const isNew = animatingFrom !== null && i >= animatingFrom;

            let bgColor = "transparent";
            let borderColor = "var(--color-border)";

            if (result === "correct") {
              bgColor = "#4ade80";
              borderColor = "#4ade80";
            } else if (result === "partial") {
              bgColor = "#f59e0b";
              borderColor = "#f59e0b";
            } else if (result === "incorrect") {
              bgColor = "rgba(239,68,68,0.6)";
              borderColor = "rgba(239,68,68,0.6)";
            } else if (isCurrent) {
              borderColor = "#f97316";
            }

            const isClickable = !isCurrent && !!onGoToQuestion && (result !== null || !!isAdmin);
            const sharedStyle = {
              width: 18,
              height: 18,
              backgroundColor: bgColor,
              border: `1.5px solid ${isFuture ? "var(--color-foreground-muted)" : borderColor}`,
            };
            const sharedMotion = {
              initial: isNew ? { scale: 0, opacity: 0 } : (false as const),
              animate: { scale: 1, opacity: 1 },
              transition: isNew
                ? {
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 20,
                    delay: (i - (animatingFrom ?? 0)) * 0.1,
                  }
                : undefined,
            };

            if (isClickable) {
              return (
                <motion.button
                  key={i}
                  className="rounded-sm cursor-pointer"
                  style={sharedStyle}
                  {...sharedMotion}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onGoToQuestion(i)}
                />
              );
            }

            return (
              <motion.div key={i} className="rounded-sm" style={sharedStyle} {...sharedMotion} />
            );
          })}
        </AnimatePresence>
      </div>
      {difficultyBadge}
      <AnimatePresence>
        {isGeneratingMore && generatingMessage && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-foreground-muted animate-pulse"
          >
            {generatingMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
