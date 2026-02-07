import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useReducer } from "react";

import type { QuestionResult } from "./types";

interface ProgressSquaresProps {
  totalQuestions: number;
  currentIndex: number;
  previousResults: QuestionResult[];
  /** Whether the current question has been answered (stops pulsing) */
  isAnswered: boolean;
}

interface AnimState {
  prevTotal: number;
  animatingFrom: number | null;
}

function animReducer(state: AnimState, totalQuestions: number): AnimState {
  if (totalQuestions > state.prevTotal) {
    return { prevTotal: totalQuestions, animatingFrom: state.prevTotal };
  }
  if (totalQuestions !== state.prevTotal) {
    return { prevTotal: totalQuestions, animatingFrom: null };
  }
  return state;
}

export function ProgressSquares({
  totalQuestions,
  currentIndex,
  previousResults,
  isAnswered,
}: ProgressSquaresProps) {
  const [animState, dispatch] = useReducer(animReducer, {
    prevTotal: totalQuestions,
    animatingFrom: null,
  });

  // Dispatch on change to avoid state updates during render
  useEffect(() => {
    dispatch(totalQuestions);
  }, [totalQuestions]);

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence initial={false}>
        {Array.from({ length: totalQuestions }).map((_, i) => {
          const result = previousResults[i];
          const isCurrent = i === currentIndex;
          const isFuture = result === null && !isCurrent;
          const isNew = animState.animatingFrom !== null && i >= animState.animatingFrom;

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

          return (
            <motion.div
              key={i}
              className="rounded-sm"
              style={{
                width: 12,
                height: 12,
                backgroundColor: bgColor,
                border: `1.5px solid ${isFuture ? "var(--color-foreground-muted)" : borderColor}`,
              }}
              initial={isNew ? { scale: 0, opacity: 0 } : false}
              animate={
                isCurrent && !isAnswered
                  ? { scale: 1, opacity: [0.4, 1, 0.4] }
                  : { scale: 1, opacity: 1 }
              }
              transition={
                isNew
                  ? {
                      type: "spring",
                      stiffness: 400,
                      damping: 20,
                      delay: (i - (animState.animatingFrom ?? 0)) * 0.1,
                    }
                  : isCurrent && !isAnswered
                    ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                    : undefined
              }
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
